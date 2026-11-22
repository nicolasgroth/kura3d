/**
 * @file src/components/scene/confirmDeleteSelection.ts
 * @description Eliminar la selección: si es un grupo completo, pide confirmación con su nombre y el
 * número de objetos (Cancelar es la opción segura); el store avisa después con «Deshacer».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../../i18n';
import { selectedGroup } from '../../core/scene/groups';
import { useKuraStore } from '../../store/useKuraStore';
import { askDecision } from '../../utils/confirmDialog';
import { tCount } from '../../utils/plural';

/** Elimina `ids` (o la selección). Devuelve true si se eliminó algo. */
export async function confirmDeleteSelection(ids?: string[]): Promise<boolean> {
  const { language, objects, groups, selectedIds } = useKuraStore.getState();
  const targets = ids && ids.length ? ids : selectedIds;
  if (targets.length === 0) return false;
  const group = groups.length ? selectedGroup(objects, groups, targets) : null;
  if (group) {
    const decision = await askDecision({
      title: t(language, 'groups.delete.title'),
      message: tCount(language, { one: 'groups.delete.message.one', other: 'groups.delete.message.other' }, targets.length, { name: group.name }),
      safeId: 'cancel',
      actions: [
        { id: 'delete', label: t(language, 'groups.delete.confirm'), tone: 'danger' },
        { id: 'cancel', label: t(language, 'dialog.cancel') },
      ],
    });
    if (decision !== 'delete') return false;
  }
  useKuraStore.getState().deleteObjects(targets);
  return true;
}
