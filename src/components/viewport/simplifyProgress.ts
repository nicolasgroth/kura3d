/**
 * @file src/components/viewport/simplifyProgress.ts
 * @description Fases de «Simplificar malla» en la barra de progreso, tal como las informa el motor
 * (`simplify:1/1` reduce, `simplify:3/12` intento de ajuste al objetivo, `simplify:verify` verificación), y el aviso
 * de que en modelos de más de un millón de triángulos puede tardar varios minutos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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
  if (rest.startsWith('safe:')) {
    const step = parseSimplifyStep(phase);
    return step ? simplifyStepLabel(language, step) : null;
  }
  const m = /^(\d{1,4})\/(\d{1,4})$/.exec(rest);
  if (!m) return null;
  const total = Number(m[2]);
  if (total <= 1) return t(language, 'simplify.progress.reduce');
  return t(language, 'simplify.progress.attempt', { done: formatNumber(language, Number(m[1])), total: formatNumber(language, total) });
}

export interface SimplifyStep {
  /** `attempt`: ajuste al objetivo (`simplify:3/12`); `safe`: búsqueda de la versión segura (`simplify:safe:2/8`). */
  kind: 'attempt' | 'safe';
  done: number;
  total: number;
}

/** Paso i de n de una fase de simplificar, o null si no es de pasos (reducir, verificar u otra operación). */
export function parseSimplifyStep(phase: string | null | undefined): SimplifyStep | null {
  if (!phase) return null;
  const m = /^simplify:(safe:)?(\d{1,4})\/(\d{1,4})$/.exec(phase);
  if (!m) return null;
  const total = Number(m[3]);
  if (total <= 1) return null;
  return { kind: m[1] ? 'safe' : 'attempt', done: Math.min(Number(m[2]), total), total };
}

/** Texto de un paso («intento 3 de 12», «paso 2 de 8» de la versión segura). */
export function simplifyStepLabel(language: LanguageCode, step: SimplifyStep): string {
  const params = { done: formatNumber(language, step.done), total: formatNumber(language, step.total) };
  return t(language, step.kind === 'safe' ? 'simplify.progress.safe' : 'simplify.progress.attempt', params);
}

/** Aviso de espera larga para modelos pesados; null si no corresponde. */
export function simplifySlowNote(language: LanguageCode, operation: string, triangles: number | null): string | null {
  if (operation !== 'simplify' || triangles === null || triangles <= SIMPLIFY_SLOW_TRIANGLES) return null;
  return t(language, 'simplify.progress.slow');
}
