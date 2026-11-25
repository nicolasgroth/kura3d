/**
 * @file src/store/addonHover.ts
 * @description Cara bajo el cursor para los paneles de agregados (imán, torreta): tipo común y un canal que solo
 * escribe en el store si el punto cambió (con tolerancia) y agrupa los movimientos de un mismo cuadro en una
 * escritura; `null` (el cursor salió) se aplica de inmediato y descarta lo pendiente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Vec3 } from '../types/kura';

export interface AddonHover {
  hostId: string;
  point: Vec3;
  normal: Vec3;
}

/** Diferencia (mm o componente de normal) por debajo de la cual dos golpes del cursor son el mismo. */
export const ADDON_HOVER_EPS = 1e-4;

const sameVec = (a: Vec3, b: Vec3) =>
  Math.abs(a[0] - b[0]) <= ADDON_HOVER_EPS && Math.abs(a[1] - b[1]) <= ADDON_HOVER_EPS && Math.abs(a[2] - b[2]) <= ADDON_HOVER_EPS;

/** Misma pieza, mismo punto y misma normal (con tolerancia). */
export function sameAddonHover(a: AddonHover | null, b: AddonHover | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.hostId === b.hostId && sameVec(a.point, b.point) && sameVec(a.normal, b.normal);
}

export interface HoverChannel {
  /** Pide escribir la cara bajo el cursor (agrupada por cuadro). */
  set: (hover: AddonHover | null) => void;
  /** Aplica ya el último punto pendiente (al cerrar, y en pruebas). */
  flush: () => void;
}

/** Canal de cursor sobre un store con `hover` (`read` lo lee, `write` lo escribe). */
export function createHoverChannel(read: () => AddonHover | null, write: (hover: AddonHover | null) => void): HoverChannel {
  let pending: AddonHover | null = null;
  let frame: number | null = null;
  const commit = (hover: AddonHover | null) => {
    if (!sameAddonHover(read(), hover)) write(hover);
  };
  const cancel = () => {
    if (frame !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame);
    frame = null;
  };
  return {
    flush: () => {
      cancel();
      if (pending) commit(pending);
      pending = null;
    },
    set: (hover) => {
      if (!hover || typeof requestAnimationFrame === 'undefined') {
        pending = null;
        cancel();
        commit(hover);
        return;
      }
      if (sameAddonHover(pending ?? read(), hover)) return;
      pending = hover;
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const next = pending;
        pending = null;
        if (next) commit(next);
      });
    },
  };
}
