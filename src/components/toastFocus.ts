/**
 * @file src/components/toastFocus.ts
 * @description Foco del centro de mensajes: cuando un emergente o una fila del histórico se cierra o se usa, el foco
 * no cae a `<body>`; vuelve al elemento que lo tenía antes (si sigue en el documento y a la vista) o, si no, al
 * visor 3D (el `application` del lienzo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** El lienzo del visor 3D, que hace de `application` con tabindex. */
export function viewerElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('canvas[role="application"]');
}

/** Lleva el foco al visor 3D. */
export function focusViewer(): void {
  viewerElement()?.focus({ preventScroll: true });
}

/** El foco se perdió: no hay elemento activo, es `<body>` o el elemento ya no está en el documento. */
export function focusIsLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body || !document.contains(active);
}

const isUsable = (el: HTMLElement | null): el is HTMLElement => Boolean(el && el.isConnected && el.getClientRects().length > 0 && !el.hasAttribute('disabled'));

/**
 * Tras un cierre o una acción: en el siguiente cuadro, si el foco se perdió (no lo tomó un diálogo ni otro control),
 * vuelve a `previous` o, si ya no sirve, al visor.
 */
export function restoreFocusAfter(previous: HTMLElement | null): void {
  requestAnimationFrame(() => {
    if (!focusIsLost()) return;
    if (isUsable(previous)) previous.focus({ preventScroll: true });
    else focusViewer();
  });
}
