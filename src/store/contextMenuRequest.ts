/**
 * @file src/store/contextMenuRequest.ts
 * @description Petición de abrir el menú contextual de un objeto desde fuera del visor (filas del árbol de
 * Escena: clic derecho, Mayús+F10 o tecla Menú). El visor la atiende con las mismas acciones del menú del objeto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';

export interface ContextMenuRequest {
  objectId: string;
  /** Coordenadas de pantalla (clientX/clientY) del origen: el puntero o la fila con foco. */
  x: number;
  y: number;
  /** Elemento al que devolver el foco al cerrar el menú. */
  returnFocus: HTMLElement | null;
}

interface ContextMenuRequestState {
  request: ContextMenuRequest | null;
  open: (request: ContextMenuRequest) => void;
  clear: () => void;
}

export const useContextMenuRequest = create<ContextMenuRequestState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  clear: () => set({ request: null }),
}));
