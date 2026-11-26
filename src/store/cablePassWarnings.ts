/**
 * @file src/store/cablePassWarnings.ts
 * @description Avisos de un paso de cable recién colocado, a partir de su informe, del más grave al más suave: no
 * atraviesa (pared demasiado gruesa para medir, o profundidad a mano menor que la pared), a menos de 1,2 mm del borde
 * de la cara y a menos de 1,2 mm de otro agregado pendiente. Una sola fuente para el aviso emergente y el panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { CABLE_MAX_AUTO_MM, CABLE_MIN_GAP_MM } from '../core/addons/cablePass';
import type { CablePassReport } from '../core/addons/cablePassAnalysis';
import { t } from '../i18n';
import type { LanguageCode } from '../types/kura';
import type { AddonWarning } from './addonWarning';

export type CablePassWarningKind = 'noExit' | 'blind' | 'edge' | 'addon';

export function cablePassWarnings(report: CablePassReport, language: LanguageCode): AddonWarning<CablePassWarningKind>[] {
  const fmt = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 1 });
  const out: AddonWarning<CablePassWarningKind>[] = [];
  if (report.noExit) {
    out.push({ kind: 'noExit', key: 'cable.warn.noExit', short: 'cable.short.noExit', params: { max: fmt(CABLE_MAX_AUTO_MM), depth: fmt(report.boreMm) } });
  } else if (!report.through) {
    out.push({ kind: 'blind', key: 'cable.warn.blind', short: 'cable.short.blind', params: { depth: fmt(report.boreMm), wall: fmt(report.thicknessMm ?? 0) } });
  }
  if (report.nearEdge) out.push({ kind: 'edge', key: 'cable.warn.edge', short: 'cable.short.edge', params: { min: fmt(CABLE_MIN_GAP_MM) } });
  if (report.nearAddon) out.push({ kind: 'addon', key: 'cable.warn.addon', short: 'cable.short.addon', params: { min: fmt(CABLE_MIN_GAP_MM) } });
  return out;
}

export const cablePassWarningText = (w: AddonWarning, language: LanguageCode) => t(language, w.key, w.params);
