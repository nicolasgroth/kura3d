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
  /** Ícono del botón; distinto del id cuando el estado cambia el dibujo (Mostrar/Ocultar). */
  icon: 'palette' | 'copy' | 'eye' | 'eye-off' | 'lock' | 'unlock' | 'trash' | 'more';
  /** Estado de un botón de dos estados (Bloquear). */
  pressed?: boolean;
  /** Sin efecto sobre la selección actual (conserva foco y tooltip). */
  disabled?: boolean;
}

/** Lo único de la selección que la barra necesita: con esto se suscribe sin depender de toda la lista `objects`. */
export interface FloatingBarSelection {
  allLocked: boolean;
  anyLocked: boolean;
  allHidden: boolean;
  primaryId: string | null;
  primaryColor: string | null;
}

/** Resumen de la selección para la barra (valores planos: comparable con `useShallow`). */
export function floatingBarSelection(objects: readonly SceneObject[], selectedIds: readonly string[]): FloatingBarSelection {
  const picked = objects.filter((o) => selectedIds.includes(o.id));
  const primary = objects.find((o) => o.id === selectedIds[0]);
  return {
    allLocked: picked.length > 0 && picked.every((o) => o.locked),
    anyLocked: picked.some((o) => o.locked),
    allHidden: picked.length > 0 && picked.every((o) => !o.visible),
    primaryId: primary?.id ?? null,
    primaryColor: primary?.color ?? null,
  };
}

/** Los botones de la barra, en orden, para la selección dada. */
export function floatingBarItems(objects: readonly SceneObject[], selectedIds: readonly string[]): FloatingBarItem[] {
  return floatingBarItemsFor(floatingBarSelection(objects, selectedIds));
}

/** Los botones de la barra para un resumen de selección. */
export function floatingBarItemsFor({ allLocked, anyLocked, allHidden }: FloatingBarSelection): FloatingBarItem[] {
  return [
    // Una pieza bloqueada no cambia de color (`updateObjectsMeta` la salta): con todas bloqueadas no hay efecto.
    { id: 'color', labelKey: 'inspector.field.color', icon: 'palette', disabled: allLocked },
    { id: 'duplicate', labelKey: 'ctx.duplicate', icon: 'copy' },
    allHidden
      ? { id: 'hide', labelKey: 'ux8.menu.show', tipKey: 'ux8.menu.show.tip', icon: 'eye' }
      : { id: 'hide', labelKey: 'menu.more.hide', tipKey: 'menu.more.hide.tip', icon: 'eye-off' },
    {
      id: 'lock',
      labelKey: allLocked ? 'ux8.menu.unlock' : 'ux8.menu.lock',
      tipKey: allLocked ? 'ux8.menu.unlock.tip' : 'ux8.menu.lock.tip',
      pressed: allLocked,
      icon: allLocked ? 'lock' : 'unlock',
    },
    { id: 'delete', labelKey: 'ctx.delete', disabled: anyLocked, icon: 'trash' },
    { id: 'more', labelKey: 'menu.more', tipKey: 'floatingBar.more.tip', icon: 'more' },
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
      s.updateObjectsMeta(picked.map((o) => o.id), { locked: !allLocked });
      return;
    }
    case 'delete':
      void confirmDeleteSelection([...ids]);
      return;
  }
}

/** Color base de la selección (lo mismo que el campo «Color base» del inspector); las piezas bloqueadas no cambian. */
export function applyFloatingBarColor(hex: string, recordHistory = true): void {
  const s = useKuraStore.getState();
  s.updateObjectsMeta(s.selectedIds, { color: hex }, recordHistory);
}
