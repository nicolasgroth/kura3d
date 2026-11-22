/**
 * @file src/core/scene/pieceSizing.ts
 * @description Tamaño y colocación de la "pieza" o "pieza negativa" que el menú contextual agrega a un
 * objeto: lado igual al 40 % de la dimensión menor del objeto (mínimo 4 mm). La negativa se centra en el
 * objeto (lista para restar al moverla); la positiva se apoya sobre su cara superior, centrada en planta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PrimitiveParams, PrimitiveType, SceneObject } from '../../types/kura';

export const PIECE_SIZE_RATIO = 0.4;
export const PIECE_MIN_MM = 4;

/** Formas que el menú puede agregar como pieza. `svg` e `import` abren su propio flujo. */
export type PieceShape = PrimitiveType | 'svg' | 'import';

/** Dimensiones del objeto en mm con su escala aplicada (ejes internos: Y es la altura). */
export function scaledDimensions(target: SceneObject): [number, number, number] {
  const d = target.stats.dimensionsMm;
  return [0, 1, 2].map((k) => Math.max(0.01, d[k] * Math.abs(target.scale[k]))) as [number, number, number];
}

/** Lado base de la pieza nueva: 40 % de la dimensión menor del objeto. */
export function pieceSizeFor(target: SceneObject): number {
  return Math.max(PIECE_MIN_MM, Math.min(...scaledDimensions(target)) * PIECE_SIZE_RATIO);
}

/** Parámetros de la primitiva con lado `s` (mm). */
export function pieceParams(type: PrimitiveType, s: number): PrimitiveParams {
  switch (type) {
    case 'sphere': return { radius: s / 2, segments: 32 };
    case 'cylinder':
    case 'cone': return { radius: s / 2, height: s, segments: 32 };
    case 'prism': return { radius: s / 2, height: s, sides: 6 };
    case 'tube': return { outerRadius: s / 2, innerRadius: Math.max(1, s * 0.3), height: s, segments: 36 };
    case 'torus': return { outerRadius: s / 2, tubeRadius: Math.max(1, s * 0.15), segments: 32 };
    case 'text': return { text: 'KURA', fontSize: Math.max(4, s * 0.5), height: Math.max(1.5, s * 0.25) };
    default: return { width: s, height: s, depth: s };
  }
}

/** Desplazamiento vertical sobre el centro del objeto: 0 (negativa) o apoyada arriba (positiva). */
export function pieceYOffset(target: SceneObject, mode: 'positive' | 'negative', pieceHeightMm: number): number {
  if (mode === 'negative') return 0;
  return scaledDimensions(target)[1] / 2 + pieceHeightMm / 2;
}
