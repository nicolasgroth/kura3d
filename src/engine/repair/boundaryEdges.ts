/**
 * @file src/engine/repair/boundaryEdges.ts
 * @description Definición única de "arista abierta" (borde libre): arista usada por un solo triángulo no
 * degenerado, tras soldar vértices por posición (`CLOSURE_WELD_MM`). La usan el aviso de importación y el
 * diagnóstico del inspector, para que ambos digan la misma cifra (antes: 13 en el aviso, contando también
 * aristas de 3+ triángulos y sin soldar, y 8 en el inspector). Conteo O(n) por cubetas (CSR).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { CLOSURE_WELD_MM, weldGrid } from './meshTopology';

/**
 * Cuenta aristas por cantidad de triángulos que las usan. `boundaryOnly`: solo las de un triángulo
 * (abiertas); si no, todas las que no tienen exactamente dos. `skip[t] = 1` excluye el triángulo `t`.
 */
export function countEdgesByUse(
  indices: Uint32Array,
  vertexCount: number,
  opts: { boundaryOnly: boolean; skip?: Uint8Array },
): number {
  const triCount = Math.floor(indices.length / 3);
  const skip = opts.skip;
  const offsets = new Uint32Array(vertexCount + 1);
  for (let t = 0; t < triCount; t++) {
    if (skip?.[t]) continue;
    for (let e = 0; e < 3; e++) {
      const a = indices[t * 3 + e];
      const b = indices[t * 3 + ((e + 1) % 3)];
      offsets[(a < b ? a : b) + 1]++;
    }
  }
  for (let v = 0; v < vertexCount; v++) offsets[v + 1] += offsets[v];
  const fill = offsets.slice(0, vertexCount);
  const others = new Uint32Array(offsets[vertexCount]);
  for (let t = 0; t < triCount; t++) {
    if (skip?.[t]) continue;
    for (let e = 0; e < 3; e++) {
      const a = indices[t * 3 + e];
      const b = indices[t * 3 + ((e + 1) % 3)];
      others[fill[a < b ? a : b]++] = a < b ? b : a;
    }
  }
  let count = 0;
  for (let v = 0; v < vertexCount; v++) {
    const from = offsets[v];
    const to = offsets[v + 1];
    if (to - from > 1) others.subarray(from, to).sort();
    let run = 1;
    for (let i = from + 1; i <= to; i++) {
      if (i < to && others[i] === others[i - 1]) {
        run++;
      } else {
        if (i > from && (opts.boundaryOnly ? run === 1 : run !== 2)) count++;
        run = 1;
      }
    }
  }
  return count;
}

/** Triángulos soldados (`canon`) y máscara de los degenerados (dos vértices iguales tras soldar). */
export function weldedTriangles(positions: ArrayLike<number>, indices: ArrayLike<number>, weldMm = CLOSURE_WELD_MM) {
  const { canon, first, unique } = weldGrid(positions, weldMm);
  const nT = Math.floor(indices.length / 3);
  const tris = new Uint32Array(nT * 3);
  for (let i = 0; i < nT * 3; i++) tris[i] = canon[indices[i]];
  const skip = new Uint8Array(nT);
  for (let t = 0; t < nT; t++) {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    if (a === b || b === c || a === c) skip[t] = 1;
  }
  return { tris, skip, first, unique };
}

/** Aristas abiertas de una malla (definición única de aviso de importación e inspector). */
export function countBoundaryEdges(positions: ArrayLike<number>, indices: ArrayLike<number>, weldMm = CLOSURE_WELD_MM): number {
  const { tris, skip, unique } = weldedTriangles(positions, indices, weldMm);
  return countEdgesByUse(tris, unique, { boundaryOnly: true, skip });
}
