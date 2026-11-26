/**
 * @file src/store/leftSidebarAutoFold.ts
 * @description Mientras hay un panel de operación abierto en una ventana angosta (menos de 1200 px), la lista de escena
 * se pliega sola (al modo oculto, el mismo del botón «<» del borde del visor) para que el visor conserve ancho útil, y
 * se restaura al cerrar el panel. No es una preferencia: no se guarda. Si la persona la abre o la cierra a mano mientras
 * tanto, se respeta su decisión y no se restaura nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useKuraStore } from './useKuraStore';

/** Por debajo de este ancho de ventana (px) la lista se pliega con un panel abierto. */
export const AUTO_FOLD_BELOW_PX = 1200;
/** Por debajo de este ancho la interfaz es la angosta (hojas), que no usa este plegado. */
const NARROW_UI_PX = 768;

/** Paneles de operación abiertos a la vez (la lista se restaura al cerrarse el último). */
let openPanels = 0;

/** Un panel de operación se abrió: pliega la lista si la ventana es angosta y estaba abierta. */
export function panelOpened(viewportWidth: number = typeof window === 'undefined' ? Infinity : window.innerWidth): void {
  openPanels += 1;
  const s = useKuraStore.getState();
  if (viewportWidth >= AUTO_FOLD_BELOW_PX || viewportWidth < NARROW_UI_PX) return;
  if (s.leftSidebarMode !== 'full' || s.leftAutoFolded) return;
  useKuraStore.setState({ leftSidebarMode: 'hidden', leftCollapsed: true, leftAutoFolded: true });
}

/** Un panel de operación se cerró: si fue el último y la lista seguía plegada por este motivo, la restaura. */
export function panelClosed(): void {
  openPanels = Math.max(0, openPanels - 1);
  if (openPanels > 0) return;
  const s = useKuraStore.getState();
  if (!s.leftAutoFolded) return;
  useKuraStore.setState({ leftAutoFolded: false, ...(s.leftSidebarMode === 'hidden' ? { leftSidebarMode: 'full', leftCollapsed: false } : {}) });
}

/** Solo para pruebas: vuelve el contador a cero. */
export function resetAutoFoldForTests(): void {
  openPanels = 0;
}
