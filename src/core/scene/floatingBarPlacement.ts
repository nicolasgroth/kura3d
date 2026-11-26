/**
 * @file src/core/scene/floatingBarPlacement.ts
 * @description Colocación pura de la barra flotante de acciones: proyección de la caja de la selección a pantalla
 * (cajas y puntos en coordenadas del visor) y posición de la barra centrada sobre la caja, con margen; si arriba
 * no cabe va debajo y nunca se sale del visor. Sin Three.js ni DOM: el bucle del visor solo aporta los puntos ya
 * proyectados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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
  /**
   * «above»: sobre el objeto; «below»: debajo (arriba no cabía); «right» / «left»: a un lado (ni arriba ni abajo cabían);
   * «pinned»: el objeto llena el visor y no hay hueco fuera de él, pegada al borde.
   */
  side: 'above' | 'below' | 'right' | 'left' | 'pinned';
}

/** Zona de la interfaz fija sobre el visor (rótulo de la vista, etc.), en coordenadas del visor: la barra no la tapa. */
export type Obstacle = ScreenExtent;

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
 * cabe abajo, va a la derecha o a la izquierda de la caja (siempre fuera de ella, centrada en vertical); solo si
 * el objeto llena el visor queda pegada al borde superior libre. Siempre dentro del visor mientras el visor sea mayor que la barra.
 */
export function placeFloatingBar(input: {
  extent: ScreenExtent;
  bar: { width: number; height: number };
  viewport: { width: number; height: number };
  margin?: number;
  gap?: number;
  topInset?: number;
  /** Zonas fijas que la barra evita (se prueba otro lado del objeto antes de taparlas). */
  obstacles?: readonly Obstacle[];
}): BarPlacement {
  const { extent, bar, viewport } = input;
  const margin = input.margin ?? BAR_MARGIN_PX;
  const gap = input.gap ?? BAR_GAP_PX;
  const minY = margin + (input.topInset ?? 0);
  const maxY = Math.max(minY, viewport.height - margin - bar.height);
  const maxX = Math.max(margin, viewport.width - margin - bar.width);
  const x = clamp((extent.left + extent.right) / 2 - bar.width / 2, margin, maxX);
  const obstacles = input.obstacles ?? [];
  const hits = (px: number, py: number) => obstacles.some((o) => px < o.right && px + bar.width > o.left && py < o.bottom && py + bar.height > o.top);
  const midY = clamp((extent.top + extent.bottom) / 2 - bar.height / 2, minY, maxY);

  // Candidatos en orden de preferencia; el primero que cabe y no tapa una zona fija gana.
  const above = extent.top - gap - bar.height;
  const below = extent.bottom + gap;
  const right = extent.right + gap;
  const left = extent.left - gap - bar.width;
  const candidates: Array<BarPlacement & { fits: boolean }> = [
    { x, y: Math.min(above, maxY), side: 'above', fits: above >= minY },
    { x, y: Math.max(below, minY), side: 'below', fits: below <= maxY },
    { x: right, y: midY, side: 'right', fits: right <= maxX },
    { x: left, y: midY, side: 'left', fits: left >= margin },
  ];
  const free = candidates.find((c) => c.fits && !hits(c.x, c.y));
  if (free) return { x: free.x, y: free.y, side: free.side };
  // Todo tapa algo: se conserva la preferencia sin zonas fijas.
  const first = candidates.find((c) => c.fits);
  if (first) return { x: first.x, y: first.y, side: first.side };
  // Objeto que ocupa casi todo el visor: pegada al borde superior libre.
  return { x, y: clamp(above, minY, maxY), side: 'pinned' };
}
