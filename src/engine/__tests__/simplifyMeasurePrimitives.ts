/**
 * @file src/engine/__tests__/simplifyMeasurePrimitives.ts
 * @description Apoyo de la medición de Simplificar: indicio de cuántos triángulos están en cilindros o esferas
 * reconocibles. Agrupa triángulos no planos en regiones suaves (diedro < 20° entre vecinos), y a cada región de
 * 12+ triángulos le ajusta por mínimos cuadrados algebraicos una esfera (Kåsa 3D) y un cilindro (eje = dirección de
 * menor varianza de las normales; círculo de Kåsa en el plano perpendicular). Acepta si la desviación máxima de los
 * vértices al ajuste es menor que 0,02 mm. Es una cota inferior: una región que mezcla un plano tangente y un
 * redondeo no se parte, se descarta entera. Solo medición: no es código de la app.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import { getFaceAdjacency } from '../paint/faceAdjacency';
import { forEachNeighbor, type PlanarStats } from './simplifyMeasurePlanar';

export const FIT_TOL_MM = 0.02;
const SMOOTH_DEG = 20;
const MIN_TRIS = 12;

export interface PrimitiveStats {
  cylinderTris: number;
  sphereTris: number;
  cylinders: number;
  spheres: number;
  /** Triángulos en regiones suaves que no se ajustaron (orgánico o mezcla). */
  unfitTris: number;
}

export function primitiveStats(mesh: MeshData, planar: PlanarStats): PrimitiveStats {
  const adj = getFaceAdjacency(mesh);
  const N = adj.normals;
  const I = mesh.indices;
  const triCount = I.length / 3;
  const cosSmooth = Math.cos((SMOOTH_DEG * Math.PI) / 180);
  // Lo plano grande (3+ triángulos) no entra; una faceta de 2 triángulos sí (así se ve un cilindro facetado).
  const flat = (t: number) => planar.regionSize[planar.regionOf[t]] > 2;
  const seen = new Uint8Array(triCount);
  const out: PrimitiveStats = { cylinderTris: 0, sphereTris: 0, cylinders: 0, spheres: 0, unfitTris: 0 };
  const stack: number[] = [];
  for (let seed = 0; seed < triCount; seed++) {
    if (seen[seed] || flat(seed)) continue;
    const tris: number[] = [seed];
    seen[seed] = 1;
    stack.push(seed);
    while (stack.length) {
      const t = stack.pop()!;
      forEachNeighbor(adj, t, (u) => {
        if (seen[u] || flat(u)) return;
        if (N[t * 3] * N[u * 3] + N[t * 3 + 1] * N[u * 3 + 1] + N[t * 3 + 2] * N[u * 3 + 2] < cosSmooth) return;
        seen[u] = 1;
        tris.push(u);
        stack.push(u);
      });
    }
    if (tris.length < MIN_TRIS) continue;
    const kind = fitRegion(mesh, N, tris);
    if (kind === 'sphere') {
      out.sphereTris += tris.length;
      out.spheres++;
    } else if (kind === 'cylinder') {
      out.cylinderTris += tris.length;
      out.cylinders++;
    } else out.unfitTris += tris.length;
  }
  return out;
}

function fitRegion(mesh: MeshData, N: Float32Array, tris: number[]): 'sphere' | 'cylinder' | null {
  const P = mesh.positions;
  const I = mesh.indices;
  const ids = new Set<number>();
  for (const t of tris) for (let k = 0; k < 3; k++) ids.add(I[t * 3 + k]);
  const pts = new Float64Array(ids.size * 3);
  let i = 0;
  for (const v of ids) {
    pts[i++] = P[v * 3];
    pts[i++] = P[v * 3 + 1];
    pts[i++] = P[v * 3 + 2];
  }
  // Covarianza de normales (sin centrar): en un cilindro el eje es el autovector de autovalor ~0.
  const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const t of tris) {
    const n = [N[t * 3], N[t * 3 + 1], N[t * 3 + 2]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) M[a * 3 + b] += n[a] * n[b];
  }
  const { values, vectors } = jacobi3(M);
  const trace = values[0] + values[1] + values[2];
  // Casi plano (normales casi paralelas): no es cilindro ni esfera útil.
  if (values[1] / trace < 0.005) return null;
  // Normales en un plano (autovalor menor ~0): candidato a cilindro. Va primero porque los vértices de dos anillos
  // paralelos de un cilindro también caen sobre una esfera.
  if (values[2] / trace < 0.01) return cylinderResidual(pts, vectors[2]) < FIT_TOL_MM ? 'cylinder' : null;
  return sphereResidual(pts) < FIT_TOL_MM ? 'sphere' : null;
}

/** Esfera de Kåsa: x² + y² + z² = 2ax + 2by + 2cz + d. Devuelve la desviación máxima |‖p − c‖ − r|. */
function sphereResidual(pts: Float64Array): number {
  const n = pts.length / 3;
  let mx = 0, my = 0, mz = 0;
  for (let i = 0; i < n; i++) {
    mx += pts[i * 3];
    my += pts[i * 3 + 1];
    mz += pts[i * 3 + 2];
  }
  mx /= n; my /= n; mz /= n;
  const A = new Float64Array(16), B = new Float64Array(4);
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3] - mx, y = pts[i * 3 + 1] - my, z = pts[i * 3 + 2] - mz;
    const row = [2 * x, 2 * y, 2 * z, 1], rhs = x * x + y * y + z * z;
    for (let a = 0; a < 4; a++) {
      B[a] += row[a] * rhs;
      for (let b = 0; b < 4; b++) A[a * 4 + b] += row[a] * row[b];
    }
  }
  const s = solve(A, B, 4);
  if (!s) return Infinity;
  const r = Math.sqrt(s[3] + s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
  if (!Number.isFinite(r) || r > 1e4) return Infinity;
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(pts[i * 3] - mx - s[0], pts[i * 3 + 1] - my - s[1], pts[i * 3 + 2] - mz - s[2]);
    worst = Math.max(worst, Math.abs(d - r));
  }
  return worst;
}

/** Cilindro de eje `axis`: círculo de Kåsa sobre la proyección en el plano perpendicular. */
function cylinderResidual(pts: Float64Array, axis: number[]): number {
  const [ax, ay, az] = axis;
  const ref = Math.abs(ax) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let ux = ay * ref[2] - az * ref[1], uy = az * ref[0] - ax * ref[2], uz = ax * ref[1] - ay * ref[0];
  const ul = Math.hypot(ux, uy, uz);
  ux /= ul; uy /= ul; uz /= ul;
  const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
  const n = pts.length / 3;
  const xs = new Float64Array(n), ys = new Float64Array(n);
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) {
    const px = pts[i * 3], py = pts[i * 3 + 1], pz = pts[i * 3 + 2];
    xs[i] = px * ux + py * uy + pz * uz;
    ys[i] = px * vx + py * vy + pz * vz;
    mx += xs[i];
    my += ys[i];
  }
  mx /= n; my /= n;
  const A = new Float64Array(9), B = new Float64Array(3);
  for (let i = 0; i < n; i++) {
    const x = xs[i] - mx, y = ys[i] - my;
    const row = [2 * x, 2 * y, 1], rhs = x * x + y * y;
    for (let a = 0; a < 3; a++) {
      B[a] += row[a] * rhs;
      for (let b = 0; b < 3; b++) A[a * 3 + b] += row[a] * row[b];
    }
  }
  const s = solve(A, B, 3);
  if (!s) return Infinity;
  const r = Math.sqrt(s[2] + s[0] * s[0] + s[1] * s[1]);
  if (!Number.isFinite(r) || r > 1e4) return Infinity;
  let worst = 0;
  for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(Math.hypot(xs[i] - mx - s[0], ys[i] - my - s[1]) - r));
  return worst;
}

/** Gauss con pivoteo parcial; `null` si es singular. */
function solve(A: Float64Array, B: Float64Array, n: number): number[] | null {
  const m = Array.from({ length: n }, (_, r) => [...Array.from(A.subarray(r * n, r * n + n)), B[r]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, r) => row[n] / row[r]);
}

/** Autovalores (descendentes) y autovectores de una matriz simétrica 3×3 por Jacobi. */
function jacobi3(M: number[]): { values: number[]; vectors: number[][] } {
  const a = [...M];
  const v = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = a[1] * a[1] + a[2] * a[2] + a[5] * a[5];
    if (off < 1e-24) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = a[p * 3 + q];
      if (Math.abs(apq) < 1e-30) continue;
      const theta = (a[q * 3 + q] - a[p * 3 + p]) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k * 3 + p], akq = a[k * 3 + q];
        a[k * 3 + p] = c * akp - s * akq;
        a[k * 3 + q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p * 3 + k], aqk = a[q * 3 + k];
        a[p * 3 + k] = c * apk - s * aqk;
        a[q * 3 + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k * 3 + p], vkq = v[k * 3 + q];
        v[k * 3 + p] = c * vkp - s * vkq;
        v[k * 3 + q] = s * vkp + c * vkq;
      }
    }
  }
  const order = [0, 1, 2].sort((x, y) => a[y * 4] - a[x * 4]);
  return {
    values: order.map((k) => a[k * 4]),
    vectors: order.map((k) => [v[k], v[3 + k], v[6 + k]]),
  };
}
