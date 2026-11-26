/**
 * @file src/utils/unsavedGuard.ts
 * @description Protege acciones que reemplazan el proyecto (nuevo, abrir): si hay cambios sin guardar pregunta
 * con el diálogo propio (Guardar / Descartar / Cancelar) en vez de `confirm()` nativo. El store ya no pregunta:
 * la confirmación vive solo aquí.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t } from '../i18n';
import { isProjectDirty, useKuraStore } from '../store/useKuraStore';
import { askDecision } from './confirmDialog';

/**
 * Corre `proceed` tras resolver los cambios sin guardar. Devuelve false si el usuario canceló o si el
 * guardado no terminó (para no perder datos).
 */
export async function guardUnsavedChanges(proceed: () => unknown | Promise<unknown>): Promise<boolean> {
  const state = useKuraStore.getState();
  if (!isProjectDirty(state)) {
    await proceed();
    return true;
  }
  const { language } = state;
  const decision = await askDecision({
    title: t(language, 'unsaved.title'),
    message: t(language, 'unsaved.message', { name: state.projectName ?? t(language, 'app.untitled') }),
    safeId: 'cancel',
    actions: [
      { id: 'save', label: t(language, 'unsaved.save'), tone: 'primary' },
      { id: 'discard', label: t(language, 'unsaved.discard'), tone: 'danger' },
      { id: 'cancel', label: t(language, 'unsaved.cancel') },
    ],
  });
  if (decision === 'discard') {
    await proceed();
    return true;
  }
  if (decision !== 'save') return false;
  await state.saveProject();
  const after = useKuraStore.getState();
  if (isProjectDirty(after)) {
    after.addToast(t(after.language, 'unsaved.saveIncomplete'), 'info');
    return false;
  }
  await proceed();
  return true;
}
