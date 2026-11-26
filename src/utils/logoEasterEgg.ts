/**
 * @file src/utils/logoEasterEgg.ts
 * @description Lógica del huevo de pascua del logo: cuenta clics seguidos (cada uno a menos de
 * `EGG_GAP_MS` del anterior) y, al llegar a `EGG_CLICKS`, avisa a `EasterEggHost` con un contador de
 * ejecuciones. Sin temporizadores propios ni estado persistente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create } from 'zustand';

/** Clics seguidos que lo disparan. */
export const EGG_CLICKS = 10;
/** Tiempo máximo entre dos clics para que cuenten como seguidos. */
export const EGG_GAP_MS = 600;
/** Duración de la animación y del mensaje. */
export const EGG_DURATION_MS = 3000;

let clickCount = 0;
let lastClickAt = 0;

/** Registra un clic en el logo; devuelve true cuando completa la serie (y reinicia la cuenta). */
export function registerLogoClick(now: number = Date.now()): boolean {
  clickCount = now - lastClickAt <= EGG_GAP_MS ? clickCount + 1 : 1;
  lastClickAt = now;
  if (clickCount >= EGG_CLICKS) {
    clickCount = 0;
    return true;
  }
  return false;
}

/** Reinicia la cuenta de clics (pruebas). */
export function resetLogoClicks(): void {
  clickCount = 0;
  lastClickAt = 0;
}

interface EggState {
  /** Sube en 1 cada vez que se lanza; 0 = nunca se lanzó. */
  runId: number;
}

export const useEggStore = create<EggState>(() => ({ runId: 0 }));

/** Lanza el huevo de pascua (también desde el botón del diálogo «Acerca de»). */
export function triggerEgg(): void {
  useEggStore.setState((s) => ({ runId: s.runId + 1 }));
}

/** Atajo del logo: cuenta el clic y lanza el huevo si completa la serie. */
export function handleLogoClick(): void {
  if (registerLogoClick()) triggerEgg();
}
