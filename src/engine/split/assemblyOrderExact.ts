/**
 * @file src/engine/split/assemblyOrderExact.ts
 * @description Arreglo de armado EXACTO (solo pegar) para pocas piezas: programación dinámica sobre los
 * conjuntos de piezas ya puestas. Al poner la pieza `p` sobre el conjunto `S` con una dirección `d` libre
 * de barrido se conservan sus uniones restrictivas hacia `S` compatibles con `d`; lo decidido en un paso
 * no afecta a los siguientes (cada unión se evalúa al poner la segunda de sus piezas), así que el máximo
 * de uniones conservadas por conjunto es exacto. Mismas reglas físicas que el voraz: la base va primero y
 * cada pieza nueva toca lo ya puesto si alguna puede. En una rejilla 3×2×3 el voraz pegaba 17 de 33 y el
 * óptimo es 16; en 2×2×2 ambos pegan 5 de 12 (cota: uniones − piezas + 1).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { jointDirections, restricts } from './assemblyConnectors';
import type { OrderInput } from './assemblyOrder';
import type { AssemblyDirection, AssemblyStep } from './assemblyTypes';
import { DIRECTIONS } from './assemblyVoxels';

/** Piezas hasta las que se usa la búsqueda exacta (2^n conjuntos). */
export const EXACT_FIX_MAX_PARTS = 18;

/**
 * Uniones a pegar (mínimo) y orden con dirección por pieza, o `null` si hay más de
 * `EXACT_FIX_MAX_PARTS` piezas o ningún orden completo es libre de barrido.
 */
export function exactGlueFix(input: OrderInput): { glued: Set<string>; order: AssemblyStep[] } | null {
  const n = input.codes.length;
  if (n === 0 || n > EXACT_FIX_MAX_PARTS) return null;
  const other = (j: OrderInput['joints'][number], p: number) => (j.a.part === p ? j.b.part : j.a.part);
  const mine = input.codes.map((_, p) => input.joints.filter((j) => j.a.part === p || j.b.part === p));
  const neighbors = mine.map((js, p) => js.reduce((m, j) => m | (1 << other(j, p)), 0));
  // Por pieza y dirección: máscara de piezas que topan al barrer y uniones que esa dirección conserva
  const blockMask = input.codes.map((_, p) => DIRECTIONS.map((d) => [...input.shadows[p]?.get(d) ?? []].reduce((m, q) => m | (1 << q), 0)));
  const keep = mine.map((js, p) => DIRECTIONS.map((d) => js.filter((j) => restricts(j) && jointDirections(j, p).includes(d))));
  const full = (1 << n) - 1;
  const best = new Int32Array(1 << n).fill(-1);
  const from = new Int32Array(1 << n).fill(-1);
  const how = new Int8Array(1 << n);
  best[1 << input.base] = 0;
  for (let set = 1; set <= full; set++) {
    if (best[set] < 0) continue;
    let touching = false;
    for (let p = 0; p < n && !touching; p++) touching = !(set & (1 << p)) && (neighbors[p] & set) !== 0;
    for (let p = 0; p < n; p++) {
      if (set & (1 << p) || (touching && !(neighbors[p] & set))) continue;
      let step = -1;
      let dir = -1;
      for (let d = 0; d < DIRECTIONS.length; d++) {
        if (blockMask[p][d] & set) continue;
        let kept = 0;
        for (const j of keep[p][d]) if (set & (1 << other(j, p))) kept++;
        if (kept > step) {
          step = kept;
          dir = d;
        }
      }
      if (dir < 0) continue;
      const next = set | (1 << p);
      if (best[set] + step > best[next]) {
        best[next] = best[set] + step;
        from[next] = p;
        how[next] = dir;
      }
    }
  }
  if (best[full] < 0) return null;
  // Reconstrucción del orden y de las uniones conservadas
  const steps: Array<{ p: number; d: AssemblyDirection; set: number }> = [];
  for (let set = full; set !== 1 << input.base; ) {
    const p = from[set];
    const prev = set & ~(1 << p);
    steps.push({ p, d: DIRECTIONS[how[set]], set: prev });
    set = prev;
  }
  steps.reverse();
  const kept = new Set<string>();
  for (const s of steps) {
    for (const j of keep[s.p][DIRECTIONS.indexOf(s.d)]) if (s.set & (1 << other(j, s.p))) kept.add(j.label);
  }
  const glued = new Set(input.joints.filter((j) => restricts(j) && !kept.has(j.label)).map((j) => j.label));
  const baseDir = DIRECTIONS[0];
  const order: AssemblyStep[] = [
    { part: input.base, code: input.codes[input.base], direction: baseDir, step: 1 },
    ...steps.map((s, i) => ({ part: s.p, code: input.codes[s.p], direction: s.d, step: i + 2 })),
  ];
  return { glued, order };
}
