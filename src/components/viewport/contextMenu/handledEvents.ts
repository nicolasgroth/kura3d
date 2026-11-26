/**
 * @file src/components/viewport/contextMenu/handledEvents.ts
 * @description Registro de los eventos `contextmenu` que ya atendió un objeto de la escena. El menú del fondo
 * no puede usar `defaultPrevented`: los controles de órbita llaman a `preventDefault` en todo clic derecho
 * sobre el lienzo, así que el menú del fondo nunca se abría.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

const handled = new WeakSet<Event>();

/** Marca el evento como atendido por un objeto (el menú del fondo no debe abrirse). */
export function markContextMenuHandled(event: Event): void {
  handled.add(event);
}

/** Indica si un objeto ya atendió este evento. */
export function isContextMenuHandled(event: Event): boolean {
  return handled.has(event);
}
