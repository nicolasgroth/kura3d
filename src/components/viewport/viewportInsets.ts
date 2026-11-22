/**
 * @file src/components/viewport/viewportInsets.ts
 * @description Mide qué franjas del lienzo del visor tapan la interfaz flotante (barras del visor,
 * avisos de cama, control de armado y paneles de operación) para que el encuadre trabaje dentro del
 * área libre real. Un elemento ancho (≥ 50 % del lienzo) cuenta como franja superior o inferior; uno
 * angosto, como franja lateral. Cualquier elemento puede sumarse con `data-viewport-occluder`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ViewInsets } from '../../core/scene/cameraFraming';

const OCCLUDERS = [
  '.kura-hud-top-bar',
  '.kura-hud-bottom',
  '.kura-split-notice',
  '.kura-split-assembly',
  '.kura-op-panel',
  '[data-viewport-occluder]',
].join(',');

export function measureViewportInsets(canvas: HTMLElement | null): ViewInsets {
  const out: ViewInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  if (!canvas || typeof document === 'undefined') return out;
  const c = canvas.getBoundingClientRect();
  if (c.width <= 0 || c.height <= 0) return out;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(OCCLUDERS))) {
    const r = el.getBoundingClientRect();
    const left = Math.max(c.left, r.left);
    const right = Math.min(c.right, r.right);
    const top = Math.max(c.top, r.top);
    const bottom = Math.min(c.bottom, r.bottom);
    if (right - left < 2 || bottom - top < 2) continue;
    if (right - left >= c.width * 0.5) {
      if ((top + bottom) / 2 < c.top + c.height / 2) out.top = Math.max(out.top, (bottom - c.top) / c.height);
      else out.bottom = Math.max(out.bottom, (c.bottom - top) / c.height);
    } else if ((left + right) / 2 < c.left + c.width / 2) {
      out.left = Math.max(out.left, (right - c.left) / c.width);
    } else {
      out.right = Math.max(out.right, (c.right - left) / c.width);
    }
  }
  return out;
}
