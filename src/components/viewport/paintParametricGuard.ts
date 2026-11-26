/**
 * @file src/components/viewport/paintParametricGuard.ts
 * @description Aviso antes del primer trazo del pincel sobre un objeto paramétrico (primitiva o rosca)
 * cuando el trazo refinará su malla: desde ahí el objeto deja de editarse por parámetros. Se pregunta
 * una sola vez por objeto y la respuesta "no volver a preguntar" vale para toda la sesión. Deshacer
 * devuelve el objeto paramétrico intacto (el historial guarda su estado completo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t } from '../../i18n';
import { parametricStateOf } from '../../core/scene/parametric';
import type { LanguageCode, SceneObject } from '../../types/kura';
import { askDecision } from '../../utils/confirmDialog';

/** Objetos ya consultados (aceptados) en esta sesión. */
const handled = new Set<string>();
let neverAsk = false;

/** true si pintar este objeto con el pincel de borde fino lo dejaría sin parámetros. */
export function paintWouldDropParameters(obj: SceneObject, willRefine: boolean): boolean {
  if (neverAsk || !willRefine || handled.has(obj.id)) return false;
  const state = parametricStateOf(obj);
  return state.status === 'primitive' || state.status === 'thread';
}

/**
 * Espera a que se suelte el botón del puntero (con un tope): un diálogo modal abierto en el pointerdown
 * recibiría el pointerup sobre su fondo y se cerraría solo.
 */
export function afterPointerRelease(timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('pointerup', done, true);
      window.removeEventListener('pointercancel', done, true);
      clearTimeout(timer);
      setTimeout(resolve, 60);
    };
    const timer = setTimeout(done, timeoutMs);
    window.addEventListener('pointerup', done, true);
    window.addEventListener('pointercancel', done, true);
  });
}

/** Pregunta al usuario; devuelve true si debe pintarse. Recuerda la respuesta afirmativa. */
export async function confirmPaintOnParametric(obj: SceneObject, language: LanguageCode): Promise<boolean> {
  const decision = await askDecision({
    title: t(language, 'paint.parametric.title'),
    message: t(language, 'paint.parametric.message', { name: obj.name }),
    safeId: 'cancel',
    actions: [
      { id: 'paint', label: t(language, 'paint.parametric.paint'), tone: 'primary' },
      { id: 'paintAlways', label: t(language, 'paint.parametric.paintAlways') },
      { id: 'cancel', label: t(language, 'dialog.cancel') },
    ],
  });
  if (decision === 'cancel') return false;
  handled.add(obj.id);
  if (decision === 'paintAlways') neverAsk = true;
  return true;
}

/** Solo para pruebas: olvida las respuestas de la sesión. */
export function resetPaintParametricGuard(): void {
  handled.clear();
  neverAsk = false;
}
