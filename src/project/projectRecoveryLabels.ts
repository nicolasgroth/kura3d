/**
 * @file src/project/projectRecoveryLabels.ts
 * @description Etiquetas legibles (nombre, fecha, identificador) para los borradores de recuperación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../i18n';
import type { LanguageCode } from '../types/kura';
import type { RecoveryDraftInfo } from './projectRecoveryStorage';

export function recoveryDraftTime(draft: RecoveryDraftInfo, language: LanguageCode) {
  return new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'medium' })
    .format(draft.updatedAt);
}

export function recoveryDraftLabel(draft: RecoveryDraftInfo, language: LanguageCode) {
  const name = draft.name ?? t(language, 'app.untitled');
  return `${name} · ${recoveryDraftTime(draft, language)} · #${draft.id.slice(-6)}`;
}
