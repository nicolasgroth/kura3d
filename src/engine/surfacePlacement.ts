/**
 * @file src/engine/surfacePlacement.ts
 * @description Inversa de la proyección sobre superficie: a partir de un punto y una normal de
 * mundo (clic en el visor) elige la cara de proyección (`+x`…`-z`) y el desplazamiento U/V que
 * `projectGraphicOnSurface` usa para colocar el diseño en ese punto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject, SurfaceProjectionAxis, Vec3 } from '../types/kura';
import { applyTransformToMesh } from './primitives';

export interface SurfacePlacement {
  axis: Exclude<SurfaceProjectionAxis, 'cylindrical'>;
  offsetU: number;
  offsetV: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Centro de la caja de mundo de la pieza (igual que la proyección). */
export function worldCenter(obj: SceneObject): Vec3 {
  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const p = world.positions;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[i + k]);
      max[k] = Math.max(max[k], p[i + k]);
    }
  }
  if (!Number.isFinite(min[0])) return [...obj.position] as Vec3;
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}

/** Cara y U/V para que el diseño quede centrado en `point` (normal de mundo `normal`). */
export function placementFromHit(center: Vec3, point: Vec3, normal: Vec3): SurfacePlacement {
  const [cx, cy, cz] = center;
  const [px, py, pz] = point;
  const abs = normal.map(Math.abs);
  const k = abs[0] >= abs[1] && abs[0] >= abs[2] ? 0 : abs[1] >= abs[2] ? 1 : 2;
  const positive = normal[k] >= 0;
  let axis: SurfacePlacement['axis'];
  let u: number;
  let v: number;
  if (k === 2) {
    axis = positive ? '+z' : '-z';
    u = positive ? px - cx : cx - px;
    v = py - cy;
  } else if (k === 0) {
    axis = positive ? '+x' : '-x';
    u = positive ? cz - pz : pz - cz;
    v = py - cy;
  } else {
    axis = positive ? '+y' : '-y';
    u = px - cx;
    v = positive ? cz - pz : pz - cz;
  }
  return { axis, offsetU: round1(u), offsetV: round1(v) };
}
