/**
 * @file src/core/addons/__tests__/surfaceNormalFallback.test.ts
 * @description Sin `hitFace`, la normal de superficie busca el triángulo con la grilla de baricentros y no recorre
 * la malla: da lo mismo que la versión que la recorría entera incluso cuando el triángulo que contiene el punto es
 * enorme frente a las facetas (baricentro lejos) o cuando el punto no está en ninguna cara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, Vec3 } from '../../../types/kura';
import { averagedSurfaceNormal } from '../surfaceNormal';
import { denseSphere } from './denseMeshes';
import { legacyAveragedSurfaceNormal } from './surfaceNormalLegacy';

/** Esfera facetada de radio 20 en el origen más un triángulo gigante (400 mm) en el plano Y = −60. */
function sphereAndSlab(): MeshData {
  const sphere = denseSphere(20, 40, 64);
  const base = sphere.positions.length / 3;
  const positions = new Float32Array([...sphere.positions, -400, -60, -400, 400, -60, -400, 0, -60, 400]);
  const indices = new Uint32Array([...sphere.indices, base, base + 2, base + 1]);
  return { ...sphere, positions, indices };
}

describe('normal de superficie: respaldo sin hitFace con la grilla', () => {
  const mesh = sphereAndSlab();

  it('un punto sobre un triángulo enorme se encuentra aunque su baricentro quede lejos', () => {
    const point: Vec3 = [30, -60, 100];
    const normal: Vec3 = [0, 1, 0];
    const expected = legacyAveragedSurfaceNormal(mesh, point, normal, 3);
    expect(averagedSurfaceNormal(mesh, point, normal, 3)).toEqual(expected);
    // Encontró la losa (no devolvió null por «triángulo no hallado»): la normal queda en +Y salvo ruido de redondeo.
    expect(expected).not.toBeNull();
    expect(expected![1]).toBeCloseTo(1, 6);
  });

  it('un punto de la esfera da lo mismo que el recorrido completo', () => {
    for (const dir of [[1, 0.2, 0.1], [0.3, 1, 0.4], [-0.5, 0.2, -1], [0.1, -1, 0.3]]) {
      const l = Math.hypot(dir[0], dir[1], dir[2]);
      const n: Vec3 = [dir[0] / l, dir[1] / l, dir[2] / l];
      const point: Vec3 = [n[0] * 20, n[1] * 20, n[2] * 20];
      expect(averagedSurfaceNormal(mesh, point, n, 3)).toEqual(legacyAveragedSurfaceNormal(mesh, point, n, 3));
    }
  });

  it('un punto que no está en ninguna cara devuelve null sin lanzar', () => {
    expect(averagedSurfaceNormal(mesh, [500, 500, 500], [0, 1, 0], 3)).toBeNull();
    expect(legacyAveragedSurfaceNormal(mesh, [500, 500, 500], [0, 1, 0], 3)).toBeNull();
  });
});
