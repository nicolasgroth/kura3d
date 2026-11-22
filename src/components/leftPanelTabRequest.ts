/**
 * @file src/components/leftPanelTabRequest.ts
 * @description Petición de pestaña del panel izquierdo (Formas o Escena). Quien abre el panel (el botón
 * «Formas» de la barra inferior estrecha) pide la pestaña que corresponde, en vez de heredar la última
 * visitada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';

export type LeftPanelTab = 'shapes' | 'scene';

interface LeftTabRequestState {
  tab: LeftPanelTab | null;
  n: number;
}

export const useLeftTabRequest = create<LeftTabRequestState>(() => ({ tab: null, n: 0 }));

/** Pide que el panel izquierdo muestre `tab`. */
export function requestLeftPanelTab(tab: LeftPanelTab): void {
  useLeftTabRequest.setState((s) => ({ tab, n: s.n + 1 }));
}
