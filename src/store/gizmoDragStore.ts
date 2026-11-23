/**
 * @file src/store/gizmoDragStore.ts
 * @description Estado efímero del arrastre del gizmo (modo, objeto y transformación al empezar) para la
 * lectura del cambio junto al cursor. No entra al historial ni al proyecto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import type { GizmoDragMode, TransformSample } from '../core/scene/dragReadout';
import { useKuraStore } from './useKuraStore';

export interface GizmoDragStart extends TransformSample {
  mode: GizmoDragMode;
  id: string;
}

interface GizmoDragState {
  start: GizmoDragStart | null;
  /** Empieza a leer el arrastre del primer objeto seleccionado con el modo activo. */
  begin: () => void;
  end: () => void;
}

export const useGizmoDragStore = create<GizmoDragState>((set) => ({
  start: null,
  begin: () => {
    const s = useKuraStore.getState();
    const obj = s.objects.find((o) => o.id === s.selectedIds[0]);
    if (!obj) return;
    set({
      start: {
        mode: s.transformMode,
        id: obj.id,
        position: [...obj.position],
        rotation: [...obj.rotation],
        scale: [...obj.scale],
      },
    });
  },
  end: () => set({ start: null }),
}));
