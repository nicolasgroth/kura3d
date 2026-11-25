/**
 * @file src/core/scene/plateView.ts
 * @description Caja de encuadre de las camas de placa (función pura): la unión de las camas visibles (todas, o
 * solo la activa con «Solo esta») o la de una sola placa. La usa la cámara para dejar a la vista una placa recién
 * creada o la que se activa fuera del encuadre (el encuadre de siempre solo mira objetos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { FrameBox } from './cameraFraming';
import { projectBed, type PlateBedSource } from './activePlateBed';
import { plateBed, resolveActivePlate } from './plates';

/** Altura de la caja de una cama vacía (mm): la misma que usa la cámara para la cama sin objetos. */
const BED_BOX_HEIGHT_MM = 30;

/**
 * Caja de las camas: `which = 'visible'` une las camas que se dibujan (todas, o solo la activa si `solo`);
 * `which = 'active'` solo la de la placa activa. null sin placas.
 */
export function plateBedsBox(source: PlateBedSource & { plateSolo?: boolean }, which: 'visible' | 'active'): FrameBox | null {
  const plates = source.plates ?? [];
  if (plates.length === 0) return null;
  const active = resolveActivePlate(plates, source.activePlateId);
  const shown = which === 'active' || source.plateSolo ? plates.filter((p) => p.id === active?.id) : plates;
  if (shown.length === 0) return null;
  const base = projectBed(source);
  const min: [number, number, number] = [Infinity, 0, Infinity];
  const max: [number, number, number] = [-Infinity, BED_BOX_HEIGHT_MM, -Infinity];
  for (const p of shown) {
    const bed = plateBed(p, base);
    min[0] = Math.min(min[0], p.origin[0] - bed.widthMm / 2);
    max[0] = Math.max(max[0], p.origin[0] + bed.widthMm / 2);
    min[2] = Math.min(min[2], p.origin[1] - bed.depthMm / 2);
    max[2] = Math.max(max[2], p.origin[1] + bed.depthMm / 2);
  }
  return { min, max };
}

/** Une dos cajas (cualquiera puede faltar). */
export function unionBox(a: FrameBox | null, b: FrameBox | null): FrameBox | null {
  if (!a) return b;
  if (!b) return a;
  return {
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
  };
}
