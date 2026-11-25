/**
 * @file src/components/orient/orientView.ts
 * @description Presentación de «Orientar para imprimir»: medidas en la unidad que se lee mejor (mm³ o cm³, mm²
 * o cm²), motivos del motor traducidos, insignias de cada opción y su descripción accesible completa. Funciones
 * puras, sin React.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { OrientAnalysis, OrientCandidate, OrientReason } from '../../engine/orient';
import { t } from '../../i18n';
import { formatLocaleNumber, formatQuantity } from '../../i18n/numberLocale';
import type { LanguageCode } from '../../types/kura';
import { reasonText, volumeText } from '../../core/orient/orientReasonText';

export { reasonText, volumeText };

/** Área en mm² si es chica y en cm² si no (1 cm² = 100 mm²). */
export function areaText(language: LanguageCode, mm2: number): string {
  if (mm2 < 100) return formatQuantity(language, Math.round(mm2), 'mm²');
  const cm2 = mm2 / 100;
  return formatQuantity(language, cm2, 'cm²', { maxFrac: cm2 >= 100 ? 0 : 1 });
}

export const heightText = (language: LanguageCode, mm: number): string => formatQuantity(language, mm, 'mm', { maxFrac: 1 });

/** Motivos que se muestran: «Es como está ahora» ya lo dice la insignia «Actual». */
export const visibleReasons = (c: OrientCandidate): OrientReason[] => c.reasons.filter((r) => r.key !== 'current');

/**
 * Id de la orientación recomendada, o `null` si no hay: la actual ya es la mejor, todas son equivalentes o
 * la primera es la actual (sin base, no se la llama «la mejor» pero tampoco hay otra que ganarle).
 */
export function recommendedId(a: Pick<OrientAnalysis, 'allEquivalent' | 'currentIsBest' | 'candidates' | 'currentId'>): string | null {
  if (a.allEquivalent || a.currentIsBest) return null;
  const first = a.candidates[0]?.id ?? null;
  return first === a.currentId ? null : first;
}

/** Aviso «sin base estable» aparte del resumen (cuando el resumen ya lo dice, no se repite). */
export const showBaseWarning = (a: OrientAnalysis): boolean =>
  a.baseStatus === 'noStableBase' && (a.allEquivalent || a.currentIsBest || recommendedId(a) !== null);

export type OrientBadge = 'current' | 'recommended';

export function badgesOf(a: OrientAnalysis, c: OrientCandidate): OrientBadge[] {
  const out: OrientBadge[] = [];
  if (c.id === a.currentId) out.push('current');
  if (c.id === recommendedId(a)) out.push('recommended');
  return out;
}

export interface OrientStat {
  key: 'support' | 'overhang' | 'base' | 'height';
  label: string;
  value: string;
}

export function statsOf(language: LanguageCode, c: OrientCandidate): OrientStat[] {
  const m = c.measures;
  return [
    { key: 'support', label: t(language, 'orient.ui.stat.support'), value: volumeText(language, m.supportVolumeMm3) },
    { key: 'overhang', label: t(language, 'orient.ui.stat.overhang'), value: areaText(language, m.overhangAreaMm2) },
    { key: 'base', label: t(language, 'orient.ui.stat.base'), value: areaText(language, m.contactAreaMm2) },
    { key: 'height', label: t(language, 'orient.ui.stat.height'), value: heightText(language, m.heightMm) },
  ];
}

/** Descripción completa de una opción para lectores de pantalla (el nombre accesible de la fila). */
export function optionLabel(language: LanguageCode, a: OrientAnalysis, c: OrientCandidate, index: number, chosen: boolean): string {
  const parts = [t(language, 'orient.ui.option', { n: index + 1 })];
  for (const b of badgesOf(a, c)) parts.push(t(language, b === 'current' ? 'orient.ui.badge.current' : 'orient.ui.badge.recommended'));
  if (chosen) parts.push(t(language, 'orient.ui.badge.chosen'));
  parts.push(...statsOf(language, c).map((s) => `${s.label} ${s.value}`));
  parts.push(...visibleReasons(c).map((r) => reasonText(language, r)));
  return parts.join('. ').replace(/\.\./g, '.');
}

export type OrientSummaryKind = 'equivalent' | 'best' | 'noBase' | 'better';

/** Una sola fuente del resumen: el texto visible y el de la region `role="status"` salen de aqui. */
export function summaryOf(language: LanguageCode, a: OrientAnalysis): { kind: OrientSummaryKind; text: string } {
  if (a.allEquivalent) return { kind: 'equivalent', text: t(language, 'orient.ui.summary.equivalent') };
  if (a.currentIsBest) return { kind: 'best', text: t(language, 'orient.ui.summary.best') };
  if (recommendedId(a) === null) return { kind: 'noBase', text: t(language, 'orient.ui.noStableBase') };
  return { kind: 'better', text: t(language, 'orient.ui.summary.better', { count: a.candidates.length }) };
}

/** Texto del resumen de arriba. */
export const summaryText = (language: LanguageCode, a: OrientAnalysis): string => summaryOf(language, a).text;

/** La opcion solo toca la cama con una arista o un punto (sin base de apoyo). */
export const hasNoBase = (c: OrientCandidate): boolean => c.reasons.some((r) => r.key === 'noBase');

export interface IndexedCandidate {
  c: OrientCandidate;
  index: number;
}

/**
 * Reparte las opciones: las validas arriba y, aparte, las «sin base» (salvo la actual, que siempre va con las
 * validas porque es donde esta la pieza). Conserva el numero de opcion (`index`) de la lista completa.
 */
export function splitCandidates(a: OrientAnalysis): { valid: IndexedCandidate[]; noBase: IndexedCandidate[] } {
  const valid: IndexedCandidate[] = [];
  const noBase: IndexedCandidate[] = [];
  a.candidates.forEach((c, index) => (hasNoBase(c) && c.id !== a.currentId ? noBase : valid).push({ c, index }));
  return { valid, noBase };
}
