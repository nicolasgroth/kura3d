/**
 * @file src/store/minWidthNotice.ts
 * @description Aviso de pantalla angosta: la app está pensada para 1024 px de ancho o más. Bajo ese ancho se
 * avisa una vez por sesión (al abrir o al achicar la ventana) y se deja seguir usando; no bloquea nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../i18n';
import { useKuraStore } from './useKuraStore';

/** Ancho mínimo soportado de la ventana (px). */
export const MIN_SUPPORTED_WIDTH_PX = 1024;

let shown = false;

/** Solo para pruebas: permite volver a mostrar el aviso. */
export function resetMinWidthNotice(): void {
  shown = false;
}

/** Empieza a vigilar el ancho de la ventana; devuelve la función que deja de hacerlo. */
export function startMinWidthNotice(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(`(max-width: ${MIN_SUPPORTED_WIDTH_PX - 1}px)`);
  const check = () => {
    if (shown || !query.matches) return;
    shown = true;
    const state = useKuraStore.getState();
    state.addToast(t(state.language, 'ux8.minWidth.notice'), 'info');
  };
  check();
  query.addEventListener('change', check);
  return () => query.removeEventListener('change', check);
}
