/**
 * @file src/store/slices/viewModeSlice.ts
 * @description Selector de modos de vista Imprimir / Armado / Libre (lote P4). `setViewMode` cambia la disposición real
 * con `setLayout` (que no agrega paso de deshacer) y, para «Libre», activa la preferencia de sesión `freeView` (no entra
 * en el `.kura` ni en el historial). Si la escena está ocupada o hay un trazo de pintura abierto, no cambia nada y
 * devuelve el motivo. También guarda la separación visual de la figura (`figureExplode`, solo dibujo, fuera del
 * historial): vuelve a 0 al volver a Imprimir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { layoutOfViewMode, viewModeOf, type ViewMode } from '../../core/scene/viewMode';
import type { StoreContext } from '../storeContext';
import type { CameraPresetType, KuraStoreState } from '../storeTypes';

/**
 * Encuadre al cambiar de disposición: la cámara no se queda pegada a la pieza seleccionada. Armado encuadra la figura
 * entera; Imprimir encuadra la cama activa con «Solo esta», todas las camas con varias placas o, si no, la escena.
 */
export function framingAfterLayoutChange(state: Pick<KuraStoreState, 'plateSolo' | 'plates'>, to: 'print' | 'assembly'): CameraPresetType {
  if (to === 'assembly') return 'scene';
  if (state.plateSolo && state.plates.length >= 2) return 'activePlateFit';
  return state.plates.length >= 2 ? 'plates' : 'scene';
}

export type ViewModeResult = 'changed' | 'same' | 'busy' | 'stroke';

/** Alcance de la separación visual: el grupo de la selección o toda la figura. */
export type FigureExplodeScope = 'group' | 'all';

export interface FigureExplode {
  scope: FigureExplodeScope;
  /** Con alcance de grupo: llave del grupo (`g:<id>` de escena, `s:<id>` de Dividir). */
  groupKey: string | null;
  factor: number;
}

export interface ViewModeSliceState {
  /** «Libre» (Armado sin plano de apoyo ni avisos). Preferencia de sesión: solo se lee con `layout === 'assembly'`. */
  freeView: boolean;
  /** Cambia de modo de vista. No agrega paso de deshacer. `busy` y `stroke` dicen por qué se rechazó. */
  setViewMode: (mode: ViewMode) => ViewModeResult;
  /** Separación visual de piezas armadas (no cambia poses). `null` o factor 0 = armado exacto. */
  figureExplode: FigureExplode | null;
  setFigureExplode: (value: FigureExplode | null) => void;
}

export function createViewModeSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, runtime, isHistoryLocked } = ctx;
  return {
    freeView: false,
    figureExplode: null,

    setViewMode: (mode) => {
      const state = get();
      if (viewModeOf(state.layout, state.freeView) === mode) return 'same';
      // Operación en curso, arrastre sin soltar o trazo abierto: cambiar de pose ahora desfasaría el paso guardado.
      if (isHistoryLocked()) return 'busy';
      if (runtime.paintStroke.open) return 'stroke';
      const wantedLayout = layoutOfViewMode(mode);
      if (state.layout !== wantedLayout && !state.setLayout(wantedLayout)) return 'busy';
      // La separación visual solo existe fuera de Imprimir.
      set({ freeView: mode === 'free', ...(mode === 'print' ? { figureExplode: null } : {}) });
      if (state.layout !== wantedLayout) get().requestCameraPreset(framingAfterLayoutChange(get(), wantedLayout));
      return 'changed';
    },

    setFigureExplode: (value) => {
      if (!value || !(value.factor > 0)) {
        if (get().figureExplode) set({ figureExplode: null });
        return;
      }
      set({ figureExplode: { ...value, factor: Math.min(1, value.factor) } });
    },
  };
}
