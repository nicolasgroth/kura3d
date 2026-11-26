/**
 * @file src/components/viewport/saveProgressLabel.ts
 * @description Fases del guardado en la barra de progreso: `save:encode:N` → Preparando la escena y el historial,
 * `save:compress:N` → Comprimiendo, `save:write` → Escribiendo el archivo, con su porcentaje para la barra determinada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../../i18n';
import { parseSavePhase } from '../../store/saveProgress';
import type { LanguageCode } from '../../types/kura';

export { parseSavePhase };

/** Texto visible de una fase de guardado (sin porcentaje, para no repetirlo en la región viva), o null. */
export function savePhaseLabel(language: LanguageCode, phase: string | null | undefined): string | null {
  const save = parseSavePhase(phase);
  return save ? t(language, `saveProgress.${save.step}`) : null;
}
