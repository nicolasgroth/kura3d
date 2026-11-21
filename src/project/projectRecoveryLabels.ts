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
