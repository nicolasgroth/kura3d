/**
 * @file src/components/viewport/simplifyProgress.ts
 * @description Fases de «Simplificar malla» en la barra de progreso, tal como las informa el motor
 * (`simplify:1/1` reduce, `simplify:3/12` intento de ajuste al objetivo, `simplify:verify` verificación), y el aviso
 * de que en modelos de más de un millón de triángulos puede tardar varios minutos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';
import { formatNumber } from '../../utils/plural';

/** Triángulos desde los que el aviso de espera larga se muestra. */
export const SIMPLIFY_SLOW_TRIANGLES = 1_000_000;

/** Texto visible de una fase de simplificar, o null si la fase no es de simplificar. */
export function simplifyPhaseLabel(language: LanguageCode, phase: string | null | undefined): string | null {
  if (!phase || !phase.startsWith('simplify:')) return null;
  const rest = phase.slice('simplify:'.length);
  if (rest === 'verify') return t(language, 'simplify.progress.verify');
  const m = /^(\d{1,4})\/(\d{1,4})$/.exec(rest);
  if (!m) return null;
  const total = Number(m[2]);
  if (total <= 1) return t(language, 'simplify.progress.reduce');
  return t(language, 'simplify.progress.attempt', { done: formatNumber(language, Number(m[1])), total: formatNumber(language, total) });
}

/** Aviso de espera larga para modelos pesados; null si no corresponde. */
export function simplifySlowNote(language: LanguageCode, operation: string, triangles: number | null): string | null {
  if (operation !== 'simplify' || triangles === null || triangles <= SIMPLIFY_SLOW_TRIANGLES) return null;
  return t(language, 'simplify.progress.slow');
}
