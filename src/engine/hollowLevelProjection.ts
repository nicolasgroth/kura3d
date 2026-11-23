/**
 * @file src/engine/hollowLevelProjection.ts
 * @description Proyección de los vértices de la superficie interior del ahuecado a la isosuperficie
 * exacta `d = nivel` de la distancia con signo. `Manifold.levelSet` ubica cada vértice interpolando
 * linealmente la distancia en una arista de la grilla; con grilla gruesa (pieza grande, presupuesto de
 * muestras fijo) ese vértice queda hasta ~arista²/(8·R) fuera del nivel y el margen que lo compensa
 * engrosaba toda la pared (mediana 3 mm pedidos 2 en una pieza de ~150 mm). Aquí cada vértice da pasos
 * de Newton sobre la distancia exacta (gradiente por diferencias centrales), acotados a una fracción de
 * la arista para no plegar la malla: la topología no cambia (`warpBatch`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import { deleteOnThrow, useThenDelete } from './wasmScope';
import type { MeshDistanceField } from './meshDistance';

/** Pasos de Newton por vértice. */
const STEPS = 2;
/** Desplazamiento máximo total de un vértice, en aristas de grilla. */
const MAX_SHIFT_EDGES = 0.5;

/**
 * Proyector de puntos a la distancia `target` (por punto) de la superficie: pasos de Newton sobre la
 * distancia exacta, desplazamiento total acotado. Escribe en `v[o..o+2]`.
 */
function pointProjector(field: MeshDistanceField, edge: number, maxLevel: number) {
  const h = edge * 0.02;
  const maxShift = edge * MAX_SHIFT_EDGES;
  const cap = maxLevel + 2 * edge;
  const d = (x: number, y: number, z: number) => field.boundedSignedDistance(x, y, z, cap);
  return (v: Float64Array | Float32Array, o: number, target: number): void => {
    const x0 = v[o], y0 = v[o + 1], z0 = v[o + 2];
    let x = x0, y = y0, z = z0;
    for (let s = 0; s < STEPS; s++) {
      const f = d(x, y, z) - target;
      if (Math.abs(f) < 1e-5) break;
      const gx = (d(x + h, y, z) - d(x - h, y, z)) / (2 * h);
      const gy = (d(x, y + h, z) - d(x, y - h, z)) / (2 * h);
      const gz = (d(x, y, z + h) - d(x, y, z - h)) / (2 * h);
      const g2 = gx * gx + gy * gy + gz * gz;
      // Lejos de |∇d| = 1 (eje medial, crestas): no hay dirección fiable y el paso podría plegar la malla
      if (g2 < 0.81 || g2 > 1.21) break;
      x -= (f * gx) / g2;
      y -= (f * gy) / g2;
      z -= (f * gz) / g2;
    }
    const dx = x - x0, dy = y - y0, dz = z - z0;
    const len = Math.hypot(dx, dy, dz);
    const k = len > maxShift ? maxShift / len : 1;
    v[o] = x0 + dx * k;
    v[o + 1] = y0 + dy * k;
    v[o + 2] = z0 + dz * k;
  };
}

/**
 * Devuelve una copia de `m` con sus vértices movidos a la distancia `level` de la superficie (no libera
 * `m`). `edge` es la arista de la grilla con que se extrajo.
 */
export function projectToLevel(m: Manifold, field: MeshDistanceField, level: number, edge: number): Manifold {
  const project = pointProjector(field, edge, level);
  return m.warpBatch((v, count) => {
    for (let i = 0; i < count; i++) project(v, i * 3, level);
  });
}

/**
 * Flecha local: en aristas vivas cóncavas de la cavidad el centro de un triángulo queda más cerca del
 * exterior que sus vértices. A los vértices de esos triángulos se les pide el nivel más lo que le falta
 * al centro (solo ahí; el resto de la pared no se engruesa). `null` si no hay flecha. No libera `m`.
 */
export function liftSags(m: Manifold, field: MeshDistanceField, level: number, edge: number): Manifold | null {
  const mesh = m.getMesh();
  const np = mesh.numProp, P = mesh.vertProperties, T = mesh.triVerts;
  const extra = new Float64Array(mesh.numVert);
  const cap = level + 2 * edge;
  let any = false;
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t] * np, b = T[t + 1] * np, c = T[t + 2] * np;
    const sag = level - field.boundedSignedDistance((P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3, cap);
    if (sag <= 1e-4) continue;
    any = true;
    for (let k = 0; k < 3; k++) extra[T[t + k]] = Math.max(extra[T[t + k]], sag);
  }
  if (!any) return null;
  const project = pointProjector(field, edge, level + edge);
  // `warpBatch` recorre los vértices en el mismo orden que `getMesh` (sin propiedades extra); si el
  // conteo no coincide no se toca nada
  let mismatch = false;
  const out = m.warpBatch((v, count) => {
    if (count !== mesh.numVert) {
      mismatch = true;
      return;
    }
    for (let i = 0; i < count; i++) if (extra[i] > 0) project(v, i * 3, level + Math.min(extra[i], edge / 2));
  });
  if (!mismatch) return out;
  out.delete();
  return null;
}

/**
 * Superficie del nivel con vértices proyectados: proyección, refinamiento ×4 (la flecha de las cuerdas
 * baja ~4 veces), nueva proyección y alza local de las flechas que quedan (`liftSags`). Si algún cuerpo queda con volumen negativo (la proyección lo
 * plegó: una cavidad diminuta junto al eje medial), devuelve una copia de `m` sin proyectar. No libera `m`.
 */
export function snapToLevel(m: Manifold, field: MeshDistanceField, level: number, edge: number): Manifold {
  const first = projectToLevel(m, field, level, edge);
  const fine = useThenDelete(first, (f) => f.refine(2));
  const projected = useThenDelete(fine, (f) => projectToLevel(f, field, level, edge / 2));
  const lifted = deleteOnThrow(projected, (f) => liftSags(f, field, level, edge / 2));
  const snapped = lifted ? useThenDelete(projected, () => lifted) : projected;
  const parts = snapped.decompose();
  // Los cascos de volumen ~0 que deja la grilla no cuentan (los quita el ahuecado); uno negativo sí
  const junk = Math.max(1e-3, 1e-9 * Math.abs(snapped.volume()));
  const folded = parts.some((p) => p.volume() < -junk);
  for (const p of parts) p.delete();
  if (!folded) return snapped;
  snapped.delete();
  return m.translate([0, 0, 0]);
}
