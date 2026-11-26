/**
 * @file src/engine/fitCheck/broadPhase.ts
 * @description Fase ancha de "Comprobar encaje": barrido y poda (sweep and prune) sobre X de las cajas
 * en mundo agrandadas en el tope de búsqueda. O(n log n + k) para k candidatos; los pares lejanos no
 * llegan a la fase fina. Los pares referencia–referencia no se cuentan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type * as THREE from 'three';

export interface BroadBody {
  box: THREE.Box3;
  reference: boolean;
}

/** Pares posibles sin referencia–referencia. */
export function possiblePairCount(bodies: readonly BroadBody[]): number {
  const refs = bodies.filter((b) => b.reference).length;
  const solids = bodies.length - refs;
  return (solids * (solids - 1)) / 2 + solids * refs;
}

/** Índices `[i, j]` (i < j) de los pares cuyas cajas agrandadas en `marginMm` se tocan. */
export function broadPhasePairs(bodies: readonly BroadBody[], marginMm: number): Array<[number, number]> {
  const order = bodies.map((_, i) => i).sort((a, b) => bodies[a].box.min.x - bodies[b].box.min.x);
  const out: Array<[number, number]> = [];
  for (let s = 0; s < order.length; s++) {
    const i = order[s];
    const bi = bodies[i].box;
    const limit = bi.max.x + marginMm;
    for (let t = s + 1; t < order.length; t++) {
      const j = order[t];
      const bj = bodies[j].box;
      if (bj.min.x > limit) break;
      if (bodies[i].reference && bodies[j].reference) continue;
      if (bj.min.y > bi.max.y + marginMm || bi.min.y > bj.max.y + marginMm) continue;
      if (bj.min.z > bi.max.z + marginMm || bi.min.z > bj.max.z + marginMm) continue;
      out.push(i < j ? [i, j] : [j, i]);
    }
  }
  return out.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}
