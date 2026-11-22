/**
 * @file src/components/split/splitProgress.ts
 * @description Traducción de la fase de progreso del motor para la barra de operación: `cut:i/n`
 * ("Cortando 3 de 7") y su fracción para la barra determinada. Otras fases no tienen texto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';
import { formatNumber } from '../../utils/plural';

/** Avance de una fase `cut:i/n` (o null si la fase no tiene ese formato). */
export function parseCutPhase(phase: string | null | undefined): { done: number; total: number } | null {
  const m = phase ? /^cut:(\d+)\/(\d+)$/.exec(phase) : null;
  if (!m) return null;
  const done = Number(m[1]);
  const total = Number(m[2]);
  return total > 0 && done >= 0 && done <= total ? { done, total } : null;
}

/** Texto visible de la fase (p. ej. "Cortando 3 de 7") o null si no hay nada que mostrar. */
export function progressPhaseLabel(language: LanguageCode, phase: string | null | undefined): string | null {
  const cut = parseCutPhase(phase);
  if (!cut) return null;
  // El corte en curso es el siguiente al último terminado (sin pasar del total).
  const current = Math.min(cut.total, cut.done + 1);
  return t(language, 'progress.phase.cut', {
    current: formatNumber(language, current),
    total: formatNumber(language, cut.total),
  });
}
