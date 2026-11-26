/**
 * @file src/core/scene/viewPresets.ts
 * @description Vistas predefinidas del visor (Iso, Sup, Frente, Der…) como direcciones de cámara en ejes
 * internos (Y arriba), y planos de recorte cercano/lejano proporcionales al tamaño de la escena, para que
 * cambiar de vista encuadre el contenido y una pieza grande nunca quede cortada ni con la cámara dentro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Vec3 } from './cameraFraming';

export type ViewPreset = 'iso' | 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';

/**
 * Dirección desde el objetivo hacia la cámara para cada vista. Sup/Inf llevan un pequeño desvío hacia el
 * frente para que el "arriba" de la cámara quede definido (el fondo del usuario, +Y, arriba en pantalla).
 */
export const VIEW_PRESET_DIRS: Record<ViewPreset, Vec3> = {
  iso: [0.72, 0.62, 0.85],
  top: [0, 1, 0.001],
  bottom: [0, -1, 0.001],
  front: [0, 0.12, 1],
  back: [0, 0.12, -1],
  right: [1, 0.12, 0],
  left: [-1, 0.12, 0],
};

export function isViewPreset(preset: string): preset is ViewPreset {
  return Object.prototype.hasOwnProperty.call(VIEW_PRESET_DIRS, preset);
}

/**
 * Planos de recorte para una cámara a `distance` del objetivo con una escena de radio `sceneRadius`
 * (mm). El lejano cubre la escena entera vista desde el otro lado; el cercano es lo mayor posible sin
 * cortar lo que está entre la cámara y el objetivo, para conservar precisión de profundidad.
 */
export function clipPlanesFor(distance: number, sceneRadius: number): { near: number; far: number } {
  const d = Math.max(0.5, Number.isFinite(distance) ? distance : 1);
  const r = Math.max(1, Number.isFinite(sceneRadius) ? sceneRadius : 1);
  const far = Math.max(4000, (d + 2 * r) * 2);
  // Con una pieza diminuta la cámara se acerca a pocos mm: el plano cercano baja con ella.
  const near = Math.min(10, Math.max(0.01, Math.min(d, far) / 400));
  return { near, far };
}

/**
 * Distancia mínima de encuadre según el tamaño real de la caja (mm): una pieza de 0,9 mm se puede ver de
 * cerca (sin quedarse en 18 mm, donde parece una mota), y nunca baja de 1 mm.
 */
export function minFrameDistance(boxDiagonal: number, defaultMin: number): number {
  if (!Number.isFinite(boxDiagonal) || boxDiagonal <= 0) return defaultMin;
  return Math.min(defaultMin, Math.max(1, boxDiagonal * 1.2));
}
