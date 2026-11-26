/**
 * @file src/store/keyholeWarnings.ts
 * @description Avisos de un ojo de cerradura recién colocado, a partir de su informe, del más grave al más suave:
 * atraviesa la pieza, pared detrás de la cámara bajo 1,2 mm, se asoma por un borde, no cuelga a la misma altura que
 * los otros ojos de la cara (la pieza colgaría torcida) y cara no vertical («normalmente va en la cara que mira al
 * muro»). Una sola fuente para el aviso emergente y las líneas del panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { KEYHOLE_LEVEL_TOLERANCE_MM, KEYHOLE_MIN_WALL_MM } from '../core/addons/keyhole';
import type { KeyholeReport } from '../core/addons/keyholeAnalysis';
import { t } from '../i18n';
import type { LanguageCode } from '../types/kura';
import type { AddonWarning } from './addonWarning';

export type KeyholeWarningKind = 'through' | 'wall' | 'edge' | 'level' | 'face';

export function keyholeWarnings(report: KeyholeReport, language: LanguageCode): AddonWarning<KeyholeWarningKind>[] {
  const fmt = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 1 });
  const out: AddonWarning<KeyholeWarningKind>[] = [];
  if (report.through) {
    out.push({ kind: 'through', key: 'keyhole.warn.through', short: 'keyhole.short.through', params: {} });
  } else if (report.wallBehindMm < KEYHOLE_MIN_WALL_MM - 1e-9) {
    out.push({ kind: 'wall', key: 'keyhole.warn.wall', short: 'keyhole.short.wall', params: { wall: fmt(report.wallBehindMm), min: fmt(KEYHOLE_MIN_WALL_MM) } });
  }
  if (report.edge) out.push({ kind: 'edge', key: 'keyhole.warn.edge', short: 'keyhole.short.edge', params: {} });
  if (report.levelOffsetMm !== null && report.levelOffsetMm > KEYHOLE_LEVEL_TOLERANCE_MM) {
    out.push({ kind: 'level', key: 'keyhole.warn.level', short: 'keyhole.short.level', params: { mm: fmt(report.levelOffsetMm) } });
  }
  if (!report.vertical) out.push({ kind: 'face', key: 'keyhole.warn.face', short: 'keyhole.short.face', params: {} });
  return out;
}

export const keyholeWarningText = (w: AddonWarning, language: LanguageCode) => t(language, w.key, w.params);
