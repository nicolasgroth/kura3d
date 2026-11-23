/**
 * @file src/store/__tests__/fitCheckBus.test.ts
 * @description "Comprobar encaje" desde el Command Bus y el store: `check_fit` es de solo lectura (no
 * agrega pasos de deshacer ni cambia objetos), responde en ejes del usuario con el texto en inglés, guarda
 * el informe en el store y éste se invalida al mover un objeto involucrado (no al mover uno ajeno).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { CommandBusResponse } from '../commandBus';
import type { KuraCommandRequest } from '../../types/kura';
import { buildSceneObject, APP_BUILD_POLICY } from '../../core/scene/sceneObjects';
import { createPrimitiveMesh } from '../../engine/primitives';
import { resetStore, store } from './storeTestUtils';
import { useKuraStore } from '../useKuraStore';

const run = async (command: string, params: Record<string, unknown>) =>
  (await store().executeCommand({ id: 'f', command: command as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;

async function cube(id: string, x: number) {
  const mesh = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
  return buildSceneObject({ id, name: id, source: 'primitive', mesh, position: [x, 0, 0], color: '#38bdf8' } as never, APP_BUILD_POLICY);
}

describe('Command Bus: check_fit', () => {
  beforeEach(async () => {
    await resetStore();
  });

  it('es de solo lectura, informa el choque en ejes del usuario y lo guarda en el store', async () => {
    const objs = [await cube('A', 0), await cube('B', 8), await cube('C', 100)];
    useKuraStore.setState({ objects: objs, selectedIds: [] } as never);
    const past = store().past.length;
    const before = store().objects;
    const res = await run('check_fit', {});
    expect(res.ok, res.error).toBe(true);
    const r = res.result as { dryRun: boolean; pairs: Array<{ status: string; interference: { volumeMm3: number }; recommendation: { text: string } }>; summary: { evaluatedPairs: number; message: { text: string } } };
    expect(r.dryRun).toBe(true);
    expect(r.summary.evaluatedPairs).toBe(1);
    expect(r.pairs[0].status).toBe('interferes');
    expect(r.pairs[0].interference.volumeMm3).toBeCloseTo(200, 3);
    expect(r.pairs[0].recommendation.text).toContain('toward −X (left)');
    expect(r.summary.message.text).toContain('Pairs checked: 1');
    expect(store().past.length).toBe(past);
    expect(store().objects).toBe(before);
    expect(store().fitCheck?.report.pairs).toHaveLength(1);
  });

  it('valida parámetros e ids', async () => {
    useKuraStore.setState({ objects: [await cube('A', 0)], selectedIds: [] } as never);
    expect((await run('check_fit', { ids: ['nope'] })).ok).toBe(false);
    expect((await run('check_fit', { clearanceTargetMm: -1 })).ok).toBe(false);
    expect((await run('check_fit', { maxPairs: 0 })).ok).toBe(false);
  });

  it('el informe se invalida al mover un objeto involucrado, no al mover uno ajeno', async () => {
    const objs = [await cube('A', 0), await cube('B', 8), await cube('C', 100)];
    useKuraStore.setState({ objects: objs, selectedIds: [] } as never);
    const report = await store().checkFit({ ids: ['A', 'B'] });
    expect(report?.summary.interferes, JSON.stringify(store().toasts)).toBe(1);
    store().setFitCheckHighlight({ aId: report!.pairs[0].aId, bId: report!.pairs[0].bId });
    expect(store().fitCheckHighlight).not.toBeNull();
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === 'C' ? { ...o, position: [120, 0, 0] } : o)) } as never);
    expect(store().fitCheck).not.toBeNull();
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === 'B' ? { ...o, position: [30, 0, 0] } : o)) } as never);
    expect(store().fitCheck).toBeNull();
    expect(store().fitCheckHighlight).toBeNull();
  });
});
