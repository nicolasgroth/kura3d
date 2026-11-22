/**
 * @file src/engine/segmentation/constants.ts
 * @description Constantes compartidas de la segmentación estructural: paleta de colores, opciones por defecto, tolerancia de soldado y paquete de claves de aristas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SegmentationOptions } from '../../types/kura';

/** Paleta de 12 colores de alto contraste para distinguir sub-estructuras y exportar 3MF multicolor. */
export const STRUCTURAL_COLOR_PALETTE: string[] = [
  '#38bdf8', // Azul Kura
  '#f97316', // Naranja PLA
  '#22c55e', // Verde Esmeralda
  '#a855f7', // Violeta
  '#eab308', // Amarillo
  '#ef4444', // Rojo Coral
  '#06b6d4', // Cian
  '#ec4899', // Magenta
  '#84cc16', // Lima
  '#f59e0b', // Ámbar
  '#6366f1', // Índigo
  '#14b8a6', // Turquesa
];

/** Opciones por defecto del algoritmo de detección estructural. */
export const DEFAULT_SEGMENTATION_OPTIONS: SegmentationOptions = {
  creaseAngleDeg: 28,
  minRegionPercent: 1.5,
  maxRegions: 12,
};

/** Tolerancia espacial de soldado de vértices en milímetros (1e-4 mm). */
export const WELD_TOLERANCE_MM = 1e-4;
export const WELD_INV_TOL = 1 / WELD_TOLERANCE_MM;

/** Multiplicador seguro para empaquetar aristas no dirigidas (hasta 67M vértices soldados). */
export const EDGE_KEY_STRIDE = 67108864; // 2^26
