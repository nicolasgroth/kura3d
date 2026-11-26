/**
 * @file src/engine/simplify/simplifySafety.ts
 * @description Regla de resultado «destructivo» de Simplificar (agujeros pasantes perdidos, volumen o desviación
 * sobre el tope relativo al tamaño) y búsqueda de la alternativa segura: bisección logarítmica de la tolerancia
 * entre la mínima de «Por tolerancia» y la que destruye, quedándose con el candidato de menos triángulos que pasa
 * la regla. Mide primero lo barato (género, volumen) y solo después la desviación muestreada. Un candidato vivo a
 * la vez.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type { MeshBVH } from 'three-mesh-bvh';
import { manifoldMesh, sampledDeviation } from './simplifyDeviation';
import { bodyGenus } from './simplifyGenus';
import { throwIfAborted } from './simplifyTarget';
import {
  SIMPLIFY_DESTRUCTIVE_LIMITS as D,
  SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM,
  SIMPLIFY_SAFE_MIN_REDUCTION_REL,
  SIMPLIFY_WARN_LIMITS,
  type SimplifyDestructiveReason,
  type SimplifyRunOptions,
  type SimplifySafeAlternative,
} from './simplifyTypes';

/** Medidas de un resultado que decide la regla (desviación en mm de mundo). */
export interface SafetyMeasure {
  genusBefore: number;
  genusAfter: number;
  volumeChangePct: number;
  maxDeviationMm: number;
}

/** Tope de desviación en mm de mundo para una pieza de diagonal `diagMm`. */
export function destructiveDeviationMm(diagMm: number): number {
  return Math.max(D.deviationMinMm, D.deviationRelDiag * diagMm);
}

/** Motivos por los que `m` es destructivo (vacío si no lo es). */
export function destructiveReasons(m: SafetyMeasure, diagMm: number): SimplifyDestructiveReason[] {
  const out: SimplifyDestructiveReason[] = [];
  // Túneles más finos que lo que se imprime (desviación ≤ umbral) no cuentan como destructivos: solo se avisa.
  if (m.genusAfter < m.genusBefore && m.maxDeviationMm > SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM) out.push('holes_lost');
  if (Math.abs(m.volumeChangePct) > D.volumePct) out.push('volume_changed');
  if (m.maxDeviationMm > destructiveDeviationMm(diagMm)) out.push('deviation_high');
  return out;
}

/** Diagonal de la caja del sólido en mm de mundo (escala por eje). */
export function worldDiagonalMm(m: Manifold, scale: readonly number[]): number {
  const { min, max } = m.boundingBox();
  let s = 0;
  for (let k = 0; k < 3; k++) s += ((max[k] - min[k]) * Math.abs(scale[k] ?? 1)) ** 2;
  return Math.sqrt(s);
}

export interface SafeSearchInput {
  original: Manifold;
  /** Malla y BVH de la original (se reutilizan en cada medición). */
  originalMesh: ReturnType<typeof manifoldMesh>;
  originalBvh: MeshBVH;
  trianglesBefore: number;
  genusBefore: number;
  volumeBefore: number;
  /** Mayor escala absoluta: tolerancia local = mm / maxScale. */
  maxScale: number;
  diagMm: number;
  /** Tolerancia mínima en mm de mundo (la de «Por tolerancia»). */
  minTolMm: number;
  /** Tolerancia en mm de mundo que dio el resultado destructivo. */
  destructiveTolMm: number;
  /** Reducción mínima para que la segura sirva (por defecto `SIMPLIFY_SAFE_MIN_REDUCTION_REL`). */
  minReductionRel?: number;
}

/** true si pasar de `before` a `triangles` reduce al menos `minRel` (una versión segura que vale la pena). */
export function isUsefulSafeReduction(triangles: number, before: number, minRel: number = SIMPLIFY_SAFE_MIN_REDUCTION_REL): boolean {
  return before > 0 && triangles <= before * (1 - minRel);
}

/**
 * Busca la tolerancia más alta (menos triángulos: la más cercana a lo pedido) cuyo resultado no es destructivo. null
 * si ni la mínima pasa la regla o si la mejor no reduce al menos `minReductionRel` (no hay reducción segura útil).
 * Cancelable entre llamadas.
 */
export function findSafeAlternative(input: SafeSearchInput, opts: SimplifyRunOptions = {}): SimplifySafeAlternative | null {
  const { original, maxScale } = input;
  let best: SimplifySafeAlternative | null = null;
  const evaluate = (tolMm: number): boolean => {
    throwIfAborted(opts.signal);
    const m = original.simplify(tolMm / maxScale);
    try {
      if (m.isEmpty() || m.numTri() === 0 || m.volume() <= 0) return false;
      const triangles = m.numTri();
      const volumeAfterMm3 = m.volume();
      const volumeChangePct = input.volumeBefore > 0 ? (100 * (volumeAfterMm3 - input.volumeBefore)) / input.volumeBefore : 0;
      const genusAfter = bodyGenus(m);
      const cheap = { genusBefore: input.genusBefore, genusAfter, volumeChangePct, maxDeviationMm: 0 };
      if (destructiveReasons(cheap, input.diagMm).length > 0) return false;
      const dev = sampledDeviation(input.originalMesh, manifoldMesh(m), SIMPLIFY_WARN_LIMITS.maxDeviationSamples, input.originalBvh);
      const maxDeviationMm = dev.maxMm * maxScale;
      if (destructiveReasons({ ...cheap, maxDeviationMm }, input.diagMm).length > 0) return false;
      if (triangles < input.trianglesBefore && (!best || triangles < best.triangles)) {
        best = { toleranceMm: tolMm, triangles, volumeAfterMm3, volumeChangePct, genusAfter, maxDeviationMm };
      }
      return true;
    } finally {
      m.delete();
    }
  };
  let lo = input.minTolMm;
  let hi = input.destructiveTolMm;
  // `lo` > 0 también protege la media geométrica (sqrt(lo·hi)): con 0 o negativo no habría búsqueda posible.
  const useful = (b: SimplifySafeAlternative | null): SimplifySafeAlternative | null =>
    b && isUsefulSafeReduction(b.triangles, input.trianglesBefore, input.minReductionRel) ? b : null;
  if (!(lo > 0) || !(hi > lo) || !evaluate(lo)) return useful(best);
  for (let i = 0; i < D.safeSearchIterations && hi / lo > 1.01; i++) {
    opts.onProgress?.(`simplify:safe:${i + 1}/${D.safeSearchIterations}`);
    const mid = Math.sqrt(lo * hi);
    if (evaluate(mid)) lo = mid;
    else hi = mid;
  }
  return useful(best);
}
