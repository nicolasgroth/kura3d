/**
 * @file src/project/recoveryOffer.ts
 * @description Qué borradores de recuperación se ofrecen en el aviso de «Borradores locales»: ni los
 * del editor activo ni los que no traen objetos (no hay nada que recuperar).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { RecoveryDraftInfo } from './projectRecoveryStorage';

/** true si el borrador trae objetos (los borradores antiguos sin el dato se ofrecen igual). */
export const draftHasContent = (draft: Pick<RecoveryDraftInfo, 'objectCount'>): boolean => draft.objectCount !== 0;

/** Borradores que vale la pena ofrecer, sin los ids indicados (p. ej. el del editor activo). */
export function offerableRecoveryDrafts<T extends RecoveryDraftInfo>(drafts: readonly T[], excludeIds: readonly string[]): T[] {
  return drafts.filter((draft) => !excludeIds.includes(draft.id) && draftHasContent(draft));
}
