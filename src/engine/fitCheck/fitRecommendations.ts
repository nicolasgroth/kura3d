/**
 * @file src/engine/fitCheck/fitRecommendations.ts
 * @description Recomendaciones por regla de "Comprobar encaje" (texto por i18n con `{ key, params }`,
 * sin IA): separar, agrandar el alojamiento o dar holgura, con cifras en mm y posiciones en ejes del
 * usuario; y el resumen general (pares revisados, cuántos chocan, cuántos justos, peor caso).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { userAxisLabel, userDirectionOfInternal, type AxisDirection, type AxisName } from '../../core/scene/displayAxes';
import type { Vec3 } from '../../types/kura';
import type { FitMessage, FitPairResult, FitCheckSummary } from './fitCheckTypes';
import type { FitResolution } from './fitResolution';

export const r2 = (v: number) => Math.round(v * 100) / 100 + 0;
const at = (p: Vec3) => ({ x: r2(p[0]), y: r2(p[1]), z: r2(p[2]) });

/** Recomendación de un choque. `point` en ejes del usuario. */
export function interferenceRecommendation(
  names: { a: string; b: string },
  volumeMm3: number,
  point: Vec3,
  resolution: FitResolution,
): FitMessage {
  if (resolution.kind === 'enlarge') {
    const axes = resolution.axes.map((ax: AxisName) => userAxisLabel(ax)).sort().join(', ');
    return {
      key: 'fitCheck.rec.enlarge',
      params: { inner: resolution.inner.name, outer: resolution.outer.name, volumeMm3: r2(volumeMm3), ...at(point), perSideMm: r2(resolution.perSideMm), axes },
      estimate: true,
    };
  }
  return {
    key: 'fitCheck.rec.separate',
    params: { a: names.a, b: names.b, volumeMm3: r2(volumeMm3), ...at(point), distanceMm: r2(resolution.distanceMm), direction: userDirectionOfInternal(resolution.direction) },
    estimate: true,
  };
}

/** Recomendación de una holgura menor que la deseada. `direction` interna: de B hacia A. */
export function tightRecommendation(
  names: { a: string; b: string },
  gapMm: number,
  targetMm: number,
  point: Vec3,
  direction: AxisDirection,
): FitMessage {
  return {
    key: 'fitCheck.rec.tight',
    params: { a: names.a, b: names.b, gapMm: r2(gapMm), targetMm: r2(targetMm), missingMm: r2(targetMm - gapMm), ...at(point), direction: userDirectionOfInternal(direction) },
  };
}

/** Peor par: mayor choque; si no hay, menor holgura justa. */
export function worstPair(pairs: readonly FitPairResult[]): FitCheckSummary['worst'] {
  const clash = pairs.filter((p) => p.status === 'interferes').sort((p, q) => q.interference!.volumeMm3 - p.interference!.volumeMm3)[0];
  if (clash) return { aId: clash.aId, bId: clash.bId, status: clash.status, volumeMm3: clash.interference!.volumeMm3 };
  const tight = pairs.filter((p) => p.status === 'tight').sort((p, q) => (p.clearanceMm ?? 0) - (q.clearanceMm ?? 0))[0];
  return tight ? { aId: tight.aId, bId: tight.bId, status: tight.status, clearanceMm: tight.clearanceMm ?? 0 } : null;
}

/** Frase de resumen general. */
export function summaryMessage(objects: number, possible: number, evaluated: number, pairs: readonly FitPairResult[]): FitMessage {
  if (possible === 0) return { key: 'fitCheck.summary.none', params: { objects } };
  const clashes = pairs.filter((p) => p.status === 'interferes').length;
  const tight = pairs.filter((p) => p.status === 'tight').length;
  if (clashes + tight === 0) return { key: 'fitCheck.summary.clean', params: { pairs: evaluated } };
  const worst = worstPair(pairs)!;
  const w = pairs.find((p) => p.aId === worst.aId && p.bId === worst.bId)!;
  return { key: 'fitCheck.summary.issues', params: { pairs: evaluated, clashes, tight, a: w.aName, b: w.bName } };
}
