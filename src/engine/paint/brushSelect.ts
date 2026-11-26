/**
 * @file src/engine/paint/brushSelect.ts
 * @description Selección pura de las caras bajo el pincel: distancia exacta ≤ radio (en mm de mundo,
 * con la escala del objeto) más la regla de visibilidad y conexión de `brushVisibility` (de frente a la
 * vista y conectadas a la cara semilla). Así el pincel no atraviesa paredes delgadas ni salta a otra
 * superficie cercana. Usa la rejilla uniforme en caché; la variante de fuerza bruta sirve de
 * referencia en las pruebas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData } from '../../types/kura';
import { acceptedDistanceSq, connectedToSeed, prepareBrush, type BrushQuery, type PreparedBrush } from './brushVisibility';
import { triangleCount } from './faceColors';
import { forEachTriangleNearBox, getTriangleGrid } from './triangleGrid';

export type { BrushQuery, BrushView } from './brushVisibility';

function finish(mesh: MeshData, found: number[], dist: number[], seed: number | null | undefined): Uint32Array {
  // Orden ascendente de caras, con su distancia al lado.
  const order = found.map((_, i) => i).sort((a, b) => found[a] - found[b]);
  const faces = Uint32Array.from(order, (i) => found[i]);
  const distSq = Float64Array.from(order, (i) => dist[i]);
  return connectedToSeed(mesh, faces, distSq, seed);
}

/**
 * Caras bajo el pincel, en orden ascendente, usando la rejilla espacial en caché. `prepared` permite
 * reutilizar una vista ya resuelta sobre otra malla (p. ej. la original antes de subdividir).
 */
export function selectBrushFaces(mesh: MeshData, q: BrushQuery, prepared?: PreparedBrush): Uint32Array {
  const p = prepared ?? prepareBrush(mesh, q);
  const found: number[] = [];
  const dist: number[] = [];
  forEachTriangleNearBox(getTriangleGrid(mesh), p.lo, p.hi, (t) => {
    const d = acceptedDistanceSq(mesh, t, p);
    if (d < 0) return;
    found.push(t);
    dist.push(d);
  });
  return finish(mesh, found, dist, q.seedFace);
}

/** Referencia de fuerza bruta (recorre todas las caras): mismo resultado que `selectBrushFaces`. */
export function selectBrushFacesBruteForce(mesh: MeshData, q: BrushQuery): Uint32Array {
  const p = prepareBrush(mesh, q);
  const found: number[] = [];
  const dist: number[] = [];
  for (let t = 0; t < triangleCount(mesh); t++) {
    const d = acceptedDistanceSq(mesh, t, p);
    if (d < 0) continue;
    found.push(t);
    dist.push(d);
  }
  return finish(mesh, found, dist, q.seedFace);
}
