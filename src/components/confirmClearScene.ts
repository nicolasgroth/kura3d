/**
 * @file src/components/confirmClearScene.ts
 * @description Pide confirmación (con el número de objetos) antes de vaciar la cama y, si se acepta, la
 * vacía. El store muestra después el aviso con «Deshacer».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t } from '../i18n';
import { tCount } from '../utils/plural';
import { useKuraStore } from '../store/useKuraStore';
import { askDecision } from '../utils/confirmDialog';

/** Devuelve true si se vació la cama. La acción segura (foco inicial) es Cancelar. */
export async function confirmClearScene(): Promise<boolean> {
  const { language, objects } = useKuraStore.getState();
  if (objects.length === 0) return false;
  const decision = await askDecision({
    title: t(language, 'scene.clear.title'),
    message: tCount(language, { one: 'scene.clear.message.one', other: 'scene.clear.message.other' }, objects.length),
    safeId: 'cancel',
    actions: [
      { id: 'clear', label: t(language, 'scene.clear.confirm'), tone: 'danger' },
      { id: 'cancel', label: t(language, 'dialog.cancel') },
    ],
  });
  if (decision !== 'clear') return false;
  useKuraStore.getState().clearScene();
  return true;
}
