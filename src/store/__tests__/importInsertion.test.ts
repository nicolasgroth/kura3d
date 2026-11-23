/**
 * @file src/store/__tests__/importInsertion.test.ts
 * @description Inserción por tandas de lo importado: reparto por triángulos, tandas intermedias sin
 * grupo (no se pierden los grupos aún sin miembros) y escena final con grupos y selección.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { cubeGeometry } from '../../engine/__tests__/ioFixtures';
import type { SceneGroup, SceneObject } from '../../types/kura';
import { insertImportedObjects, sliceByTriangles, type InsertionScene } from '../importInsertion';

const cube = (name: string, groupRef?: string): SceneObject => {
  const { v, t } = cubeGeometry(5);
  const obj = buildSceneObject({ name, source: 'imported', mesh: { positions: new Float32Array(v.flat()), indices: new Uint32Array(t.flat()) }, position: [0, 0, 0], color: '#fff' });
  return groupRef ? { ...obj, groupRef } : obj;
};

describe('inserción por tandas', () => {
  it('reparte por triángulos con al menos un elemento por tanda', () => {
    expect(sliceByTriangles([5, 5, 5, 20, 1], (n) => n, 10)).toEqual([[5, 5], [5], [20], [1]]);
    expect(sliceByTriangles([], (n: number) => n, 10)).toEqual([]);
  });

  it('las tandas intermedias entran sin grupo y la final deja grupos y selección', async () => {
    const group: SceneGroup = { id: 'g1', name: 'Placa', visible: true, locked: false, collapsed: false };
    const created = [cube('a', 'g1'), cube('b', 'g1'), cube('c', 'g1')];
    let scene: InsertionScene = { objects: [], groups: [], selectedIds: [] };
    const seen: InsertionScene[] = [];
    const ok = await insertImportedObjects(created, (prev) => ({ objects: [...prev.objects, ...created], groups: [group], selectedIds: created.map((o) => o.id) }), {
      get: () => scene,
      set: (patch) => { scene = { ...scene, ...patch(scene) }; },
      yieldFrame: async () => void seen.push(scene),
      budget: 12,
    });
    expect(ok).toBe(true);
    expect(seen.map((s) => s.objects.length)).toEqual([1, 2]);
    for (const s of seen) expect(s.objects.every((o) => o.groupRef === undefined)).toBe(true);
    expect(scene.objects.map((o) => o.id)).toEqual(created.map((o) => o.id));
    expect(scene.objects.every((o) => o.groupRef === 'g1')).toBe(true);
    expect(scene.groups).toEqual([group]);
  });
});
