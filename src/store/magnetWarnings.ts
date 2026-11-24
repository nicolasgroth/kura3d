/**
 * @file src/store/magnetWarnings.ts
 * @description Avisos de un alojamiento de imán recién colocado, a partir de su informe: pared bajo el mínimo o
 * hueco que atraviesa, imán que sobresale en una cara convexa, tapa de un imán oculto delgada o abierta y otro hueco pendiente demasiado cerca o superpuesto.
 * Una sola fuente para los avisos emergentes del store y las líneas del panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MIN_WALL_MM } from '../core/addons/magnetPocket';
import { MIN_COVER_MM, OPEN_COVER_MM } from '../core/addons/pocketSurface';
import type { PocketWallReport } from '../core/addons/pocketWall';
import { t, type TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';

export type MagnetWarningKind = 'wall' | 'protrude' | 'cover' | 'neighbor';

export interface MagnetWarning {
  kind: MagnetWarningKind;
  key: TranslationKey;
  params: Record<string, string>;
}

/** El aviso de pared: null si está bien. */
export function wallWarningKey(wall: Pick<PocketWallReport, 'through' | 'minWallMm'>): 'magnet.warn.through' | 'magnet.warn.wall' | null {
  if (wall.through) return 'magnet.warn.through';
  return wall.minWallMm < MIN_WALL_MM ? 'magnet.warn.wall' : null;
}

/** Aviso de la tapa de un imán oculto: se abre (queda a la vista) o queda bajo el mínimo; null si está bien o es abierto. */
export function coverWarningKey(report: Pick<PocketWallReport, 'coverMm'>): 'magnet.warn.exposed' | 'magnet.warn.thinCover' | null {
  const cover = report.coverMm;
  if (cover === null || cover === undefined) return null;
  if (cover < OPEN_COVER_MM) return 'magnet.warn.exposed';
  return cover < MIN_COVER_MM ? 'magnet.warn.thinCover' : null;
}

/** Todos los avisos del informe, en orden: pared, curvatura, tapa, vecino. Vacío si el hueco está bien. */
export function magnetWarnings(report: PocketWallReport, language: LanguageCode): MagnetWarning[] {
  const fmt = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 1 });
  const min = fmt(MIN_WALL_MM);
  const out: MagnetWarning[] = [];
  const wall = wallWarningKey(report);
  if (wall) out.push({ kind: 'wall', key: wall, params: { wall: fmt(report.minWallMm), min } });
  if (report.protrudeMm > 0) out.push({ kind: 'protrude', key: 'magnet.warn.protrude', params: { mm: fmt(report.protrudeMm) } });
  const cover = coverWarningKey(report);
  if (cover) {
    const mm = (report.coverMm ?? 0).toLocaleString(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    out.push({ kind: 'cover', key: cover, params: { mm, min: fmt(MIN_COVER_MM) } });
  }
  if (report.neighbor) {
    out.push(report.neighbor.overlap
      ? { kind: 'neighbor', key: 'magnet.warn.overlap', params: {} }
      : { kind: 'neighbor', key: 'magnet.warn.near', params: { gap: fmt(report.neighbor.gapMm), min } });
  }
  return out;
}

export const magnetWarningText = (w: MagnetWarning, language: LanguageCode) => t(language, w.key, w.params);
