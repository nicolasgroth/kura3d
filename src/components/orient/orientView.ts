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

/** Volumen en mm³ si es chico y en cm³ si no (1 cm³ = 1000 mm³). */
export function volumeText(language: LanguageCode, mm3: number): string {
  if (mm3 < 1000) return formatQuantity(language, Math.round(mm3), 'mm³');
  const cm3 = mm3 / 1000;
  return formatQuantity(language, cm3, 'cm³', { maxFrac: cm3 >= 100 ? 0 : 1 });
}

/** Área en mm² si es chica y en cm² si no (1 cm² = 100 mm²). */
export function areaText(language: LanguageCode, mm2: number): string {
  if (mm2 < 100) return formatQuantity(language, Math.round(mm2), 'mm²');
  const cm2 = mm2 / 100;
  return formatQuantity(language, cm2, 'cm²', { maxFrac: cm2 >= 100 ? 0 : 1 });
}

export const heightText = (language: LanguageCode, mm: number): string => formatQuantity(language, mm, 'mm', { maxFrac: 1 });

/** Motivo del motor como frase: la persona lee «82 % menos soporte que ahora», no una clave. */
export function reasonText(language: LanguageCode, reason: OrientReason): string {
  switch (reason.key) {
    case 'supportVsCurrent': {
      const percent = Math.round(Math.abs(reason.params.percent));
      return t(language, reason.params.percent < 0 ? 'orient.reason.supportLess' : 'orient.reason.supportMore', { percent });
    }
    case 'supportAdded':
      return t(language, 'orient.reason.supportAdded', { volume: volumeText(language, reason.params.volumeMm3) });
    case 'baseVsCurrent':
      return t(language, 'orient.reason.baseVsCurrent', { factor: formatLocaleNumber(language, reason.params.factor, { maxFrac: 1 }) });
    case 'lowerVsCurrent':
      return t(language, 'orient.reason.lowerVsCurrent', { percent: Math.round(reason.params.percent) });
    case 'unstable':
      return t(language, 'orient.reason.unstable', { angle: formatLocaleNumber(language, reason.params.tipAngleDeg, { maxFrac: 1 }) });
    case 'current':
      return t(language, 'orient.reason.current');
    case 'noOverhangs':
      return t(language, 'orient.reason.noOverhangs');
    case 'equivalentToBest':
      return t(language, 'orient.reason.equivalentToBest');
    case 'doesNotFit':
      return t(language, 'orient.reason.doesNotFit');
  }
}

/** Motivos que se muestran: «Es como está ahora» ya lo dice la insignia «Actual». */
export const visibleReasons = (c: OrientCandidate): OrientReason[] => c.reasons.filter((r) => r.key !== 'current');

/** Id de la orientación recomendada, o `null` si no hay (la actual ya es la mejor o todas son equivalentes). */
export function recommendedId(a: OrientAnalysis): string | null {
  if (a.allEquivalent || a.currentIsBest) return null;
  return a.candidates[0]?.id ?? null;
}

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

/** Texto del resumen de arriba, o `null` si solo hay lista. */
export function summaryText(language: LanguageCode, a: OrientAnalysis): string {
  if (a.allEquivalent) return t(language, 'orient.ui.summary.equivalent');
  if (a.currentIsBest) return t(language, 'orient.ui.summary.best');
  return t(language, 'orient.ui.summary.better', { count: a.candidates.length });
}
