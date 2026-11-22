/**
 * @file src/store/__tests__/commandBus.test.ts
 * @description Pruebas del Command Bus validado: vectores inválidos rechazados sin dañar el proyecto,
 * objetivos ambiguos o inexistentes como error tipado, objetos bloqueados, modo ocupado y mensajes
 * traducidos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { encodeProject } from '../../project/projectCodec';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { captureProject, useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const run = (command: KuraCommandRequest['command'], params: Record<string, unknown>, source: 'ui' | 'mcp' | 'ai' = 'ai') =>
  store().executeCommand({ id: `t_${command}`, command, params }, source) as Promise<CommandBusResponse>;

const saveable = () => encodeProject(captureProject(store()));

describe('Command Bus: validación de vectores y proyecto guardable', () => {
  beforeEach(() => resetStore());

  it.each([
    ['vector de 2 componentes', { position: [1, 2] }],
    ['NaN', { position: [Number.NaN, 0, 0] }],
    ['infinito', { rotation: [0, Number.POSITIVE_INFINITY, 0] }],
    ['texto en vector', { position: ['1', 2, 3] }],
    ['escala cero', { scale: [0, 1, 1] }],
    ['escala negativa', { scale: [1, -1, 1] }],
    ['fuera de rango', { position: [1e9, 0, 0] }],
  ])('rechaza transform_object con %s y la escena sigue intacta', async (_label, patch) => {
    const box = await addBox(10);
    const before = byId(box.id)!;
    const res = await run('transform_object', { id: box.id, ...patch });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('invalid-params');
    expect(byId(box.id)!.position).toEqual(before.position);
    expect(byId(box.id)!.rotation).toEqual(before.rotation);
    expect(byId(box.id)!.scale).toEqual(before.scale);
    expect(() => saveable()).not.toThrow();
  });

  it('rechaza create_primitive con posición inválida y dimensiones no positivas', async () => {
    expect((await run('create_primitive', { type: 'box', position: [0, 0] })).errorCode).toBe('invalid-params');
    expect((await run('create_primitive', { type: 'box', width: -5 })).errorCode).toBe('invalid-params');
    expect((await run('create_primitive', { type: 'prism', sides: 2.5 })).errorCode).toBe('invalid-params');
    expect((await run('create_primitive', { type: 'blob' })).errorCode).toBe('invalid-params');
    expect(store().objects).toHaveLength(0);
  });

  it('acepta un transform válido y el proyecto sigue codificándose', async () => {
    const box = await addBox(10);
    // El bus recibe ejes del usuario (Y = fondo, Z = altura): Y = 3 es Z interno = −3.
    const res = await run('transform_object', { id: box.id, position: [5, 3, 0], scale: [2, 2, 2] });
    expect(res.ok).toBe(true);
    expect(byId(box.id)!.position).toEqual([5, 0, -3]);
    expect(saveable().byteLength).toBeGreaterThan(0);
  });

  it('rechaza params que no son objeto', async () => {
    const res = await store().executeCommand(
      { id: 'x', command: 'get_scene_state', params: [] as unknown as Record<string, unknown> },
      'mcp',
    ) as CommandBusResponse;
    expect(res.errorCode).toBe('invalid-params');
  });
});

describe('Command Bus: objetivos sin defaults peligrosos', () => {
  beforeEach(() => resetStore());

  it('transform_object sin id con varios objetos y sin selección es ambiguo (no toca objects[0])', async () => {
    const a = await addBox(10, [0, 0, 0]);
    await addBox(10, [40, 0, 0]);
    useKuraStore.setState({ selectedIds: [] });
    const res = await run('transform_object', { position: [99, 0, 0] });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('ambiguous-target');
    expect(byId(a.id)!.position).toEqual([0, 0, 0]);
  });

  it('transform_object sin id usa la selección única', async () => {
    await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [40, 0, 0]);
    useKuraStore.setState({ selectedIds: [b.id] });
    expect((await run('transform_object', { position: [1, -1, 0] })).ok).toBe(true);
    expect(byId(b.id)!.position).toEqual([1, 0, 1]);
  });

  it('delete_object sin id con selección múltiple no borra nada', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [40, 0, 0]);
    useKuraStore.setState({ selectedIds: [a.id, b.id] });
    const res = await run('delete_object', {});
    expect(res.errorCode).toBe('ambiguous-target');
    expect(store().objects).toHaveLength(2);
  });

  it('delete_object con id inexistente devuelve not-found', async () => {
    await addBox(10);
    const res = await run('delete_object', { id: 'mesh_no_existe' });
    expect(res.errorCode).toBe('not-found');
    expect(store().objects).toHaveLength(1);
  });

  it('delete_object con ids explícitos borra solo esos', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [40, 0, 0]);
    const res = await run('delete_object', { ids: [a.id] });
    expect(res.ok).toBe(true);
    expect(res.result).toEqual({ deleted: [a.id] });
    expect(store().objects.map((o) => o.id)).toEqual([b.id]);
  });

  it('escena vacía devuelve no-target', async () => {
    expect((await run('hollow_object', { wallThickness: 2 })).errorCode).toBe('no-target');
  });

  it('boolean_operation exige op y objetos distintos', async () => {
    const a = await addBox(10, [0, 0, 0]);
    expect((await run('boolean_operation', { targetId: a.id, toolId: a.id, op: 'union' })).errorCode).toBe('precondition');
    expect((await run('boolean_operation', { targetId: a.id, toolId: a.id })).errorCode).toBe('invalid-params');
  });

  it('boolean_operation acepta toolIds múltiples del servidor MCP', async () => {
    const a = await addBox(20, [0, 0, 0]);
    const b = await addBox(6, [8, 0, 0], { name: 'b' });
    const c = await addBox(6, [-8, 0, 0], { name: 'c' });
    const res = await run('boolean_operation', { targetId: a.id, toolIds: [b.id, c.id], operation: 'subtract' }, 'mcp');
    expect(res.ok).toBe(true);
    expect(store().objects).toHaveLength(1);
    expect(store().objects[0].stats.volumeMm3).toBeLessThan(20 ** 3);
  });

  it('set_printer_profile desconocido es not-found', async () => {
    expect((await run('set_printer_profile', { profileId: 'no-existe' })).errorCode).toBe('not-found');
  });
});

describe('Command Bus: bloqueados, ocupado y mensajes traducidos', () => {
  beforeEach(() => resetStore());

  it('respeta locked en transform y boolean', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [5, 0, 0]);
    store().updateObjectMeta(b.id, { locked: true });
    expect((await run('transform_object', { id: b.id, position: [1, 1, 1] })).errorCode).toBe('locked');
    expect((await run('boolean_operation', { op: 'union', targetId: a.id, toolId: b.id })).errorCode).toBe('locked');
    expect(store().objects).toHaveLength(2);
  });

  it('rechaza comandos que mutan la escena durante una operación en curso', async () => {
    useKuraStore.setState({ busyOperation: 'hollow' });
    const res = await run('create_primitive', { type: 'box' });
    expect(res.errorCode).toBe('busy');
    expect(store().objects).toHaveLength(0);
    // Las lecturas siguen permitidas.
    expect((await run('get_scene_state', {})).ok).toBe(true);
  });

  it('modo solo lectura MCP con código tipado', async () => {
    useKuraStore.setState({ mcpConfig: { ...store().mcpConfig, readOnly: true } });
    const res = await run('create_primitive', { type: 'box' }, 'mcp');
    expect(res.errorCode).toBe('read-only');
  });

  it('traduce los errores al idioma activo', async () => {
    await resetStore('en');
    const res = await run('transform_object', { id: 'missing', position: [0, 0, 0] });
    expect(res.error).toBe('No object with id "missing".');
    const unknown = await store().executeCommand({ id: 'u', command: 'nope' as KuraCommandRequest['command'], params: {} });
    expect(unknown.error).toBe('Unsupported command: nope');
  });
});
