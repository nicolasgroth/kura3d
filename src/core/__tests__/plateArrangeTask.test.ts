/**
 * @file src/core/__tests__/plateArrangeTask.test.ts
 * @description Tarea del motor de «Repartir en placas»: «cara plana abajo» apoya una losa parada sobre su cara
 * grande (con el motor de Orientar) y la tarea está registrada para el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { ENGINE_TASKS } from '../operations/engineTasks';
import { arrangeOnPlatesTask, flatDownPose } from '../operations/plateArrangeOperations';
import { poseBounds } from '../scene/plateArrange';
import type { SceneObject } from '../../types/kura';

/** Caja cerrada (12 triángulos) de w × h × d con la base en y = 0. */
function closedBox(w: number, h: number, d: number) {
  const x = w / 2, z = d / 2;
  const positions = new Float32Array([-x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z, -x, h, -z, x, h, -z, x, h, z, -x, h, z]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]);
  return { positions, indices };
}

const slab = (): SceneObject => ({
  id: 's', name: 's', source: 'primitive', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#fff', role: 'solid', visible: true,
  locked: false, mesh: closedBox(10, 120, 60), stats: { triangles: 12, vertices: 8, isManifold: true, volumeMm3: 72000, dimensionsMm: [10, 120, 60] },
}) as unknown as SceneObject;

describe('Repartir: cara plana abajo', () => {
  it('acuesta una losa parada sobre su cara más grande y la deja apoyada', () => {
    const o = slab();
    const pose = flatDownPose(o)!;
    const b = poseBounds(o.mesh, pose.position, pose.rotation, o.scale)!;
    expect(b.maxY - b.minY).toBeCloseTo(10, 4);
    expect(b.minY).toBeCloseTo(0, 6);
  });

  it('la tarea del motor planifica con la pose apoyada', () => {
    const o = slab();
    const plan = arrangeOnPlatesTask({ objects: [o], plates: [], groups: [], projectBed: { widthMm: 200, depthMm: 200, heightMm: 50 }, options: { orient: 'flatDown' } });
    // Parada (120 mm) no cabría en 50 mm de alto; acostada, sí.
    expect(plan.report.placed).toEqual(['s']);
    expect(plan.report.keptOrientation).toEqual([]);
    expect(Object.hasOwn(ENGINE_TASKS, 'arrangeOnPlates')).toBe(true);
  });
});
