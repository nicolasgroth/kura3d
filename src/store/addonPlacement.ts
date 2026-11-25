/**
 * @file src/store/addonPlacement.ts
 * @description Lo común a colocar un agregado con clic (imán, torreta, ojo de cerradura, paso de cable): correr la
 * colocación sin cambiar la selección que había y dejar un solo aviso por panel que reemplaza al anterior.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ToastMessage } from './storeTypes';
import { useKuraStore } from './useKuraStore';

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Corre `place` (que espera al Worker) y deja la selección como estaba. Mientras el Worker trabaja el usuario puede
 * seleccionar otra cosa o borrar piezas: la selección previa se restaura solo si al terminar quedó en la pieza recién
 * creada (lo que haría la colocación) o no cambió; si la cambió otro, se respeta. Nunca deja ids de piezas que ya no
 * existen.
 */
export async function placeKeepingSelection<T>(place: () => Promise<T | null>, createdId: (result: T) => string): Promise<T | null> {
  const before = useKuraStore.getState().selectedIds;
  const result = await place();
  const { selectedIds: now, objects } = useKuraStore.getState();
  const changedByPlacement = now === before || (result !== null && sameIds(now, [createdId(result)]));
  const base = changedByPlacement ? before : now;
  const alive = new Set(objects.map((o) => o.id));
  const next = base.filter((id) => alive.has(id));
  if (!sameIds(next, now)) useKuraStore.setState({ selectedIds: next });
  return result;
}

/** Aviso de colocación de un panel: cada uno nuevo reemplaza al anterior (apilados tapaban la pieza en el visor). */
export function createPlacementToast(): (text: string, kind: ToastMessage['kind']) => void {
  let lastId: string | null = null;
  return (text, kind) => {
    const previous = lastId;
    if (previous) useKuraStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== previous) }));
    lastId = useKuraStore.getState().addToast(text, kind);
  };
}
