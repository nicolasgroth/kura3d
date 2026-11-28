/**
 * @file src/components/plates/plateChipFocus.ts
 * @description Foco de la tira de placas: tras crear o borrar una placa el foco va a la ficha de la placa activa (el botón que se usó desaparece o cambia de nombre y el foco caería a body). Petición de un solo uso con caducidad.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

let requestedAt = 0;
const WINDOW_MS = 2000;

/** Pide llevar el foco a la ficha activa en cuanto la tira se vuelva a dibujar. */
export function requestChipFocus(): void {
  requestedAt = performance.now();
}

/** true una sola vez por petición, y solo si no caducó. */
export function consumeChipFocusRequest(): boolean {
  const live = requestedAt > 0 && performance.now() - requestedAt < WINDOW_MS;
  requestedAt = 0;
  return live;
}

/** Lleva el foco al botón principal de la ficha activa; si no existe, al visor. */
export function focusActiveChip(list: HTMLElement | null, fallback: () => void): void {
  const button = list?.querySelector<HTMLElement>('[data-active="true"] button.kura-plate-chip-main');
  if (button) button.focus();
  else fallback();
}
