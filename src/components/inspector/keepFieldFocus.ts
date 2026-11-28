/**
 * @file src/components/inspector/keepFieldFocus.ts
 * @description Esc dentro de un campo numérico restaura su valor y el campo se desenfoca (el foco caería a `<body>`):
 * este manejador, puesto en la captura del contenedor, lo devuelve al mismo campo en cuanto termina el evento.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type React from 'react';
import { focusIsLost } from '../toastFocus';

/** `onKeyDownCapture` del contenedor de campos: tras Esc en un `<input>`, si el foco se perdió, vuelve a él. */
export function keepFocusOnEscape(e: React.KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'Escape' || !(e.target instanceof HTMLInputElement)) return;
  const field = e.target;
  window.setTimeout(() => {
    if (field.isConnected && focusIsLost()) field.focus({ preventScroll: true });
  }, 0);
}
