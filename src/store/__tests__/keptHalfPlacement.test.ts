/**
 * @file src/store/__tests__/keptHalfPlacement.test.ts
 * @description Corte por plano conservando UNA mitad: dónde queda (donde está / apoyada en la cama / en un
 * lugar libre), un solo paso de deshacer, superposición detectada y aviso de resultado; F4 repite el corte
 * con la misma elección. Corre por el Command Bus (mismo camino que el MCP con la app abierta).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { estimateKeptHalf, overlappingNames, resolveKeptHalf } from '../../core/scene/keptHalf';
import { computeTransformedMinY } from '../../core/scene/sceneObjects';
import { footprintOf } from '../../core/scene/freeSpot';
import type { KuraCommandRequest, SceneObject } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 'kh', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

/** Altura mundial (Y interna = Z del usuario) de la base de un objeto. */
const baseZ = (o: SceneObject) => o.position[1] + computeTransformedMinY(o.mesh, o.rotation, o.scale);

const cutUpper = (id: string, keptHalfPlacement?: string) =>
  run('plane_cut', { id, axis: 'z', offset: 0, keepMode: 'positive', connectorType: 'none', ...(keptHalfPlacement ? { keptHalfPlacement } : {}) });

describe('mitad conservada del corte por plano', () => {
  beforeEach(() => resetStore());

  it('inPlace (por defecto): la mitad de arriba queda flotando donde estaba', async () => {
    const box = await addBox(30);
    expect((await cutUpper(box.id)).ok).toBe(true);
    expect(store().objects).toHaveLength(1);
    expect(baseZ(store().objects[0])).toBeCloseTo(15, 3);
  });

  it('dropToBed: baja hasta tocar la cama, mismo X/Y, un solo paso de deshacer', async () => {
    const box = await addBox(30);
    const x = box.position[0];
    const z = box.position[2];
    const depth = store().past.length;
    expect((await cutUpper(box.id, 'dropToBed')).ok).toBe(true);
    const half = store().objects[0];
    expect(baseZ(half)).toBeCloseTo(0, 3);
    expect(half.position[0]).toBeCloseTo(x, 3);
    expect(half.position[2]).toBeCloseTo(z, 3);
    expect(store().past.length).toBe(depth + 1);
    expect(store().toasts.some((t) => /apoyada en la cama/.test(t.text))).toBe(true);
    store().undo();
    expect(store().objects.map((o) => o.id)).toEqual([box.id]);
  });

  it('freeSpot: queda apoyada en la cama y sin pisar a otro objeto; un solo paso de deshacer', async () => {
    const box = await addBox(30);
    const other = await addBox(30, [0, 0, 0], { name: 'Debajo' });
    // El cubo cortado flota sobre «Debajo»: se sube y «Debajo» queda en el mismo lugar de la cama.
    store().setObjectTransform(box.id, { position: [other.position[0], 55, other.position[2]] }, true);
    const depth = store().past.length;
    const r = await cutUpper(box.id, 'freeSpot'); expect(r.ok, JSON.stringify(r)).toBe(true);
    const half = store().objects.find((o) => o.id !== other.id)!;
    expect(baseZ(half)).toBeCloseTo(0, 3);
    expect(overlappingNames([other], footprintOf(half.mesh, half.position, half.rotation, half.scale))).toEqual([]);
    expect(store().past.length).toBe(depth + 1);
    expect(store().toasts.some((t) => /lugar libre/.test(t.text))).toBe(true);
    store().undo();
    expect(store().objects.map((o) => o.id).sort()).toEqual([box.id, other.id].sort());
  });

  it('dropToBed sobre otro objeto: respeta la elección y avisa de la superposición', async () => {
    const box = await addBox(30);
    const other = await addBox(30, [0, 0, 0], { name: 'Debajo' });
    store().setObjectTransform(box.id, { position: [other.position[0], 55, other.position[2]] }, true);
    expect((await cutUpper(box.id, 'dropToBed')).ok).toBe(true);
    const half = store().objects.find((o) => o.id !== other.id)!;
    expect(baseZ(half)).toBeCloseTo(0, 3);
    expect(half.position[0]).toBeCloseTo(other.position[0], 3);
    expect(store().toasts.some((t) => t.text.includes('Debajo'))).toBe(true);
  });

  it('la estimación del diálogo detecta la superposición con el nombre del objeto', async () => {
    const box = await addBox(30);
    const other = await addBox(30, [0, 0, 0], { name: 'Debajo' });
    store().setObjectTransform(box.id, { position: [other.position[0], 55, other.position[2]] }, true);
    const target = store().objects.find((o) => o.id === box.id)!;
    const est = estimateKeptHalf(target, { axis: 'y', offset: 0, keepMode: 'positive' })!;
    expect(est.restsOnBed).toBe(false);
    expect(overlappingNames([other], est.footprint)).toEqual(['Debajo']);
  });

  it('mitad inferior de un corte horizontal: ya apoyada, la elección no cambia nada', async () => {
    const box = await addBox(30);
    const target = store().objects[0];
    expect(estimateKeptHalf(target, { axis: 'y', offset: 0, keepMode: 'negative' })!.restsOnBed).toBe(true);
    expect(estimateKeptHalf(target, { axis: 'y', offset: 0, keepMode: 'both' })).toBeNull();
    const res = await run('plane_cut', { id: box.id, axis: 'z', offset: 0, keepMode: 'negative', connectorType: 'none', keptHalfPlacement: 'freeSpot' });
    expect(res.ok).toBe(true);
    const half = store().objects[0];
    expect(baseZ(half)).toBeCloseTo(0, 3);
    expect(half.position[0]).toBeCloseTo(box.position[0], 3);
    expect(resolveKeptHalf([], [half], { keepMode: 'negative', keptHalfPlacement: 'dropToBed' })).toBeNull();
  });

  it('ambas mitades: no se pregunta, conserva el comportamiento actual', async () => {
    const box = await addBox(30);
    const res = await run('plane_cut', { id: box.id, axis: 'z', offset: 0, keepMode: 'both', connectorType: 'none', keptHalfPlacement: 'freeSpot' });
    expect(res.ok).toBe(true);
    expect(store().objects).toHaveLength(2);
    expect(store().objects.every((o) => Math.abs(baseZ(o)) < 1e-6)).toBe(true);
  });

  it('F4 repite el corte con la misma elección', async () => {
    const box = await addBox(30);
    expect((await cutUpper(box.id, 'dropToBed')).ok).toBe(true);
    // Se deshace el corte (F4 conserva lo último hecho) y se repite sobre el cubo restaurado.
    store().undo();
    store().selectObject(box.id);
    const depth = store().past.length;
    expect(store().objects.map((o) => o.id)).toEqual([box.id]);
    expect(await store().repeatLastAction()).toBe('done');
    expect(store().objects).toHaveLength(1);
    expect(store().past.length).toBe(depth + 1);
    expect(baseZ(store().objects[0])).toBeCloseTo(0, 3);
  });

  it('valor inválido: error de parámetros, sin cambios', async () => {
    const box = await addBox(30);
    const res = await cutUpper(box.id, 'volando');
    expect(res.ok).toBe(false);
    expect(store().objects.map((o) => o.id)).toEqual([box.id]);
  });
});
