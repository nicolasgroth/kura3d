/**
 * @file src/core/scene/jointFirmness.ts
 * @description Vocabulario común de la firmeza de una unión de "dividir para imprimir" (firme, regular, débil, para
 * pegar) para la interfaz: nivel efectivo, conteo por nivel y los motivos y medidas de cada unión como claves de
 * texto con parámetros numéricos. Sirve igual al resumen previo (`BedSplitPlan.jointPreview`) y al informe de uniones
 * de las piezas ya divididas (`SplitJointRecord.strength`), con conectores y con imanes. No calcula reglas: lee lo que
 * el motor ya midió (`SplitJointStrength`). Sin React ni i18n.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SplitJointRecordStrength } from '../../types/kura';

export type JointFirmness = 'firm' | 'fair' | 'weak' | 'glue';

/** Orden de presentación: de lo mejor a lo que pide atención. */
export const FIRMNESS_ORDER: readonly JointFirmness[] = ['firm', 'fair', 'weak', 'glue'];

export type FirmnessCounts = Record<JointFirmness, number> & { total: number };

/** Lo mínimo que se necesita de una unión para describir su firmeza. */
export interface FirmnessInput {
  strength: SplitJointRecordStrength;
  /** Radios medido y recomendado (mm) si el informe de armado marca el conector bajo lo recomendado. */
  weak?: { measuredMm: number; recommendedMm: number } | null;
  /** Ancho típico de la isla más ancha de la sección (mm), si se conoce. */
  widthMm?: number;
}

/** Nivel que se muestra: un conector bajo el recomendado cuenta como débil aunque el área alcance. */
export function effectiveFirmness(strength: SplitJointRecordStrength, weak?: FirmnessInput['weak']): JointFirmness {
  if (strength.level === 'glue') return 'glue';
  return weak && strength.level !== 'weak' ? 'weak' : strength.level;
}

export function countFirmness(levels: readonly JointFirmness[]): FirmnessCounts {
  const counts: FirmnessCounts = { firm: 0, fair: 0, weak: 0, glue: 0, total: levels.length };
  for (const l of levels) counts[l]++;
  return counts;
}

/** Un motivo o dato de la unión: clave de texto (`jointFirmness.fact.<key>`) y parámetros numéricos (mm, Ø en diámetro). */
export interface FirmnessFact {
  key:
    | 'noConnector' | 'singleConnector' | 'singleMagnet' | 'lowArea' | 'shallow' | 'islandsUncovered' | 'belowUseful'
    | 'belowRecommended' | 'sectionNarrow' | 'shrunkSize' | 'shrunkCount' | 'shrunkDepth';
  params: Record<string, number>;
}

const MIN_USEFUL_DIAMETER_MM = 3;

/** Motivos de un nivel que no es «firme» y lo que el motor achicó o descartó, en el orden en que importan. */
export function firmnessFacts(input: FirmnessInput): FirmnessFact[] {
  const { strength: s, weak, widthMm } = input;
  const facts: FirmnessFact[] = [];
  for (const reason of s.reasons) {
    switch (reason) {
      case 'no-connector': facts.push({ key: 'noConnector', params: {} }); break;
      case 'single-connector': facts.push({ key: 'singleConnector', params: {} }); break;
      case 'single-magnet': facts.push({ key: 'singleMagnet', params: {} }); break;
      case 'low-area': facts.push({ key: 'lowArea', params: { area: Math.round(s.areaRatio * 1000) / 10 } }); break;
      case 'shallow': facts.push({ key: 'shallow', params: { depth: Math.round(s.depthMm * 10) / 10 } }); break;
      case 'islands-uncovered':
        facts.push({ key: 'islandsUncovered', params: { glued: Math.max(0, s.islands - s.islandsCovered), total: s.islands } });
        break;
      case 'below-useful': facts.push({ key: 'belowUseful', params: { d: Math.round(2 * s.sizeMm * 10) / 10, min: MIN_USEFUL_DIAMETER_MM } }); break;
    }
  }
  if (weak && s.level !== 'glue') {
    facts.push({ key: 'belowRecommended', params: { d: Math.round(2 * weak.measuredMm * 10) / 10, rec: Math.round(2 * weak.recommendedMm * 10) / 10 } });
  }
  for (const d of s.discarded) {
    facts.push({ key: 'sectionNarrow', params: { width: Math.round(d.measuredMm * 10) / 10, ...(widthMm !== undefined ? { sectionWidth: Math.round(widthMm * 10) / 10 } : {}) } });
  }
  for (const k of s.shrunk) {
    const r = (n: number) => Math.round(n * 10) / 10;
    if (k.reason === 'section-width') facts.push({ key: 'shrunkSize', params: { from: r(2 * k.fromMm), to: r(2 * k.toMm) } });
    // Con `reason: 'count'`, `fromMm`/`toMm` son cantidades de conectores: el nombre viene del formato guardado.
    else if (k.reason === 'count') facts.push({ key: 'shrunkCount', params: { from: k.fromMm, to: k.toMm } });
    else facts.push({ key: 'shrunkDepth', params: { from: r(k.fromMm), to: r(k.toMm) } });
  }
  return facts;
}

/** Medidas reales de lo que lleva la unión (diámetro en mm); `null` si no lleva conector ni imán. */
export function firmnessMeasures(s: SplitJointRecordStrength): { count: number; diameterMm: number; depthMm: number; magnet: boolean } | null {
  if (s.level === 'glue' || s.count === 0) return null;
  return { count: s.count, diameterMm: Math.round(2 * s.sizeMm * 10) / 10, depthMm: Math.round(s.depthMm * 10) / 10, magnet: s.basis === 'magnet' };
}
