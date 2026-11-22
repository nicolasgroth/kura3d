/**
 * @file src/components/inspector/inspectorConstants.ts
 * @description Constantes del inspector: materiales, primitivas modulares, ejes y escala mínima.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { type MaterialPresetId, type PrimitiveType } from '../../types/kura';

export const MATERIAL_IDS: MaterialPresetId[] = [
  'pla_matte',
  'pla_silk',
  'petg_clear',
  'abs',
  'carbon_fiber',
  'silicone',
  'wax_candle',
  'metallic',
];

export const MODULAR_PRIMITIVES: PrimitiveType[] = [
  'sphere',
  'cylinder',
  'box',
  'tube',
  'cone',
  'torus',
  'prism',
  'text',
];

export const AXES = ['x', 'y', 'z'] as const;
export const MIN_SCALE = 0.05;
