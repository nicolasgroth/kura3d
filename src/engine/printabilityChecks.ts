/**
 * @file src/engine/printabilityChecks.ts
 * @description Mediciones del informe de imprimibilidad sobre la malla en mundo: voladizo
 * ponderado por área, espesor local por rayos hacia la superficie opuesta (muestreo por área) y
 * detección de curvatura facetada por ángulo diedro entre caras vecinas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { OrientableMesh } from './meshOrientation';

/** Normal unitaria y área de cada triángulo (normal multiplicada por `sign`). */
export interface FaceGeometry {
  normals: Float64Array;
  areas: Float64Array;
  totalArea: number;
}

/** Calcula normal unitaria y área por triángulo; `sign = -1` corrige mallas con normales invertidas. */
export function faceGeometry(mesh: OrientableMesh, sign = 1): FaceGeometry {
  const p = mesh.positions;
  const idx = mesh.indices;
  const triCount = Math.floor(idx.length / 3);
  const normals = new Float64Array(triCount * 3);
  const areas = new Float64Array(triCount);
  let totalArea = 0;
  for (let t = 0; t < triCount; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
    const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    areas[t] = len / 2;
    totalArea += len / 2;
    if (len > 1e-12) {
      normals[t * 3] = (sign * nx) / len;
      normals[t * 3 + 1] = (sign * ny) / len;
      normals[t * 3 + 2] = (sign * nz) / len;
    }
  }
  return { normals, areas, totalArea };
}

/** Caras en voladizo (normal descendente más allá del ángulo) y su área, excluyendo la base apoyada. */
export function measureOverhang(
  mesh: OrientableMesh,
  geo: FaceGeometry,
  overhangAngleDeg: number,
  minY: number,
): { faceIndices: number[]; areaMm2: number } {
  const nyThreshold = -Math.cos((overhangAngleDeg * Math.PI) / 180);
  const baseCutoffY = minY + 0.2;
  const p = mesh.positions;
  const idx = mesh.indices;
  const faceIndices: number[] = [];
  let areaMm2 = 0;
  for (let t = 0; t < geo.areas.length; t++) {
    const y0 = p[idx[t * 3] * 3 + 1], y1 = p[idx[t * 3 + 1] * 3 + 1], y2 = p[idx[t * 3 + 2] * 3 + 1];
    if (y0 <= baseCutoffY && y1 <= baseCutoffY && y2 <= baseCutoffY) continue;
    if (geo.areas[t] > 1e-12 && geo.normals[t * 3 + 1] < nyThreshold) {
      faceIndices.push(t);
      areaMm2 += geo.areas[t];
    }
  }
  return { faceIndices, areaMm2 };
}

/** Resultado del muestreo de espesor. */
export interface ThicknessSample {
  /** Espesor mínimo medido entre las muestras (mm); `Infinity` si ningún rayo encontró la cara opuesta. */
  minThicknessMm: number;
  /** Porcentaje del área muestreada con espesor menor que `minWallMm`. */
  thinAreaPercent: number;
  samples: number;
}

/** Presupuesto de pruebas rayo–triángulo (rayos × triángulos) para acotar el costo. */
const RAY_TEST_BUDGET = 6_000_000;
const MAX_SAMPLES = 256;
const MIN_SAMPLES = 24;

/**
 * Mide el espesor local disparando, desde puntos repartidos por área, un rayo hacia dentro
 * (opuesto a la normal) hasta la primera cara que encuentra (Möller–Trumbore). Es un muestreo:
 * detecta placas, paredes y pines delgados sin pretender exactitud en cada punto.
 */
export function sampleWallThickness(mesh: OrientableMesh, geo: FaceGeometry, minWallMm: number): ThicknessSample {
  const triCount = geo.areas.length;
  if (triCount === 0 || geo.totalArea <= 0 || minWallMm <= 0) {
    return { minThicknessMm: Infinity, thinAreaPercent: 0, samples: 0 };
  }
  const samples = Math.max(MIN_SAMPLES, Math.min(MAX_SAMPLES, Math.floor(RAY_TEST_BUDGET / triCount)));
  const p = mesh.positions;
  const idx = mesh.indices;
  const cumulative = new Float64Array(triCount);
  let acc = 0;
  for (let t = 0; t < triCount; t++) {
    acc += geo.areas[t];
    cumulative[t] = acc;
  }

  let minThickness = Infinity;
  let thin = 0;
  let measured = 0;
  const golden = 0.6180339887498949;
  for (let s = 0; s < samples; s++) {
    const target = ((s + 0.5) / samples) * acc;
    let lo = 0, hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const t = lo;
    if (geo.areas[t] <= 1e-12) continue;
    // Punto interior del triángulo con baricéntricas de baja discrepancia (lejos de las aristas).
    let u = 0.15 + 0.7 * ((s * golden) % 1);
    let v = 0.15 + 0.7 * ((s * golden * golden) % 1);
    if (u + v > 0.85) { u = 0.85 - u * 0.5; v = 0.85 - v * 0.5; }
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const w = 1 - u - v;
    const ox = w * p[a] + u * p[b] + v * p[c];
    const oy = w * p[a + 1] + u * p[b + 1] + v * p[c + 1];
    const oz = w * p[a + 2] + u * p[b + 2] + v * p[c + 2];
    const dx = -geo.normals[t * 3], dy = -geo.normals[t * 3 + 1], dz = -geo.normals[t * 3 + 2];
    const hit = firstHit(p, idx, triCount, t, ox, oy, oz, dx, dy, dz);
    if (!Number.isFinite(hit)) continue;
    measured++;
    if (hit < minThickness) minThickness = hit;
    if (hit < minWallMm) thin++;
  }
  return {
    minThicknessMm: minThickness,
    thinAreaPercent: measured > 0 ? (thin / measured) * 100 : 0,
    samples: measured,
  };
}

/** Distancia al primer triángulo (distinto de `skip`) que corta el rayo; `Infinity` si ninguno. */
function firstHit(
  p: ArrayLike<number>, idx: ArrayLike<number>, triCount: number, skip: number,
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
): number {
  let best = Infinity;
  const eps = 1e-9;
  for (let t = 0; t < triCount; t++) {
    if (t === skip) continue;
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
    const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -eps && det < eps) continue;
    const invDet = 1 / det;
    const tx = ox - p[a], ty = oy - p[a + 1], tz = oz - p[a + 2];
    const u = (tx * px + ty * py + tz * pz) * invDet;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * invDet;
    if (v < 0 || u + v > 1) continue;
    const dist = (e2x * qx + e2y * qy + e2z * qz) * invDet;
    if (dist > 1e-4 && dist < best) best = dist;
  }
  return best;
}

/** Ángulos diedros (grados) que se consideran facetado visible de una superficie curva. */
const FACET_MIN_DEG = 12;
const FACET_MAX_DEG = 40;

/**
 * Indica si la malla tiene curvatura facetada: aristas entre caras vecinas con un ángulo diedro
 * de 12° a 40° que suman al menos el 30 % del largo de las aristas no coplanares (y al menos 12
 * aristas). Un cubo o una caja (solo 0° y 90°) no la tienen; una esfera de pocos segmentos sí.
 */
export function hasFacetedCurvature(mesh: OrientableMesh, geo: FaceGeometry): boolean {
  const p = mesh.positions;
  const idx = mesh.indices;
  const triCount = geo.areas.length;
  const inv = 1e5;
  const weld = new Map<string, number>();
  const vid = (i: number) => {
    const key = `${Math.round(p[i * 3] * inv)},${Math.round(p[i * 3 + 1] * inv)},${Math.round(p[i * 3 + 2] * inv)}`;
    let id = weld.get(key);
    if (id === undefined) { id = weld.size; weld.set(key, id); }
    return id;
  };
  const welded = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) welded[i] = vid(idx[i]);
  const n = weld.size;
  const firstFace = new Map<number, number>();
  const cosMin = Math.cos((FACET_MIN_DEG * Math.PI) / 180);
  const cosMax = Math.cos((FACET_MAX_DEG * Math.PI) / 180);
  const cosFlat = Math.cos((1 * Math.PI) / 180);
  let facetLen = 0, creaseLen = 0, facetEdges = 0;
  for (let t = 0; t < triCount; t++) {
    for (let e = 0; e < 3; e++) {
      const i0 = idx[t * 3 + e], i1 = idx[t * 3 + ((e + 1) % 3)];
      const u = welded[t * 3 + e], v = welded[t * 3 + ((e + 1) % 3)];
      if (u === v) continue;
      const key = u < v ? u * n + v : v * n + u;
      const other = firstFace.get(key);
      if (other === undefined) { firstFace.set(key, t); continue; }
      const cos =
        geo.normals[t * 3] * geo.normals[other * 3] +
        geo.normals[t * 3 + 1] * geo.normals[other * 3 + 1] +
        geo.normals[t * 3 + 2] * geo.normals[other * 3 + 2];
      if (cos >= cosFlat) continue;
      const len = Math.hypot(p[i1 * 3] - p[i0 * 3], p[i1 * 3 + 1] - p[i0 * 3 + 1], p[i1 * 3 + 2] - p[i0 * 3 + 2]);
      creaseLen += len;
      if (cos <= cosMin && cos >= cosMax) { facetLen += len; facetEdges++; }
    }
  }
  return facetEdges >= 12 && creaseLen > 0 && facetLen / creaseLen >= 0.3;
}
