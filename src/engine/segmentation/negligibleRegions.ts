/**
 * @file src/engine/segmentation/negligibleRegions.ts
 * @description Absorción de regiones de grosor cero o volumen despreciable antes de etiquetar: una
 * región que es solo una cara plana (p. ej. el anillo horizontal de un escalón) no es una pieza
 * imprimible y al extraerla daría un sólido vacío. Se funde con la vecina con la que comparte más
 * borde (o con la más cercana si no tiene vecinas), sin perder triángulos.
 *
 * Umbrales relativos al modelo (documentados en `NEGLIGIBLE_*`):
 * - grosor ≤ max(`NEGLIGIBLE_THICKNESS_MIN_MM`, `NEGLIGIBLE_THICKNESS_REL` × diagonal de la caja del
 *   modelo). El grosor es la menor medida de la caja de la región o, si la región es plana, su
 *   dispersión a lo largo de la normal media (cubre caras planas inclinadas).
 * - volumen de la caja de la región ≤ `NEGLIGIBLE_VOLUME_REL` × volumen de la caja del modelo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { buildRegionAdjacency, mergeRegionsInto, type MutableRegion, type TriangleGraphData } from './adjacency';

/** Grosor relativo a la diagonal del modelo bajo el cual una región se considera plana (0,1 %). */
export const NEGLIGIBLE_THICKNESS_REL = 1e-3;
/** Piso absoluto del umbral de grosor, en mm. */
export const NEGLIGIBLE_THICKNESS_MIN_MM = 1e-3;
/** Volumen de caja relativo al del modelo bajo el cual una región es despreciable (1 ppm). */
export const NEGLIGIBLE_VOLUME_REL = 1e-6;
/** Coherencia de normales desde la que una región se mide como plana. */
const PLANAR_COHERENCE = 0.99;

/**
 * true si una región con caja `dims` (y, si es plana, grosor `planarThicknessMm`) es despreciable
 * en un modelo cuya caja mide `modelSpan`.
 */
export function isNegligibleRegionBox(dims: Vec3, modelSpan: Vec3, planarThicknessMm = Infinity): boolean {
  const diag = Math.hypot(modelSpan[0], modelSpan[1], modelSpan[2]);
  const thickness = Math.min(dims[0], dims[1], dims[2], planarThicknessMm);
  if (thickness <= Math.max(NEGLIGIBLE_THICKNESS_MIN_MM, NEGLIGIBLE_THICKNESS_REL * diag)) return true;
  const modelVolume = Math.max(modelSpan[0], 1e-9) * Math.max(modelSpan[1], 1e-9) * Math.max(modelSpan[2], 1e-9);
  return dims[0] * dims[1] * dims[2] <= NEGLIGIBLE_VOLUME_REL * modelVolume;
}

/** Caja y grosor plano (si aplica) de una región. */
function regionExtent(reg: MutableRegion, mesh: MeshData, graph: TriangleGraphData): { dims: Vec3; planar: number } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let area = 0;
  for (const t of reg.tris) {
    const w = Math.max(graph.areas[t], 1e-9);
    area += w;
    nx += graph.normals[t * 3] * w;
    ny += graph.normals[t * 3 + 1] * w;
    nz += graph.normals[t * 3 + 2] * w;
    for (let k = 0; k < 3; k++) {
      const v = mesh.indices[t * 3 + k] * 3;
      for (let a = 0; a < 3; a++) {
        const c = mesh.positions[v + a];
        if (c < min[a]) min[a] = c;
        if (c > max[a]) max[a] = c;
      }
    }
  }
  const dims: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const len = Math.hypot(nx, ny, nz);
  if (len < PLANAR_COHERENCE * area) return { dims, planar: Infinity };
  // Región plana: dispersión de sus vértices a lo largo de la normal media.
  const [ux, uy, uz] = [nx / len, ny / len, nz / len];
  let lo = Infinity;
  let hi = -Infinity;
  for (const t of reg.tris) {
    for (let k = 0; k < 3; k++) {
      const v = mesh.indices[t * 3 + k] * 3;
      const d = mesh.positions[v] * ux + mesh.positions[v + 1] * uy + mesh.positions[v + 2] * uz;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
  }
  return { dims, planar: hi - lo };
}

/** Vecina con la que comparte más borde, o la de centro más cercano si no tiene vecinas. */
function absorbTarget(
  id: number,
  regionsMap: Map<number, MutableRegion>,
  adjacency: ReturnType<typeof buildRegionAdjacency>,
): number {
  let best = -1;
  let bestLen = -1;
  for (const [nbr, stats] of adjacency.get(id) ?? []) {
    if (nbr !== id && regionsMap.has(nbr) && stats.totalLen > bestLen) {
      bestLen = stats.totalLen;
      best = nbr;
    }
  }
  if (best !== -1) return best;
  const src = regionsMap.get(id)!;
  let bestDist = Infinity;
  for (const other of regionsMap.values()) {
    if (other.id === id) continue;
    const d = Math.hypot(
      other.centerMm[0] - src.centerMm[0],
      other.centerMm[1] - src.centerMm[1],
      other.centerMm[2] - src.centerMm[2],
    );
    if (d < bestDist) {
      bestDist = d;
      best = other.id;
    }
  }
  return best;
}

/**
 * Funde en su vecina cada región despreciable (de la más pequeña a la más grande) hasta que no
 * quede ninguna o solo quede una región. Modifica `regionsMap` y `triRegion` en sitio.
 * @returns Cantidad de regiones absorbidas.
 */
export function absorbNegligibleRegions(
  mesh: MeshData,
  graph: TriangleGraphData,
  regionsMap: Map<number, MutableRegion>,
  triRegion: Int32Array,
  modelSpan: Vec3,
): number {
  let absorbed = 0;
  while (regionsMap.size > 1) {
    const negligible = [...regionsMap.values()]
      .filter((reg) => {
        const { dims, planar } = regionExtent(reg, mesh, graph);
        return isNegligibleRegionBox(dims, modelSpan, planar);
      })
      .sort((a, b) => a.tris.length - b.tris.length || a.id - b.id);
    if (negligible.length === 0) break;
    const target = absorbTarget(negligible[0].id, regionsMap, buildRegionAdjacency(triRegion, graph));
    if (target === -1) break;
    mergeRegionsInto(regionsMap, triRegion, negligible[0].id, target);
    absorbed++;
  }
  return absorbed;
}
