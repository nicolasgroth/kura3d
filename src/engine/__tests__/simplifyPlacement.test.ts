/**
 * @file src/engine/__tests__/simplifyPlacement.test.ts
 * @description Simplificar no mueve la pieza en el mundo, con el motor real: una esfera cuya malla está lejos de su
 * origen (descentrada), girada y escalada queda con la misma caja de mundo (centro y medidas) tras simplificar, y la
 * malla sigue en el mismo sistema local (no se recentra en XZ ni se apoya en la cama).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createPrimitiveMesh } from '../index';
import { placementMatrix } from '../measure/measureAnchors';
import { isMeshClosed } from '../repair/meshTopology';
import { simplifyMeshDetailed } from '../simplify';
import { makeObject } from './geometryTestUtils';
import type { MeshData, SceneObject } from '../../types/kura';

function worldBox(obj: Pick<SceneObject, 'position' | 'rotation' | 'scale'>, mesh: MeshData): Box3 {
  const m = placementMatrix(obj);
  const box = new Box3();
  const p = new Vector3();
  for (let i = 0; i < mesh.positions.length; i += 3) box.expandByPoint(p.set(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]).applyMatrix4(m));
  return box;
}

function offset(mesh: MeshData, d: [number, number, number]): MeshData {
  const positions = new Float32Array(mesh.positions);
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) positions[i + k] += d[k];
  return { ...mesh, positions };
}

describe('Simplificar: la pieza queda donde estaba', () => {
  it('malla descentrada, girada y escalada: misma caja de mundo y mismo sistema local', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 64 });
    const mesh = offset(sphere, [90, 35, -60]);
    const obj = makeObject('s', mesh, { position: [12, 4, -7], rotation: [0.4, 0.9, -0.3], scale: [1.5, 0.8, 2] });
    const res = await simplifyMeshDetailed(obj, { mode: 'target', targetPercent: 50 });
    expect(res.report.applied).toBe(true);
    const out = res.mesh!;
    expect(isMeshClosed(out.positions, out.indices)).toBe(true);
    expect(res.report.trianglesAfter).toBeLessThan(res.report.trianglesBefore * 0.6);

    // Tolerancia: la desviación medida (en mm de mundo) más un margen de redondeo.
    const tol = res.report.maxDeviationMm + 1e-3;
    const before = worldBox(obj, mesh);
    const after = worldBox(obj, out);
    const cb = before.getCenter(new Vector3()), ca = after.getCenter(new Vector3());
    expect(cb.distanceTo(ca)).toBeLessThanOrEqual(tol);
    const sb = before.getSize(new Vector3()), sa = after.getSize(new Vector3());
    for (const k of ['x', 'y', 'z'] as const) expect(Math.abs(sb[k] - sa[k])).toBeLessThanOrEqual(2 * tol);

    // Sistema local intacto: la caja local sigue lejos del origen (no se recentró).
    const localBefore = new Box3().setFromArray(mesh.positions).getCenter(new Vector3());
    const local = new Box3().setFromArray(out.positions).getCenter(new Vector3());
    expect(localBefore.x).toBeCloseTo(90, 0);
    expect(local.distanceTo(localBefore)).toBeLessThanOrEqual(tol);
  });
});
