/**
 * @file src/store/__tests__/repairBus.test.ts
 * @description "Reparar malla" desde el Command Bus: diagnose_mesh es de solo lectura y marca los
 * bordes abiertos; repair_mesh cierra el agujero en un paso de deshacer y devuelve la misma forma que
 * el MCP sin interfaz. Una operación que falla por malla inválida ofrece reparar en el aviso, y el bus
 * devuelve los avisos del motor en `warnings`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { CommandBusResponse } from '../commandBus';
import type { KuraCommandRequest } from '../../types/kura';
import { buildSceneObject, APP_BUILD_POLICY } from '../../core/scene/sceneObjects';
import { resetStore, store } from './storeTestUtils';
import { useKuraStore } from '../useKuraStore';

const run = async (command: string, params: Record<string, unknown>) =>
  (await store().executeCommand({ id: 'r', command: command as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;

function addOpenCube() {
  const p: number[] = [];
  for (let i = 0; i < 8; i++) p.push(i & 1 ? 10 : 0, i & 2 ? 10 : 0, i & 4 ? 10 : 0);
  const idx = [0, 2, 3, 0, 3, 1, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5];
  const obj = buildSceneObject(
    { id: 'open_cube', name: 'open', source: 'import', mesh: { positions: new Float32Array(p), indices: new Uint32Array(idx), normals: new Float32Array(24) }, position: [0, 0, 0], color: '#38bdf8' } as never,
    APP_BUILD_POLICY,
  );
  useKuraStore.setState({ objects: [obj], selectedIds: [obj.id] } as never);
  return obj;
}

describe('Command Bus: reparar malla', () => {
  beforeEach(async () => {
    await resetStore();
  });

  it('diagnose_mesh es solo lectura y resalta bordes abiertos', async () => {
    const obj = addOpenCube();
    const past = store().past.length;
    const res = await run('diagnose_mesh', { id: obj.id });
    expect(res.ok, res.error).toBe(true);
    const d = (res.result as { diagnosis: { closed: boolean; holes: number; openEdges: number } }).diagnosis;
    expect(d).toMatchObject({ closed: false, holes: 1, openEdges: 4 });
    expect(store().past.length).toBe(past);
    expect(store().meshDiagnosis?.diagnosis.openEdgeSegments.length).toBe(24);
  });

  it('repair_mesh cierra el agujero en un paso de deshacer', async () => {
    const obj = addOpenCube();
    expect(obj.stats.isManifold).toBe(false);
    const past = store().past.length;
    const res = await run('repair_mesh', { id: obj.id });
    expect(res.ok, res.error).toBe(true);
    const r = res.result as { changed: boolean; actions: { filledHoles: number }; after: { closed: boolean } };
    expect(r.changed).toBe(true);
    expect(r.actions.filledHoles).toBe(1);
    expect(r.after.closed).toBe(true);
    const fixed = store().objects[0];
    expect(fixed.stats.isManifold).toBe(true);
    expect(fixed.stats.volumeMm3).toBeCloseTo(1000, 2);
    expect(store().past.length).toBe(past + 1);
    store().undo();
    expect(store().objects[0].stats.isManifold).toBe(false);
  });

  it('una operación con malla inválida ofrece "Reparar malla" en el aviso', async () => {
    addOpenCube();
    const res = await run('simplify_mesh', { id: 'open_cube', toleranceMm: 0.05 });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('MESH_INVALID');
    const toast = store().toasts.find((t) => t.kind === 'error');
    expect(toast?.action?.label).toBe('Reparar malla');
  });
});
