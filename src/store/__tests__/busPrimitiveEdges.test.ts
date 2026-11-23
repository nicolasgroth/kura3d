/**
 * @file src/store/__tests__/busPrimitiveEdges.test.ts
 * @description Command Bus: `create_primitive` y `update_primitive_params` aceptan bordes con el
 * alcance que admite cada primitiva, informan el tamaño aplicado y si se acotó, y la edición de
 * bordes es un solo paso de deshacer que conserva la primitiva paramétrica.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { parametricStateOf } from '../../core/scene/parametric';
import { validateToolCall } from '../../ai/toolValidation';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { parseCreatePrimitive } from '../commandSchemas';
import { resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 'edges', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

describe('bus: bordes de primitivas', () => {
  beforeEach(() => resetStore());

  it('valida estilo y alcance por tipo de primitiva', () => {
    expect(parseCreatePrimitive({ type: 'box', edgeStyle: 'round', edgeSize: 3, edgeScope: 'vertical' }).params)
      .toEqual({ edgeStyle: 'round', edgeSize: 3, edgeScope: 'vertical' });
    expect(() => parseCreatePrimitive({ type: 'cylinder', edgeStyle: 'round', edgeScope: 'vertical' })).toThrow();
    expect(() => parseCreatePrimitive({ type: 'sphere', edgeStyle: 'round' })).toThrow();
    expect(parseCreatePrimitive({ type: 'sphere', edgeStyle: 'sharp' }).params).toEqual({ edgeStyle: 'sharp' });
    expect(() => parseCreatePrimitive({ type: 'box', edgeStyle: 'wavy' })).toThrow();
    expect(() => parseCreatePrimitive({ type: 'box', edgeSize: 1001 })).toThrow();
  });

  it('la IA declara los mismos campos', () => {
    expect(validateToolCall('create_primitive', { type: 'box', edgeStyle: 'chamfer', edgeSize: 2, edgeScope: 'top' }).ok).toBe(true);
    expect(validateToolCall('create_primitive', { type: 'box', edgeStyle: 'wavy' }).ok).toBe(false);
    expect(validateToolCall('update_primitive_params', { edgeSize: 2000 }).ok).toBe(false);
  });

  it('crear y editar bordes: medidas iguales, tamaño informado, un paso de deshacer', async () => {
    const created = await run('create_primitive', { type: 'box', params: { width: 20, depth: 20, height: 10 }, placement: 'origin' });
    expect(created.ok).toBe(true);
    const id = (created.result as { id: string }).id;
    const sharpDims = store().objects[0].stats.dimensionsMm;
    const pastBefore = store().past.length;
    const res = await run('update_primitive_params', { id, params: { edgeStyle: 'round', edgeSize: 25 } });
    expect(res.ok).toBe(true);
    expect(res.result).toMatchObject({ edgeSizeClamped: true, primitiveParams: { edgeStyle: 'round', edgeSize: 25 } });
    expect((res.result as { edgeSizeApplied: number }).edgeSizeApplied).toBeLessThan(10);
    const obj = store().objects[0];
    expect(obj.stats.isManifold).toBe(true);
    obj.stats.dimensionsMm.forEach((v, i) => expect(v).toBeCloseTo(sharpDims[i], 3));
    expect(parametricStateOf(obj).status).toBe('primitive');
    expect(store().past.length).toBe(pastBefore + 1);
    store().undo();
    expect(store().objects[0].primitiveParams?.edgeStyle).toBeUndefined();
  });
});
