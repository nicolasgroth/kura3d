/**
 * @file src/engine/jointRays.ts
 * @description Rayos paralelos a un eje contra una malla cerrada de manifold-3d, para medir cuánto
 * material hay a lo largo del eje de un conector en cada mitad de una unión. Un rayo que parte dentro
 * del sólido sale por el primer triángulo que cruza: esa distancia es el material disponible. Como el
 * rayo es paralelo a un eje basta un test 2D de punto en triángulo sobre los otros dos ejes y la
 * interpolación baricéntrica de la coordenada del eje (sin dependencias).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import type { Vec3 } from '../types/kura';

/** Triángulos de una malla listos para rayos por eje. */
export class AxisRayMesh {
  private readonly v: Float32Array;
  private readonly stride: number;
  private readonly tri: Uint32Array;

  constructor(m: Manifold) {
    const mesh = m.getMesh();
    this.v = mesh.vertProperties;
    this.stride = mesh.numProp;
    this.tri = mesh.triVerts;
  }

  /**
   * Distancia desde `origin` hasta el primer cruce con la malla a lo largo del eje `axis` en el sentido
   * `sign` (solo cruces a más de `minT`). `Infinity` si no cruza nada (el origen está fuera).
   */
  exit(origin: Vec3, axis: 0 | 1 | 2, sign: 1 | -1, minT = 1e-4): number {
    const a = axis;
    const b = (axis + 1) % 3;
    const c = (axis + 2) % 3;
    const pb = origin[b], pc = origin[c];
    const { v, stride: s, tri } = this;
    let best = Infinity;
    for (let t = 0; t < tri.length; t += 3) {
      const i0 = tri[t] * s, i1 = tri[t + 1] * s, i2 = tri[t + 2] * s;
      const b0 = v[i0 + b], b1 = v[i1 + b], b2 = v[i2 + b];
      if ((b0 < pb && b1 < pb && b2 < pb) || (b0 > pb && b1 > pb && b2 > pb)) continue;
      const c0 = v[i0 + c], c1 = v[i1 + c], c2 = v[i2 + c];
      if ((c0 < pc && c1 < pc && c2 < pc) || (c0 > pc && c1 > pc && c2 > pc)) continue;
      // Baricéntricas en el plano (b, c)
      const den = (b1 - b0) * (c2 - c0) - (b2 - b0) * (c1 - c0);
      if (Math.abs(den) < 1e-14) continue;
      const w1 = ((pb - b0) * (c2 - c0) - (b2 - b0) * (pc - c0)) / den;
      const w2 = ((b1 - b0) * (pc - c0) - (pb - b0) * (c1 - c0)) / den;
      const w0 = 1 - w1 - w2;
      if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
      const hit = w0 * v[i0 + a] + w1 * v[i1 + a] + w2 * v[i2 + a];
      const d = (hit - origin[a]) * sign;
      if (d > minT && d < best) best = d;
    }
    return best;
  }
}

/**
 * Material disponible a lo largo del eje desde un conector de centro `center` (sobre el plano): el
 * mínimo entre el rayo del centro y cuatro rayos en el anillo de radio `ringMm` (los ejes radiales).
 */
export function materialAlongAxis(mesh: AxisRayMesh, center: Vec3, axis: 0 | 1 | 2, sign: 1 | -1, ringMm: number): number {
  const b = (axis + 1) % 3;
  const c = (axis + 2) % 3;
  let best = mesh.exit(center, axis, sign);
  for (const [db, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const p = [...center] as Vec3;
    p[b] += db * ringMm;
    p[c] += dc * ringMm;
    best = Math.min(best, mesh.exit(p, axis, sign));
  }
  return best;
}
