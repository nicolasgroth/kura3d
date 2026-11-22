/**
 * @file src/store/__tests__/measureBus.test.ts
 * @description Comandos de medición del Command Bus: mismos valores que el MCP sin interfaz para el
 * mismo vaso (`mcp-server/src/__tests__/measureTools.test.ts`), permitidos en solo lectura, con
 * errores tipados y sin tocar la escena, el historial ni la selección.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { CommandBusResponse } from '../commandBus';
import type { KuraCommandRequest } from '../../types/kura';
import { resetStore, store } from './storeTestUtils';
import { useKuraStore } from '../useKuraStore';

/** Mismo vaso y mismos valores que la prueba del MCP sin interfaz. */
const CUP_EXPECTED = { capacityMl: 48.83, overflowHeightMm: 50 } as const;

const run = async (command: string, params: Record<string, unknown>) => {
  const res = (await store().executeCommand({ id: 'm', command: command as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;
  return res;
};
const ok = async (command: string, params: Record<string, unknown>) => {
  const res = await run(command, params);
  expect(res.ok, res.error).toBe(true);
  return res.result as Record<string, unknown> & { id?: string };
};

describe('Command Bus: medición', () => {
  beforeEach(async () => {
    await resetStore();
  });

  it('measure_capacity da lo mismo que el MCP sin interfaz y no toca escena ni historial', async () => {
    const outer = await ok('create_primitive', { primitiveType: 'cylinder', params: { radius: 20, height: 50, segments: 128 }, position: [0, 0, 0] });
    const inner = await ok('create_primitive', { primitiveType: 'cylinder', params: { radius: 18, height: 60, segments: 128 }, position: [0, 0, 2] });
    await ok('boolean_operation', { targetId: outer.id, toolIds: [inner.id], operation: 'subtract' });
    const cup = store().objects[0];
    expect(store().objects).toHaveLength(1);
    // Solo lectura aun con el MCP en modo de solo lectura.
    useKuraStore.setState({ mcpConfig: { ...store().mcpConfig, readOnly: true } } as never);
    const before = { objects: store().objects, past: store().past.length, selected: store().selectedIds };

    const full = (await ok('measure_capacity', { id: cup.id })) as { capacityMl: number; overflowHeightMm: number; cavities: unknown[] };
    expect(full.capacityMl).toBeCloseTo(CUP_EXPECTED.capacityMl, 2);
    expect(full.overflowHeightMm).toBeCloseTo(CUP_EXPECTED.overflowHeightMm, 1);
    expect(full.cavities).toHaveLength(1);
    const half = (await ok('measure_capacity', { id: cup.id, levelMm: 26 })) as { levelHeightMm: number; filledMl: number };
    expect(half.levelHeightMm).toBe(26);

    const obj = (await ok('measure_object', { id: cup.id })) as { sizeMm: number[]; isClosed: boolean };
    expect(obj.sizeMm[2]).toBeCloseTo(50, 3);
    expect(obj.isClosed).toBe(true);

    expect(store().objects).toBe(before.objects);
    expect(store().past.length).toBe(before.past);
    expect(store().selectedIds).toBe(before.selected);
  }, 60_000);

  it('measure_distance en ejes del usuario y errores tipados', async () => {
    const d = (await ok('measure_distance', { pointA: [0, 0, 0], pointB: [40, 0, 40] })) as { distanceMm: number; deltaMm: number[] };
    expect(d.distanceMm).toBeCloseTo(56.569, 3);
    expect(d.deltaMm).toEqual([40, 0, 40]);
    const bad = await run('measure_distance', { pointA: [0, 0, 0] });
    expect(bad.ok).toBe(false);
    expect(bad.errorCode).toBe('invalid-params');
    const missing = await run('measure_capacity', { id: 'nope' });
    expect(missing.errorCode).toBe('not-found');
    const level = await run('measure_capacity', { id: 'nope', levelMm: -1 });
    expect(level.ok).toBe(false);
  });
});
