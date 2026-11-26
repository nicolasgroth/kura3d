/**
 * @file src/components/narrow/sheetHeight.ts
 * @description Alturas de la hoja inferior de pantallas estrechas (plegada, media, completa): orden, paso
 * siguiente y altura más cercana a un valor en píxeles. Lógica pura, sin DOM.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export type SheetHeight = 'folded' | 'half' | 'full';

export const SHEET_HEIGHTS: readonly SheetHeight[] = ['folded', 'half', 'full'];

/** Altura reservada fuera del visor y la hoja (barra superior, barra-asa y barra de estado), en px. */
const CHROME_PX = 136;

/** Altura en px de cada estado para una ventana de `viewportHeight` px (igual que las variables CSS). */
export function sheetPx(height: SheetHeight, viewportHeight: number): number {
  if (height === 'folded') return 0;
  if (height === 'full') return Math.round(viewportHeight * 0.7);
  // Media: ~38 % de la pantalla, pero el visor conserva al menos ~45 % de ella.
  return Math.round(Math.min(viewportHeight * 0.38, viewportHeight * 0.55 - CHROME_PX));
}

/** Siguiente altura al tocar el tirador: media, completa, plegada y vuelta a media. */
export function nextSheetHeight(height: SheetHeight): SheetHeight {
  if (height === 'folded') return 'half';
  if (height === 'half') return 'full';
  return 'folded';
}

/** Altura cuyo valor en px queda más cerca de `px` (al soltar un arrastre). */
export function nearestSheetHeight(px: number, viewportHeight: number): SheetHeight {
  let best: SheetHeight = 'folded';
  let bestDistance = Infinity;
  for (const height of SHEET_HEIGHTS) {
    const distance = Math.abs(sheetPx(height, viewportHeight) - px);
    if (distance < bestDistance) {
      best = height;
      bestDistance = distance;
    }
  }
  return best;
}
