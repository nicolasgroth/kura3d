/**
 * @file src/engine/simplify/simplifyLadder.ts
 * @description «Por tolerancia» monótono. `Manifold.simplify(t)` colapsa aristas en orden de índice, no de costo: con
 * tolerancias grandes los primeros colapsos dejan triángulos que bloquean los siguientes y el resultado puede tener MÁS
 * triángulos que con una tolerancia menor (ocarina real: 1 mm → 3 112, 15 mm → 15 390; fénix: 0,2 mm → 20 902,
 * 20 mm → 94 168). Todo resultado de una tolerancia g ≤ t respeta también t (la superficie se movió menos que g), así
 * que para t se recorre una escalera FIJA de tolerancias (1-2-5 por década, de la mínima del modo a t) y se entrega la
 * de menos triángulos. Como la escalera de una t mayor contiene la de una menor, el mínimo nunca crece: monótono por
 * construcción, sin depender de la malla. La versión segura se elige en la misma escalera (la de menos triángulos que
 * no es destructiva), así que tampoco crece con la tolerancia. Un candidato vivo a la vez.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import { OPERATION_RANGES } from '../operationLimits';
import { isUsefulSafeReduction, measureSafeCandidate, type SafeSearchInput } from './simplifySafety';
import { throwIfAborted } from './simplifyTarget';
import type { SimplifyRunOptions, SimplifySafeAlternative } from './simplifyTypes';

const R = OPERATION_RANGES.simplify.toleranceMm;

/**
 * Escalera fija en mm de mundo: 1, 2 y 5 por década entre la mínima y la máxima de «Por tolerancia» (0,01–100 mm,
 * 13 peldaños). Razón ≤ 2,5 entre peldaños: con más peldaños el resultado se acerca a lo escrito pero cada uno es una
 * llamada más a `simplify` (en el fénix de 253 000 triángulos, de 0,3 a 1,4 s cada una).
 */
export const SIMPLIFY_TOLERANCE_LADDER_MM: readonly number[] = (() => {
  const out: number[] = [];
  for (let e = -2; e <= 2; e++) {
    for (const k of [1, 2, 5]) {
      const v = Number((k * 10 ** e).toPrecision(3));
      if (v >= R.min && v <= R.max) out.push(v);
    }
  }
  return out;
})();

/** Peldaños hasta `toleranceMm` (incluida si es un peldaño); al menos el primero. */
export function toleranceLadderUpTo(toleranceMm: number): number[] {
  const out = SIMPLIFY_TOLERANCE_LADDER_MM.filter((g) => g <= toleranceMm * (1 + 1e-9));
  return out.length > 0 ? out : [SIMPLIFY_TOLERANCE_LADDER_MM[0]];
}

/** Un peldaño medido: tolerancia en mm de mundo y triángulos (0 si colapsó la pieza). */
export interface LadderRung {
  toleranceMm: number;
  triangles: number;
}

const valid = (m: Manifold) => !m.isEmpty() && m.numTri() > 0 && m.volume() > 0;

/**
 * Mide los peldaños hasta `toleranceMm` (`maxScale`: tolerancia local = mm / maxScale). Devuelve los peldaños válidos
 * ordenados por triángulos y, a igual cantidad, por tolerancia menor (determinista: Manifold lo es). Vacío si todos
 * colapsan la pieza. Informa `simplify:<i>/<n>` y es cancelable entre llamadas.
 */
export function measureToleranceLadder(original: Manifold, toleranceMm: number, maxScale: number, opts: SimplifyRunOptions = {}): LadderRung[] {
  const rungs = toleranceLadderUpTo(toleranceMm);
  const out: LadderRung[] = [];
  rungs.forEach((g, i) => {
    throwIfAborted(opts.signal);
    opts.onProgress?.(rungs.length > 1 ? `simplify:${i + 1}/${rungs.length}` : 'simplify:1/1');
    const m = original.simplify(g / maxScale);
    try {
      if (valid(m)) out.push({ toleranceMm: g, triangles: m.numTri() });
    } finally {
      m.delete();
    }
  });
  return out.sort((a, b) => a.triangles - b.triangles || a.toleranceMm - b.toleranceMm);
}

/**
 * Versión segura en la escalera: el primer peldaño (en orden de triángulos, sin el pedido) que no es destructivo y
 * reduce al menos `minReductionRel`. null si ninguno sirve. Cancelable.
 */
export function findSafeOnLadder(input: SafeSearchInput, rungs: readonly LadderRung[], opts: SimplifyRunOptions = {}): SimplifySafeAlternative | null {
  const candidates = rungs.filter((r) => r.toleranceMm !== input.destructiveTolMm && r.triangles < input.trianglesBefore);
  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i];
    // En orden de triángulos: si éste no reduce lo suficiente, los siguientes (más triángulos) tampoco.
    if (!isUsefulSafeReduction(r.triangles, input.trianglesBefore, input.minReductionRel)) return null;
    opts.onProgress?.(`simplify:safe:${i + 1}/${candidates.length}`);
    const found = measureSafeCandidate(input, r.toleranceMm, opts);
    if (found) return found;
  }
  return null;
}
