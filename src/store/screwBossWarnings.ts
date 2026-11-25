/**
 * @file src/store/screwBossWarnings.ts
 * @description Avisos de una torreta recién colocada, a partir de su informe: agujero que sale por el otro lado de
 * la pieza o que entra en ella más allá del poste, pared del poste bajo el mínimo y choque con otra torreta o con un
 * imán pendiente. Una sola fuente para el aviso emergente y las líneas del panel, en orden de gravedad.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { BOSS_MIN_WALL_MM } from '../core/addons/screwBoss';
import type { ScrewBossReport } from '../core/addons/screwBossAnalysis';
import { t, type TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';

export type ScrewBossWarningKind = 'through' | 'wall' | 'collide';

export interface ScrewBossWarning {
  kind: ScrewBossWarningKind;
  key: TranslationKey;
  short: TranslationKey;
  params: Record<string, string>;
}

/** Todos los avisos, del más grave al menos grave. Vacío si la torreta está bien. */
export function screwBossWarnings(report: ScrewBossReport, language: LanguageCode): ScrewBossWarning[] {
  const fmt = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 1 });
  const out: ScrewBossWarning[] = [];
  if (report.exits) {
    out.push({ kind: 'through', key: 'turret.warn.exits', short: 'turret.short.exits', params: {} });
  } else if (report.intoHostMm > 0) {
    out.push({ kind: 'through', key: 'turret.warn.into', short: 'turret.short.into', params: { mm: fmt(report.intoHostMm) } });
  }
  if (report.wallMm < BOSS_MIN_WALL_MM - 1e-9) {
    out.push({ kind: 'wall', key: 'turret.warn.wall', short: 'turret.short.wall', params: { wall: fmt(report.wallMm), min: fmt(BOSS_MIN_WALL_MM) } });
  }
  if (report.collides) out.push({ kind: 'collide', key: 'turret.warn.collide', short: 'turret.short.collide', params: {} });
  return out;
}

export const screwBossWarningText = (w: ScrewBossWarning, language: LanguageCode) => t(language, w.key, w.params);
export const screwBossWarningShortText = (w: ScrewBossWarning, language: LanguageCode) => t(language, w.short);
