/**
 * @file src/store/contextMenuRequest.ts
 * @description Petición de abrir el menú contextual de un objeto o grupo desde una fila del árbol de Escena (filas del árbol de
 * Escena: clic derecho, Mayús+F10 o tecla Menú). `RowContextMenuHost` la atiende junto a la fila, con las mismas acciones del menú del objeto o las del menú de grupo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';

export interface ContextMenuRequest {
  /** Objeto de la fila; `null` cuando la fila es un grupo (ver `groupId`). */
  objectId: string | null;
  /** Grupo de la fila (menú de grupo). */
  groupId?: string;
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
