/**
 * @file src/components/viewport/floatingBarActions.ts
 * @description Botones de la barra flotante de acciones y sus ejecutores. No hay lógica propia: cada botón llama a la
 * misma acción que el menú contextual del objeto (duplicar, Mayús+H de visibilidad, bloquear, eliminar con su
 * confirmación, color base) y rotula con las mismas claves de i18n, así un nombre no puede divergir del menú.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { TranslationKey } from '../../i18n';
import type { SceneObject } from '../../types/kura';
import { useKuraStore } from '../../store/useKuraStore';
import { confirmDeleteSelection } from '../scene/confirmDeleteSelection';

export type FloatingBarActionId = 'color' | 'duplicate' | 'hide' | 'lock' | 'delete' | 'more';

export interface FloatingBarItem {
  id: FloatingBarActionId;
  /** Nombre accesible; el mismo del menú contextual. */
  labelKey: TranslationKey;
  /** Tooltip propio cuando difiere del nombre. */
  tipKey?: TranslationKey;
  /** Estado de un botón de dos estados (Bloquear). */
  pressed?: boolean;
  /** Sin efecto sobre la selección actual (conserva foco y tooltip). */
  disabled?: boolean;
}

/** Los botones de la barra, en orden, para la selección dada. */
export function floatingBarItems(objects: readonly SceneObject[], selectedIds: readonly string[]): FloatingBarItem[] {
  const picked = objects.filter((o) => selectedIds.includes(o.id));
  const allLocked = picked.length > 0 && picked.every((o) => o.locked);
  const allHidden = picked.length > 0 && picked.every((o) => !o.visible);
  return [
    { id: 'color', labelKey: 'inspector.field.color' },
    { id: 'duplicate', labelKey: 'ctx.duplicate' },
    allHidden
      ? { id: 'hide', labelKey: 'ux8.menu.show', tipKey: 'ux8.menu.show.tip' }
      : { id: 'hide', labelKey: 'menu.more.hide', tipKey: 'menu.more.hide.tip' },
    {
      id: 'lock',
      labelKey: allLocked ? 'ux8.menu.unlock' : 'ux8.menu.lock',
      tipKey: allLocked ? 'ux8.menu.unlock.tip' : 'ux8.menu.lock.tip',
      pressed: allLocked,
    },
    { id: 'delete', labelKey: 'ctx.delete', disabled: picked.some((o) => o.locked) },
    { id: 'more', labelKey: 'menu.more', tipKey: 'floatingBar.more.tip' },
  ];
}

/** Ejecuta un botón sobre la selección actual del store (`color` y `more` los resuelve el componente). */
export function runFloatingBarAction(id: Exclude<FloatingBarActionId, 'color' | 'more'>): void {
  const s = useKuraStore.getState();
  const ids = s.selectedIds;
  if (ids.length === 0) return;
  switch (id) {
    case 'duplicate':
      s.duplicateObjects([...ids]);
      return;
    case 'hide':
      s.toggleSelectionVisibility();
      return;
    case 'lock': {
      const picked = s.objects.filter((o) => ids.includes(o.id));
      const allLocked = picked.every((o) => o.locked);
      picked.forEach((o) => s.updateObjectMeta(o.id, { locked: !allLocked }));
      return;
    }
    case 'delete':
      void confirmDeleteSelection([...ids]);
      return;
  }
}

/** Color base de toda la selección (lo mismo que el campo «Color base» del inspector, objeto por objeto). */
export function applyFloatingBarColor(hex: string): void {
  const s = useKuraStore.getState();
  s.selectedIds.forEach((id) => s.updateObjectMeta(id, { color: hex }));
}
