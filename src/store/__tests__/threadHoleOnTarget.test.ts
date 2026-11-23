/**
 * @file src/store/__tests__/threadHoleOnTarget.test.ts
 * @description Agujero roscado negativo con un objeto seleccionado (o `targetId` por el bus): queda
 * centrado en la cara superior del objeto, entrando hacia abajo, y agrupado con él. Sin selección va a
 * un hueco libre como antes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneObject } from '../../types/kura';
import { useKuraStore } from '../useKuraStore';
import { byId, resetStore, store } from './storeTestUtils';

vi.setConfig({ testTimeout: 60_000 });

beforeEach(async () => {
  await resetStore();
});

const HOLE = { kind: 'hole' as const, diameterMm: 6, pitchMm: 1, lengthMm: 10 };

async function cubeAt(x: number, z: number) {
  const cube = await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { name: 'Cubo' });
  if (!cube) throw new Error('sin cubo');
  store().setObjectTransform(cube.id, { position: [x, 0, z] }, true);
  return byId(cube.id)!;
}

describe('agujero roscado sobre el objeto seleccionado', () => {
  it('con un cubo seleccionado: centrado en su cara superior, entra hacia abajo y queda agrupado', async () => {
    const cube = await cubeAt(40, -25);
    useSelection(cube.id);
    const hole = await store().createThreadObject(HOLE);
    expect(hole).not.toBeNull();
    const h = computeWorldBoundingBox(byId(hole!.id)!);
    const c = computeWorldBoundingBox(byId(cube.id)!);
    // Centro XZ del agujero = centro XZ del cubo
    expect((h.min[0] + h.max[0]) / 2).toBeCloseTo((c.min[0] + c.max[0]) / 2, 3);
    expect((h.min[2] + h.max[2]) / 2).toBeCloseTo((c.min[2] + c.max[2]) / 2, 3);
    // Tope apenas sobre la cara superior y hacia abajo dentro del cubo
    expect(h.max[1]).toBeGreaterThan(c.max[1]);
    expect(h.max[1] - c.max[1]).toBeLessThan(1);
    expect(h.min[1]).toBeCloseTo(h.max[1] - 10, 0);
    expect(byId(hole!.id)!.role).toBe('negative');
    expect(byId(hole!.id)!.groupRef).toBeDefined();
    expect(byId(hole!.id)!.groupRef).toBe(byId(cube.id)!.groupRef);
  });

  it('por el bus con targetId: mismo resultado sin depender de la selección', async () => {
    const cube = await cubeAt(-30, 10);
    useSelection();
    const res = await store().executeCommand({ id: 't', command: 'create_thread', params: { ...HOLE, targetId: cube.id } }, 'ai');
    expect(res.ok).toBe(true);
    const hole = store().objects.find((o) => (o.role === 'negative'))!;
    const h = computeWorldBoundingBox(hole);
    const c = computeWorldBoundingBox(byId(cube.id)!);
    expect((h.min[0] + h.max[0]) / 2).toBeCloseTo((c.min[0] + c.max[0]) / 2, 3);
    expect(h.max[1]).toBeGreaterThan(c.max[1]);
    expect(hole.groupRef).toBe(byId(cube.id)!.groupRef);
  });

  it('sin selección: hueco libre, sin grupo', async () => {
    await cubeAt(0, 0);
    useSelection();
    const hole = await store().createThreadObject(HOLE);
    expect(byId(hole!.id)!.groupRef).toBeUndefined();
  });
});

function useSelection(...ids: string[]) {
  useKuraStore.setState({ selectedIds: ids });
}

/** Caja mundial (sin rotación: los objetos de la prueba no rotan). */
function computeWorldBoundingBox(o: SceneObject) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const P = o.mesh.positions;
  for (let i = 0; i < P.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = P[i + k] * o.scale[k] + o.position[k];
      min[k] = Math.min(min[k], v);
      max[k] = Math.max(max[k], v);
    }
  }
  return { min, max };
}
