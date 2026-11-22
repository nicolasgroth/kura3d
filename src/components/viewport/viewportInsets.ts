/**
 * @file src/components/viewport/viewportInsets.ts
 * @description Mide qué franjas del lienzo del visor tapan la interfaz flotante (barras del visor,
 * avisos de cama, control de armado y paneles de operación) para que el encuadre trabaje dentro del
 * área libre real. Cada elemento cuenta como franja del borde por el que menos área libre quita. Cualquier elemento puede sumarse con `data-viewport-occluder`.
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
    // Se descuenta por el borde que menos área libre quita: una barra arriba cuenta como franja
    // superior aunque toque la esquina; un panel alto a la derecha, como franja derecha.
    const cost = {
      top: (bottom - c.top) / c.height,
      bottom: (c.bottom - top) / c.height,
      left: (right - c.left) / c.width,
      right: (c.right - left) / c.width,
    };
    const edge = (Object.keys(cost) as Array<keyof typeof cost>).reduce((a, b) => (cost[b] < cost[a] ? b : a));
    out[edge] = Math.max(out[edge], cost[edge]);
  }
  return out;
}
