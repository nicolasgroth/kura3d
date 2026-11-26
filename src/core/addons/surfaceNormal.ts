/**
 * @file src/core/addons/surfaceNormal.ts
 * @description Normal de la superficie (no de la faceta) donde se coloca un agregado. En una esfera facetada la
 * faceta bajo el cursor puede estar inclinada varios grados (en el polo de la esfera r20, ~8°). Se calcula así:
 *   1. normal de cada vértice del triángulo tocado = promedio por área, con peso suave por distancia, de las caras
 *      a menos de un radio del vértice (del orden del agregado, y al menos unas facetas) cuya normal no se aparta
 *      más de un ángulo de la cara tocada (un borde o una pared vecina no cuentan);
 *   2. interpolación baricéntrica de esas tres normales en el punto (sombreado de Phong).
 * Promediar solo en un disco alrededor del punto deja una inclinación de 1–2° por el borde dentado del parche; la
 * interpolación la corrige. En una cara plana todas las normales coinciden y se devuelve `null`: el que llama
 * conserva la de la cara tal cual (sin ruido de redondeo).
 * Corre en cada `pointermove` del visor: usa el triángulo del raycast y un índice espacial por malla
 * (`centroidGrid.ts`), así el costo no crece con el tamaño de la malla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { centroidGridOf, trianglesNearBox } from './centroidGrid';

/** Radio por defecto (mm) si el agregado no da el suyo: el de un imán o poste chico. */
export const SURFACE_NORMAL_DEFAULT_RADIUS_MM = 3;
/** Caras más inclinadas que esto respecto de la tocada son otra cara (un borde, una pared): no se promedian. */
export const SURFACE_NORMAL_MAX_ANGLE_DEG = 35;
/** Bajo este desvío (en coseno) todas las normales son la misma: cara plana. */
const SAME_NORMAL = 1 - 1e-10;
/** El parche abarca al menos este múltiplo de la arista más larga de las facetas cercanas. */
const EDGE_REACH = 1.5;

type Mesh = Pick<MeshData, 'positions' | 'indices'>;

const sub = (p: ArrayLike<number>, i: number, q: Vec3): Vec3 => [p[i] - q[0], p[i + 1] - q[1], p[i + 2] - q[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Triángulo que contiene el punto (el más cercano a su plano entre los candidatos que lo contienen); −1 si ninguno.
 * `candidates` limita la búsqueda a esos triángulos (índice de triángulo); sin él recorre la malla completa.
 */
function containingTriangle(p: ArrayLike<number>, idx: ArrayLike<number>, point: Vec3, candidates?: ArrayLike<number>): number {
  let best = -1, bestDist = Infinity;
  const count = candidates ? candidates.length : Math.floor(idx.length / 3);
  for (let j = 0; j < count; j++) {
    const tri = candidates ? candidates[j] : j;
    const t = tri * 3;
    const a: Vec3 = [p[idx[t] * 3], p[idx[t] * 3 + 1], p[idx[t] * 3 + 2]];
    const e1 = sub(p, idx[t + 1] * 3, a), e2 = sub(p, idx[t + 2] * 3, a);
    const n = cross(e1, e2);
    const n2 = dot(n, n);
    if (!(n2 > 1e-24)) continue;
    const w: Vec3 = [point[0] - a[0], point[1] - a[1], point[2] - a[2]];
    const dist = Math.abs(dot(w, n)) / Math.sqrt(n2);
    if (dist >= bestDist) continue;
    const u = dot(cross(w, e2), n) / n2, v = dot(cross(e1, w), n) / n2;
    if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) { best = tri; bestDist = dist; }
  }
  return best;
}

/**
 * Respaldo sin `hitFace`: busca el triángulo que contiene el punto con la grilla de baricentros, en cajas cada vez
 * mayores alrededor del punto (un triángulo que lo contiene tiene su baricentro a lo sumo a una arista de él). Para
 * en la primera caja que lo encuentra; si ninguna lo encuentra, la última cubre toda la grilla, igual que recorrer
 * la malla. Con capas superpuestas a distancias parecidas gana la más cercana de entre las vecinas de la caja.
 */
function containingTriangleIndexed(mesh: Mesh, point: Vec3): number {
  const grid = centroidGridOf(mesh);
  const span = Math.max(grid.dims[0], grid.dims[1], grid.dims[2]) * grid.cell;
  for (let reach = grid.cell * 2; ; reach *= 4) {
    const covers = reach >= span * 2;
    const box = (sign: number) => [0, 1, 2].map((k) => point[k] + sign * (covers ? span * 2 + Math.abs(point[k] - grid.origin[k]) : reach));
    const found = containingTriangle(mesh.positions, mesh.indices, point, trianglesNearBox(grid, box(-1), box(1)));
    if (found >= 0 || covers) return found;
  }
}

/** El triángulo del raycast, si es válido (existe y no es degenerado); si no, −1. */
function validHit(p: ArrayLike<number>, idx: ArrayLike<number>, face: number | undefined): number {
  if (face == null || !Number.isInteger(face) || face < 0 || face * 3 + 2 >= idx.length) return -1;
  const t = face * 3;
  const a: Vec3 = [p[idx[t] * 3], p[idx[t] * 3 + 1], p[idx[t] * 3 + 2]];
  const n = cross(sub(p, idx[t + 1] * 3, a), sub(p, idx[t + 2] * 3, a));
  return dot(n, n) > 1e-24 ? face : -1;
}

/**
 * Normal de la superficie (misma orientación que `faceNormal`, unitaria) en el espacio de la malla dada, o `null` si
 * en el radio todas las normales aceptadas coinciden con `faceNormal` (cara plana: no cambia nada). `hitFace` es el
 * triángulo que tocó el raycast (el visor lo trae); sin él se busca el que contiene el punto recorriendo la malla.
 * Las caras cercanas salen de un índice espacial cacheado por malla: el costo por consulta depende de la vecindad,
 * no del tamaño de la malla.
 */
export function averagedSurfaceNormal(
  mesh: Mesh, point: Vec3, faceNormal: Vec3, radius: number, maxAngleDeg = SURFACE_NORMAL_MAX_ANGLE_DEG, hitFace?: number,
): Vec3 | null {
  const p = mesh.positions, idx = mesh.indices;
  const fl = Math.hypot(...faceNormal);
  if (!(fl > 0) || !(radius > 0)) return null;
  const f: Vec3 = [faceNormal[0] / fl, faceNormal[1] / fl, faceNormal[2] / fl];
  let hit = validHit(p, idx, hitFace);
  if (hit < 0) hit = containingTriangleIndexed(mesh, point);
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
  // Candidatas: baricentros en la caja de los tres vértices ampliada en el alcance (con holgura de redondeo).
  const margin = reach * (1 + 1e-9) + 1e-12;
  const boxMin = [0, 1, 2].map((k) => Math.min(verts[0][k], verts[1][k], verts[2][k]) - margin);
  const boxMax = [0, 1, 2].map((k) => Math.max(verts[0][k], verts[1][k], verts[2][k]) + margin);
  const near = trianglesNearBox(centroidGridOf(mesh), boxMin, boxMax);
  const [v0x, v0y, v0z] = verts[0], [v1x, v1y, v1z] = verts[1], [v2x, v2y, v2z] = verts[2];
  // Una sola lectura de la malla: por cada cara aceptada se guardan sus distancias a los vértices y su normal
  // (largo = 2·área, ya pondera por área), y las dos pasadas recorren solo eso.
  const faces = new Float64Array(near.length * 7);
  let count = 0;
  for (let j = 0; j < near.length; j++) {
    const t = near[j] * 3;
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
    const d0 = (cx - v0x) ** 2 + (cy - v0y) ** 2 + (cz - v0z) ** 2;
    const d1 = (cx - v1x) ** 2 + (cy - v1y) ** 2 + (cz - v1z) ** 2;
    const d2 = (cx - v2x) ** 2 + (cy - v2y) ** 2 + (cz - v2z) ** 2;
    if (d0 > r2 && d1 > r2 && d2 > r2) continue;
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
    const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (!(len > 1e-18)) continue;
    // Una malla con caras invertidas: se alinea con la cara tocada.
    if (nx * f[0] + ny * f[1] + nz * f[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const o = count++ * 7;
    faces[o] = d0; faces[o + 1] = d1; faces[o + 2] = d2; faces[o + 3] = nx; faces[o + 4] = ny; faces[o + 5] = nz; faces[o + 6] = len;
  }
  let curved = false;
  const sums = new Float64Array(9);
  /** Suma ponderada de normales de cara cerca de cada vértice, aceptando las que están a menos del ángulo de `ref`. */
  const vertexSums = (ref: Float64Array): void => {
    sums.fill(0);
    for (let o = 0; o < count * 7; o += 7) {
      const nx = faces[o + 3], ny = faces[o + 4], nz = faces[o + 5], len = faces[o + 6];
      for (let k = 0; k < 3; k++) {
        const dk = faces[o + k];
        if (dk > r2) continue;
        const cos = (nx * ref[k * 3] + ny * ref[k * 3 + 1] + nz * ref[k * 3 + 2]) / len;
        if (cos < minCos) continue;
        if (cos < SAME_NORMAL) curved = true;
        // Peso suave por distancia: el borde del parche casi no cuenta.
        const w = (1 - dk / r2) ** 2;
        sums[k * 3] += nx * w; sums[k * 3 + 1] += ny * w; sums[k * 3 + 2] += nz * w;
      }
    }
  };
  // Primera pasada contra la cara tocada; la segunda filtra contra la normal de cada vértice (el corte por ángulo
  // queda simétrico alrededor del vértice y no inclina el promedio hacia la faceta tocada).
  vertexSums(Float64Array.of(f[0], f[1], f[2], f[0], f[1], f[2], f[0], f[1], f[2]));
  const first = new Float64Array(9);
  for (let k = 0; k < 3; k++) {
    const sx = sums[k * 3], sy = sums[k * 3 + 1], sz = sums[k * 3 + 2];
    const l = Math.hypot(sx, sy, sz);
    if (l > 0) { first[k * 3] = sx / l; first[k * 3 + 1] = sy / l; first[k * 3 + 2] = sz / l; }
    else { first[k * 3] = f[0]; first[k * 3 + 1] = f[1]; first[k * 3 + 2] = f[2]; }
  }
  curved = false;
  vertexSums(first);
  if (!curved) return null;
  // Coordenadas baricéntricas del punto en el triángulo tocado.
  const e1 = sub(p, corners[1], verts[0]), e2 = sub(p, corners[2], verts[0]);
  const n = cross(e1, e2), n2 = dot(n, n);
  const w: Vec3 = [point[0] - verts[0][0], point[1] - verts[0][1], point[2] - verts[0][2]];
  const u = dot(cross(w, e2), n) / n2, v = dot(cross(e1, w), n) / n2;
  const bary = [1 - u - v, u, v];
  const out: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const l = Math.hypot(sums[k * 3], sums[k * 3 + 1], sums[k * 3 + 2]);
    if (!(l > 0)) continue;
    for (let j = 0; j < 3; j++) out[j] += (bary[k] * sums[k * 3 + j]) / l;
  }
  const l = Math.hypot(...out);
  return l > 0 ? [out[0] / l, out[1] / l, out[2] / l] : null;
}

/**
 * Lo mismo para una pieza con su transformación, con punto y normal de mundo: se trabaja en la malla local (sin
 * copiar la malla) y la normal vuelve a mundo con la inversa transpuesta (R·S⁻¹·n). `null` si no cambia. `hitFace`:
 * el triángulo del raycast, si se conoce.
 */
export function worldSurfaceNormal(
  obj: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>, worldPoint: Vec3, worldNormal: Vec3, radiusMm: number,
  hitFace?: number,
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
  const local = averagedSurfaceNormal(obj.mesh, [lp.x, lp.y, lp.z], [ln.x, ln.y, ln.z], radiusMm / minScale, undefined, hitFace);
  if (!local) return null;
  const n = new THREE.Vector3(local[0] / s[0], local[1] / s[1], local[2] / s[2]).applyQuaternion(q).normalize();
  return [n.x, n.y, n.z];
}
