/**
 * @file src/core/addons/__tests__/surfaceNormalIndexed.test.ts
 * @description La normal de superficie con índice espacial y triángulo del raycast da exactamente lo mismo que la
 * versión anterior (que recorría la malla completa) en una esfera y un cilindro facetados, con y sin `faceIndex`,
 * y también con la pieza girada y escalada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { MeshData, Vec3 } from '../../../types/kura';
import { averagedSurfaceNormal, worldSurfaceNormal } from '../surfaceNormal';
import { denseSphere, prism } from './denseMeshes';
import { legacyAveragedSurfaceNormal, legacyWorldSurfaceNormal } from './surfaceNormalLegacy';

/** Puntos de muestra: el baricentro desplazado de varios triángulos, con su índice y la normal de la faceta. */
function samples(mesh: MeshData, count: number): Array<{ face: number; point: Vec3; normal: Vec3 }> {
  const p = mesh.positions, idx = mesh.indices, tris = idx.length / 3;
  const out: Array<{ face: number; point: Vec3; normal: Vec3 }> = [];
  for (let s = 0; s < count; s++) {
    const face = Math.floor(((s * 7919) % tris));
    const [a, b, c] = [idx[face * 3] * 3, idx[face * 3 + 1] * 3, idx[face * 3 + 2] * 3];
    const w = [0.2 + 0.1 * (s % 3), 0.3, 0];
    w[2] = 1 - w[0] - w[1];
    const point: Vec3 = [0, 1, 2].map((k) => p[a + k] * w[0] + p[b + k] * w[1] + p[c + k] * w[2]) as Vec3;
    const e1 = new THREE.Vector3(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
    const e2 = new THREE.Vector3(p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]);
    const n = e1.cross(e2).normalize();
    out.push({ face, point, normal: [n.x, n.y, n.z] });
  }
  return out;
}

const cases: Array<[string, MeshData]> = [
  ['esfera', denseSphere(20, 40, 64)],
  ['cilindro', prism([0, 0, 0], 12, 30, 48)],
];

describe('normal de superficie con índice espacial', () => {
  for (const [name, mesh] of cases) {
    it(`${name}: igual a la versión anterior, con y sin faceIndex`, () => {
      for (const radius of [0.5, 3, 8]) {
        for (const s of samples(mesh, 60)) {
          const expected = legacyAveragedSurfaceNormal(mesh, s.point, s.normal, radius);
          expect(averagedSurfaceNormal(mesh, s.point, s.normal, radius)).toEqual(expected);
          // Con el triángulo del raycast: el baricentro interior de esa faceta es el mismo triángulo que elegía antes.
          expect(averagedSurfaceNormal(mesh, s.point, s.normal, radius, undefined, s.face)).toEqual(expected);
        }
      }
    });

    it(`${name}: igual en mundo con rotación y escala`, () => {
      const obj = { mesh, position: [5, 2, -3] as Vec3, rotation: [0.3, -0.4, 0.2] as Vec3, scale: [1.5, 0.8, 1.2] as Vec3 };
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...obj.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...obj.rotation, 'XYZ')), new THREE.Vector3(...obj.scale));
      const nm = new THREE.Matrix3().getNormalMatrix(m);
      for (const s of samples(mesh, 30)) {
        const wp = new THREE.Vector3(...s.point).applyMatrix4(m);
        const wn = new THREE.Vector3(...s.normal).applyMatrix3(nm).normalize();
        const point: Vec3 = [wp.x, wp.y, wp.z], normal: Vec3 = [wn.x, wn.y, wn.z];
        const expected = legacyWorldSurfaceNormal(obj, point, normal, 4);
        const got = worldSurfaceNormal(obj, point, normal, 4, s.face);
        if (expected === null) expect(got).toBeNull();
        else for (let k = 0; k < 3; k++) expect(got![k]).toBeCloseTo(expected[k], 12);
        expect(worldSurfaceNormal(obj, point, normal, 4)).toEqual(expected);
      }
    });
  }

  it('un faceIndex fuera de rango cae en la búsqueda del triángulo', () => {
    const mesh = denseSphere(10, 20, 32);
    const s = samples(mesh, 1)[0];
    expect(averagedSurfaceNormal(mesh, s.point, s.normal, 3, undefined, 10 ** 9)).toEqual(legacyAveragedSurfaceNormal(mesh, s.point, s.normal, 3));
  });
});
