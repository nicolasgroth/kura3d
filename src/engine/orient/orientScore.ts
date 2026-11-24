/**
 * @file src/engine/orient/orientScore.ts
 * @description Puntuación y orden de «Orientar para imprimir». Costo (menor es mejor):
 *   support·(Vsoporte / Vpieza) + overhang·(Avoladizo / Atotal) + height·(altura / mayor dimensión)
 *   + base·(1 − contacto / mayor contacto) + unstable·[inestable] + noFit·[no cabe].
 * Pesos en `ORIENT_WEIGHTS` (justificación en docs/diseno/ORIENTAR.md): el soporte manda; base y
 * altura solo desempatan. Dentro de `ORIENT_EQUIVALENCE` del mejor costo, las orientaciones son
 * equivalentes (no se inventa una ganadora). Motivos como datos (clave + parámetros).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { OrientMeasures, OrientReason, OrientWeights } from './orientTypes';

export const ORIENT_WEIGHTS: Readonly<OrientWeights> = Object.freeze({
  support: 1, overhang: 0.25, height: 0.1, base: 0.1, unstable: 0.5, noFit: 1,
});

/** Diferencia de costo bajo la cual dos orientaciones se consideran iguales. */
export const ORIENT_EQUIVALENCE = 0.02;

export interface ScoreContext {
  partVolumeMm3: number;
  totalAreaMm2: number;
  maxDimensionMm: number;
  /** Mayor contacto entre candidatos; si es despreciable, el término de base no cuenta. */
  maxContactMm2: number;
}

/** Despreciable: soporte o voladizo por debajo de 0,1 % de la pieza. */
const NEGLIGIBLE = 1e-3;

export function orientCost(m: OrientMeasures, ctx: ScoreContext, w: OrientWeights = ORIENT_WEIGHTS): number {
  const vol = ctx.partVolumeMm3 > 0 ? ctx.partVolumeMm3 : 1;
  const baseTerm = ctx.maxContactMm2 > NEGLIGIBLE * ctx.totalAreaMm2 ? 1 - m.contactAreaMm2 / ctx.maxContactMm2 : 0;
  return w.support * (m.supportVolumeMm3 / vol)
    + w.overhang * (ctx.totalAreaMm2 > 0 ? m.overhangAreaMm2 / ctx.totalAreaMm2 : 0)
    + w.height * (ctx.maxDimensionMm > 0 ? m.heightMm / ctx.maxDimensionMm : 0)
    + w.base * baseTerm
    + (m.stable ? 0 : w.unstable)
    + (m.fitsBed === false ? w.noFit : 0);
}

const pct = (value: number, ref: number): number | null => (ref > 0 ? Math.round(((value - ref) / ref) * 100) : null);

export function vsCurrentOf(m: OrientMeasures, cur: OrientMeasures) {
  return {
    supportVolumePct: pct(m.supportVolumeMm3, cur.supportVolumeMm3),
    overhangAreaPct: pct(m.overhangAreaMm2, cur.overhangAreaMm2),
    heightPct: pct(m.heightMm, cur.heightMm) ?? 0,
    contactFactor: cur.contactAreaMm2 > 0 ? Math.round((m.contactAreaMm2 / cur.contactAreaMm2) * 10) / 10 : null,
  };
}

/** Motivos legibles de un candidato frente a la actual. */
export function reasonsFor(
  m: OrientMeasures, cur: OrientMeasures, ctx: ScoreContext,
  flags: { isCurrent: boolean; equivalentToBest: boolean },
): OrientReason[] {
  const out: OrientReason[] = [];
  if (flags.isCurrent) out.push({ key: 'current' });
  const negligibleSupport = m.supportVolumeMm3 <= NEGLIGIBLE * ctx.partVolumeMm3 && m.overhangAreaMm2 <= NEGLIGIBLE * ctx.totalAreaMm2;
  if (negligibleSupport) out.push({ key: 'noOverhangs' });
  if (!flags.isCurrent) {
    const v = vsCurrentOf(m, cur);
    if (v.supportVolumePct !== null && v.supportVolumePct !== 0) out.push({ key: 'supportVsCurrent', params: { percent: v.supportVolumePct } });
    else if (v.supportVolumePct === null && !negligibleSupport) out.push({ key: 'supportAdded', params: { volumeMm3: Math.round(m.supportVolumeMm3) } });
    if (v.contactFactor !== null && v.contactFactor >= 1.5) out.push({ key: 'baseVsCurrent', params: { factor: v.contactFactor } });
    if (v.heightPct <= -10) out.push({ key: 'lowerVsCurrent', params: { percent: v.heightPct } });
  }
  if (flags.equivalentToBest) out.push({ key: 'equivalentToBest' });
  if (!m.stable) out.push({ key: 'unstable', params: { tipAngleDeg: Math.round(m.tipAngleDeg * 10) / 10 } });
  if (m.fitsBed === false) out.push({ key: 'doesNotFit' });
  return out;
}
