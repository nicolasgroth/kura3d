/**
 * @file src/core/scene/floatingBarPlacement.ts
 * @description Colocación pura de la barra flotante de acciones: proyección de la caja de la selección a pantalla
 * (cajas y puntos en coordenadas del visor) y posición de la barra centrada sobre la caja, con margen; si arriba
 * no cabe va debajo y nunca se sale del visor. Sin Three.js ni DOM: el bucle del visor solo aporta los puntos ya
 * proyectados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export interface ScreenPoint {
  x: number;
  y: number;
  /** false si el punto queda detrás de la cámara (no sirve para anclar). */
  inFront: boolean;
}

export interface ScreenExtent {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BarPlacement {
  x: number;
  y: number;
  /** «above»: sobre el objeto; «below»: debajo (arriba no cabía); «pinned»: ni arriba ni abajo caben, pegada al borde. */
  side: 'above' | 'below' | 'pinned';
}

export const BAR_MARGIN_PX = 8;
export const BAR_GAP_PX = 10;

/** Caja en pantalla de los puntos proyectados (null si alguno queda detrás de la cámara o no hay puntos). */
export function screenExtent(points: readonly ScreenPoint[]): ScreenExtent | null {
  if (points.length === 0) return null;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const p of points) {
    if (!p.inFront || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    if (p.x < left) left = p.x;
    if (p.x > right) right = p.x;
    if (p.y < top) top = p.y;
    if (p.y > bottom) bottom = p.y;
  }
  return { left, right, top, bottom };
}

/** true si la caja se cruza con el visor (si no se ve nada del objeto, la barra no tiene a qué anclarse). */
export function extentIntersectsViewport(extent: ScreenExtent, viewport: { width: number; height: number }): boolean {
  return extent.right >= 0 && extent.left <= viewport.width && extent.bottom >= 0 && extent.top <= viewport.height;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Esquina superior izquierda de la barra (px, relativa al visor). Centrada en la caja y encima con `gap`; si arriba
 * no cabe (por el margen o por `topInset`, la franja de la interfaz fija del borde superior) va debajo; si tampoco
 * cabe abajo, queda pegada al borde con más espacio. Siempre dentro del visor mientras el visor sea mayor que la barra.
 */
export function placeFloatingBar(input: {
  extent: ScreenExtent;
  bar: { width: number; height: number };
  viewport: { width: number; height: number };
  margin?: number;
  gap?: number;
  topInset?: number;
}): BarPlacement {
  const { extent, bar, viewport } = input;
  const margin = input.margin ?? BAR_MARGIN_PX;
  const gap = input.gap ?? BAR_GAP_PX;
  const minY = margin + (input.topInset ?? 0);
  const maxY = Math.max(minY, viewport.height - margin - bar.height);
  const maxX = Math.max(margin, viewport.width - margin - bar.width);
  const x = clamp((extent.left + extent.right) / 2 - bar.width / 2, margin, maxX);

  const above = extent.top - gap - bar.height;
  if (above >= minY) return { x, y: Math.min(above, maxY), side: 'above' };
  const below = extent.bottom + gap;
  if (below <= maxY) return { x, y: Math.max(below, minY), side: 'below' };
  // Objeto que ocupa casi todo el visor: pegada al borde superior libre.
  return { x, y: clamp(above, minY, maxY), side: 'pinned' };
}
