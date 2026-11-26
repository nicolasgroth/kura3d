/**
 * @file src/project/projectRecoveryLabels.ts
 * @description Etiquetas legibles (nombre, fecha, identificador) para los borradores de recuperación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t } from '../i18n';
import type { LanguageCode } from '../types/kura';
import type { RecoveryDraftInfo } from './projectRecoveryStorage';

export function recoveryDraftTime(draft: RecoveryDraftInfo, language: LanguageCode) {
  return new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'medium' })
    .format(draft.updatedAt);
}

/** Hace cuánto se guardó el borrador («hace 5 minutos»), en el idioma de la interfaz. */
export function recoveryDraftAgo(draft: RecoveryDraftInfo, language: LanguageCode, now = Date.now()) {
  const seconds = Math.round((draft.updatedAt - now) / 1000);
  const fmt = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 60) return fmt.format(seconds, 'second');
  if (abs < 3600) return fmt.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return fmt.format(Math.round(seconds / 3600), 'hour');
  return fmt.format(Math.round(seconds / 86400), 'day');
}

export function recoveryDraftLabel(draft: RecoveryDraftInfo, language: LanguageCode) {
  const name = draft.name ?? t(language, 'app.untitled');
  return `${name} · ${recoveryDraftTime(draft, language)} · #${draft.id.slice(-6)}`;
}
