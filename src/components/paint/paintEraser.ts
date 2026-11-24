/**
 * @file src/components/paint/paintEraser.ts
 * @description Estado de la goma de Pintar, compartido entre la barra del visor y el panel derecho: con la goma
 * activa el pincel usa el color base del objeto (devuelve las caras a su aspecto original); al apagarla, o al
 * elegir otro color, se recupera el color de pincel anterior.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import { usePaintPalette } from '../../store/paintPalette';
import { useKuraStore } from '../../store/useKuraStore';
import { contrastingPaintColor } from '../../utils/paintContrast';

interface EraserState {
  eraser: boolean;
  /** Color del pincel antes de encender la goma. */
  colorBefore: string | null;
}

export const usePaintEraser = create<EraserState>(() => ({ eraser: false, colorBefore: null }));

export function toggleEraser(): void {
  const { eraser, colorBefore } = usePaintEraser.getState();
  if (eraser) {
    if (colorBefore) useKuraStore.getState().setPaintSettings({ paintColor: colorBefore });
    usePaintEraser.setState({ eraser: false, colorBefore: null });
    return;
  }
  usePaintEraser.setState({ eraser: true, colorBefore: useKuraStore.getState().paintColor });
}

/** Elige un color de pincel (apaga la goma sin recuperar el color anterior). */
export function choosePaintColor(hex: string): void {
  usePaintEraser.setState({ eraser: false, colorBefore: null });
  useKuraStore.getState().setPaintSettings({ paintColor: hex });
}

/**
 * Si el pincel es igual o casi igual al color del objeto, el trazo no se vería: pasa al siguiente color de la
 * paleta que contraste (salvo con la goma, que pinta a propósito con el color base).
 */
export function ensureVisiblePaintColor(baseColor: string): void {
  if (usePaintEraser.getState().eraser) return;
  const current = useKuraStore.getState().paintColor;
  const next = contrastingPaintColor(current, baseColor, usePaintPalette.getState().colors);
  if (next !== current) useKuraStore.getState().setPaintSettings({ paintColor: next });
}

/** Al salir de Pintar con la goma activa se recupera el color de pincel anterior. */
export function resetEraserOnExit(): void {
  const { colorBefore } = usePaintEraser.getState();
  if (colorBefore) useKuraStore.getState().setPaintSettings({ paintColor: colorBefore });
  usePaintEraser.setState({ eraser: false, colorBefore: null });
}
