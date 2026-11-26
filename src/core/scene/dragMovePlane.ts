/**
 * @file src/core/scene/dragMovePlane.ts
 * @description Matemática pura del arrastre de objetos en el visor: intersecta el rayo de la cámara con el
 * plano horizontal que pasa por el punto agarrado y devuelve el desplazamiento (sin saltos al empezar, con
 * paso de rejilla y con límites para vistas casi rasantes). El eje vertical del visor es Y.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Vec3 } from '../../types/kura';

/** Distancia en píxeles que el puntero debe recorrer para que un clic pase a ser arrastre. */
export const DRAG_MOVE_THRESHOLD_PX = 4;
/** Seno mínimo entre el rayo y el plano (~3,4°): por debajo, la intersección se dispara al infinito. */
export const DRAG_MIN_RAY_SLOPE = 0.06;
/** Desplazamiento horizontal máximo desde el punto agarrado, en mm, cuando no hay cama conocida. */
export const DRAG_MAX_REACH_MM = 2000;
/** Seno del rayo a partir del cual el desplazamiento ya no se atenúa (~11,5°). */
export const DRAG_FULL_RAY_SLOPE = 0.2;

/** Límites de la posición final: semiancho en X y Z, centrados en el origen (la cama está centrada). */
export interface DragBounds {
  halfX: number;
  halfZ: number;
  /** Rectángulo explícito (varias placas lejos del origen); si está, manda sobre `halfX`/`halfZ`. */
  rect?: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** Cama + un margen igual a su lado mayor por cada lado; null si no hay cama. */
export function dragBoundsForBed(bed: { width: number; depth: number } | null): DragBounds | null {
  if (!bed || !(bed.width > 0) || !(bed.depth > 0)) return null;
  const margin = Math.max(bed.width, bed.depth);
  return { halfX: bed.width / 2 + margin, halfZ: bed.depth / 2 + margin };
}

/** Camas (con su centro) + un margen igual al lado mayor por cada lado: todas las placas caben en el rectángulo. */
export function dragBoundsForBeds(beds: ReadonlyArray<{ width: number; depth: number; origin?: [number, number] }>): DragBounds | null {
  const valid = beds.filter((b) => b.width > 0 && b.depth > 0);
  if (valid.length === 0) return null;
  const margin = Math.max(...valid.map((b) => Math.max(b.width, b.depth)));
  const rect = {
    minX: Math.min(...valid.map((b) => (b.origin?.[0] ?? 0) - b.width / 2)) - margin,
    maxX: Math.max(...valid.map((b) => (b.origin?.[0] ?? 0) + b.width / 2)) + margin,
    minZ: Math.min(...valid.map((b) => (b.origin?.[1] ?? 0) - b.depth / 2)) - margin,
    maxZ: Math.max(...valid.map((b) => (b.origin?.[1] ?? 0) + b.depth / 2)) + margin,
  };
  return { halfX: Math.max(Math.abs(rect.minX), Math.abs(rect.maxX)), halfZ: Math.max(Math.abs(rect.minZ), Math.abs(rect.maxZ)), rect };
}

/** Factor 0..1 (suavizado) que reduce el desplazamiento cuando el rayo se acerca al plano. */
export function dragGrazingFactor(slope: number): number {
  const u = Math.min(1, Math.max(0, (Math.abs(slope) - DRAG_MIN_RAY_SLOPE) / (DRAG_FULL_RAY_SLOPE - DRAG_MIN_RAY_SLOPE)));
  return u * u * (3 - 2 * u);
}

/** Paso de rejilla efectivo: el de la rejilla si está activa; con rejilla libre, Ctrl/Cmd ajusta a 1 mm. */
export function dragSnapMm(gridMm: number, ctrlOrMeta: boolean): number {
  if (gridMm > 0) return gridMm;
  return ctrlOrMeta ? 1 : 0;
}

export interface DragMoveInput {
  rayOrigin: Vec3;
  rayDir: Vec3;
  /** Punto del objeto donde se agarró; su altura define el plano. */
  grab: Vec3;
  /** Posición inicial del objeto de referencia: la rejilla se aplica a su posición final. */
  reference: Vec3;
  /** Paso de rejilla en mm; 0 = libre. */
  snapMm: number;
  maxReachMm?: number;
  /** Si se da, la posición final del objeto de referencia no sale de estos límites (salvo que ya estuviera fuera). */
  bounds?: DragBounds | null;
}

/** Punto donde el rayo corta el plano horizontal `y = planeY`; null si es casi paralelo o queda detrás. */
export function rayHorizontalPlanePoint(origin: Vec3, dir: Vec3, planeY: number): Vec3 | null {
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (len < 1e-9) return null;
  const slope = dir[1] / len;
  if (Math.abs(slope) < DRAG_MIN_RAY_SLOPE) return null;
  const t = (planeY - origin[1]) / dir[1];
  if (!Number.isFinite(t) || t <= 0) return null;
  return [origin[0] + dir[0] * t, planeY, origin[2] + dir[2] * t];
}

/**
 * Desplazamiento `[dx, 0, dz]` que lleva el punto agarrado bajo el cursor. Devuelve null si no hay una
 * intersección fiable (vista rasante o rayo que no alcanza el plano): quien llama conserva el último valor.
 */
export function dragMoveDelta(input: DragMoveInput): Vec3 | null {
  const hit = rayHorizontalPlanePoint(input.rayOrigin, input.rayDir, input.grab[1]);
  if (!hit) return null;
  const len = Math.hypot(...input.rayDir);
  const factor = dragGrazingFactor(input.rayDir[1] / len);
  let dx = (hit[0] - input.grab[0]) * factor;
  let dz = (hit[2] - input.grab[2]) * factor;
  const reach = input.maxReachMm ?? DRAG_MAX_REACH_MM;
  const dist = Math.hypot(dx, dz);
  if (dist > reach) {
    dx *= reach / dist;
    dz *= reach / dist;
  }
  if (input.bounds) {
    const { halfX, halfZ } = input.bounds;
    const r = input.bounds.rect ?? { minX: -halfX, maxX: halfX, minZ: -halfZ, maxZ: halfZ };
    const fx = input.reference[0] + dx;
    const fz = input.reference[2] + dz;
    dx = Math.min(Math.max(fx, Math.min(r.minX, input.reference[0])), Math.max(r.maxX, input.reference[0])) - input.reference[0];
    dz = Math.min(Math.max(fz, Math.min(r.minZ, input.reference[2])), Math.max(r.maxZ, input.reference[2])) - input.reference[2];
  }
  if (input.snapMm > 0) {
    const s = input.snapMm;
    dx = Math.round((input.reference[0] + dx) / s) * s - input.reference[0];
    dz = Math.round((input.reference[2] + dz) / s) * s - input.reference[2];
  }
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return null;
  return [dx, 0, dz];
}
