/**
 * @file src/core/addons/__tests__/surfaceNormalLegacy.ts
 * @description Copia de referencia de la normal de superficie anterior (recorre la malla completa tres veces). Solo
 * para pruebas: la versión con índice espacial debe dar exactamente el mismo resultado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { MeshData, SceneObject, Vec3 } from '../../../types/kura';

/** Caras más inclinadas que esto respecto de la tocada son otra cara (un borde, una pared): no se promedian. */
const SURFACE_NORMAL_MAX_ANGLE_DEG = 35;
/** Bajo este desvío (en coseno) todas las normales son la misma: cara plana. */
const SAME_NORMAL = 1 - 1e-10;
/** El parche abarca al menos este múltiplo de la arista más larga de las facetas cercanas. */
const EDGE_REACH = 1.5;

type Mesh = Pick<MeshData, 'positions' | 'indices'>;

const sub = (p: ArrayLike<number>, i: number, q: Vec3): Vec3 => [p[i] - q[0], p[i + 1] - q[1], p[i + 2] - q[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Triángulo que contiene el punto (el más cercano a su plano entre los que lo contienen); −1 si ninguno. */
function containingTriangle(p: ArrayLike<number>, idx: ArrayLike<number>, point: Vec3): number {
  let best = -1, bestDist = Infinity;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a: Vec3 = [p[idx[t] * 3], p[idx[t] * 3 + 1], p[idx[t] * 3 + 2]];
    const e1 = sub(p, idx[t + 1] * 3, a), e2 = sub(p, idx[t + 2] * 3, a);
    const n = cross(e1, e2);
    const n2 = dot(n, n);
    if (!(n2 > 1e-24)) continue;
    const w: Vec3 = [point[0] - a[0], point[1] - a[1], point[2] - a[2]];
    const dist = Math.abs(dot(w, n)) / Math.sqrt(n2);
    if (dist >= bestDist) continue;
    const u = dot(cross(w, e2), n) / n2, v = dot(cross(e1, w), n) / n2;
    if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) { best = t / 3; bestDist = dist; }
  }
  return best;
}

/**
 * Normal de la superficie (misma orientación que `faceNormal`, unitaria) en el espacio de la malla dada, o `null` si
 * en el radio todas las normales aceptadas coinciden con `faceNormal` (cara plana: no cambia nada).
 */
export function legacyAveragedSurfaceNormal(mesh: Mesh, point: Vec3, faceNormal: Vec3, radius: number, maxAngleDeg = SURFACE_NORMAL_MAX_ANGLE_DEG): Vec3 | null {
  const p = mesh.positions, idx = mesh.indices;
  const fl = Math.hypot(...faceNormal);
  if (!(fl > 0) || !(radius > 0)) return null;
  const f: Vec3 = [faceNormal[0] / fl, faceNormal[1] / fl, faceNormal[2] / fl];
  const hit = containingTriangle(p, idx, point);
  if (hit < 0) return null;
  const corners = [0, 1, 2].map((k) => idx[hit * 3 + k] * 3);
  const verts = corners.map((i) => [p[i], p[i + 1], p[i + 2]] as Vec3);
  let edge = 0;
  for (let k = 0; k < 3; k++) {
    const a = verts[k], b = verts[(k + 1) % 3];
    edge = Math.max(edge, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  // Facetas del tamaño del radio darían un parche dentado: el radio abarca al menos unas facetas.
  const reach = Math.max(radius, EDGE_REACH * edge);
  const r2 = reach * reach;
  const minCos = Math.cos((maxAngleDeg * Math.PI) / 180);
  let curved = false;
  /** Suma ponderada de normales de cara cerca de cada vértice, aceptando las que están a menos del ángulo de `ref[k]`. */
  const vertexSums = (ref: Vec3[]): Vec3[] => {
    const sums: Vec3[] = verts.map(() => [0, 0, 0]);
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
      const d2 = verts.map((v) => (cx - v[0]) ** 2 + (cy - v[1]) ** 2 + (cz - v[2]) ** 2);
      if (d2.every((d) => d > r2)) continue;
      // Producto cruz: dirección de la normal y largo = 2·área (ya pondera por área).
      let n = cross(sub(p, b, [p[a], p[a + 1], p[a + 2]]), sub(p, c, [p[a], p[a + 1], p[a + 2]]));
      const len = Math.hypot(...n);
      if (!(len > 1e-18)) continue;
      // Una malla con caras invertidas: se alinea con la cara tocada.
      if (dot(n, f) < 0) n = [-n[0], -n[1], -n[2]];
      for (let k = 0; k < 3; k++) {
        if (d2[k] > r2) continue;
        const cos = dot(n, ref[k]) / len;
        if (cos < minCos) continue;
        if (cos < SAME_NORMAL) curved = true;
        // Peso suave por distancia: el borde del parche casi no cuenta.
        const w = (1 - d2[k] / r2) ** 2;
        sums[k][0] += n[0] * w; sums[k][1] += n[1] * w; sums[k][2] += n[2] * w;
      }
    }
    return sums;
  };
  const unitOr = (v: Vec3, fallback: Vec3): Vec3 => { const l = Math.hypot(...v); return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : fallback; };
  // Primera pasada contra la cara tocada; la segunda filtra contra la normal de cada vértice (el corte por ángulo
  // queda simétrico alrededor del vértice y no inclina el promedio hacia la faceta tocada).
  const first = vertexSums([f, f, f]).map((v) => unitOr(v, f));
  curved = false;
  const sums = vertexSums(first);
  if (!curved) return null;
  // Coordenadas baricéntricas del punto en el triángulo tocado.
  const e1 = sub(p, corners[1], verts[0]), e2 = sub(p, corners[2], verts[0]);
  const n = cross(e1, e2), n2 = dot(n, n);
  const w: Vec3 = [point[0] - verts[0][0], point[1] - verts[0][1], point[2] - verts[0][2]];
  const u = dot(cross(w, e2), n) / n2, v = dot(cross(e1, w), n) / n2;
  const bary = [1 - u - v, u, v];
  const out: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const l = Math.hypot(...sums[k]);
    if (!(l > 0)) continue;
    for (let j = 0; j < 3; j++) out[j] += (bary[k] * sums[k][j]) / l;
  }
  const l = Math.hypot(...out);
  return l > 0 ? [out[0] / l, out[1] / l, out[2] / l] : null;
}

/**
 * Lo mismo para una pieza con su transformación, con punto y normal de mundo: se trabaja en la malla local (sin
 * copiar la malla) y la normal vuelve a mundo con la inversa transpuesta (R·S⁻¹·n). `null` si no cambia.
 */
export function legacyWorldSurfaceNormal(
  obj: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>, worldPoint: Vec3, worldNormal: Vec3, radiusMm: number,
): Vec3 | null {
  const s = obj.scale;
  if (s.some((v) => v === 0)) return null;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ'));
  const inv = q.clone().invert();
  const lp = new THREE.Vector3(...worldPoint).sub(new THREE.Vector3(...obj.position)).applyQuaternion(inv);
  lp.set(lp.x / s[0], lp.y / s[1], lp.z / s[2]);
  // Normal de mundo a local: n_local ∝ S·Rᵀ·n_mundo.
  const ln = new THREE.Vector3(...worldNormal).applyQuaternion(inv);
  ln.set(ln.x * s[0], ln.y * s[1], ln.z * s[2]);
  const minScale = Math.min(...s.map(Math.abs));
  const local = legacyAveragedSurfaceNormal(obj.mesh, [lp.x, lp.y, lp.z], [ln.x, ln.y, ln.z], radiusMm / minScale);
  if (!local) return null;
  const n = new THREE.Vector3(local[0] / s[0], local[1] / s[1], local[2] / s[2]).applyQuaternion(q).normalize();
  return [n.x, n.y, n.z];
}
