/**
 * @file src/store/measureSceneSync.ts
 * @description Mantiene las mediciones acordes con el documento: al abrir otro proyecto (o crear uno
 * nuevo) se descartan, porque sus objetos ya no existen. Vaciar la cama las limpia desde su acción.
 * Borrar un objeto o cambiar su malla NO las descarta: quedan desactualizadas y vuelven si se deshace.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useKuraStore } from './useKuraStore';
import { useMeasureStore } from './measureStore';

let installed = false;

/** Suscribe una sola vez el reinicio de las mediciones al cambiar de proyecto. */
export function installMeasureSceneSync(): void {
  if (installed) return;
  installed = true;
  let draftId = useKuraStore.getState().projectDraftId;
  useKuraStore.subscribe((state) => {
    if (state.projectDraftId === draftId) return;
    draftId = state.projectDraftId;
    const m = useMeasureStore.getState();
    if (m.measurements.length > 0 || m.pending.length > 0 || m.capacity) m.reset();
  });
}

installMeasureSceneSync();
