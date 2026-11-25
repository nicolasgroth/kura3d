/**
 * @file src/engine/io/unitHint.ts
 * @description Diagnóstico de unidades dudosas al importar formatos sin unidad (STL, OBJ, PLY): si la
 * mayor dimensión del modelo es diminuta (< 5 mm) o enorme (> 5 m), propone escalas probables
 * (metros ×1000, pulgadas ×25,4, centímetros ×10, ×100, o «ajustar a 100 mm») ordenadas por lo
 * razonable del tamaño resultante. Nunca escala por sí solo: la interfaz ofrece la elección.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ImportedModel } from './importTypes';
import { partBounds } from './partGeometry';

/** Bajo este tamaño (mm, mayor dimensión) el modelo probablemente viene en otra unidad. */
export const UNIT_HINT_MIN_MM = 5;
/** Sobre este tamaño (mm, mayor dimensión) el modelo probablemente viene en otra unidad. */
export const UNIT_HINT_MAX_MM = 5_000;
/** Tamaño objetivo de «ajustar a N mm». */
export const UNIT_HINT_FIT_MM = 100;

export type UnitSuggestionKind = 'meters' | 'inches' | 'centimeters' | 'times100' | 'micrometers' | 'fit';

export interface UnitSuggestion {
  kind: UnitSuggestionKind;
  /** Factor que se multiplica a la escala (y a las posiciones relativas) del modelo. */
  factor: number;
  /** Mayor dimensión resultante en mm. */
  resultMm: number;
}

export interface UnitHint {
  /** Mayor dimensión actual en mm. */
  maxDimensionMm: number;
  direction: 'tiny' | 'huge';
  /** De la más probable a la menos; siempre termina con «ajustar a 100 mm». */
  suggestions: UnitSuggestion[];
}

/** Distancia (en escala logarítmica) a un tamaño de impresión típico; menor es más razonable. */
const plausibility = (mm: number) => (mm >= 10 && mm <= 400 ? Math.abs(Math.log10(mm / UNIT_HINT_FIT_MM)) : 10 + Math.abs(Math.log10(mm / UNIT_HINT_FIT_MM)));

/** Diagnóstico para una mayor dimensión dada, o null si es razonable. */
export function unitHintForSize(maxDimensionMm: number): UnitHint | null {
  if (!Number.isFinite(maxDimensionMm) || maxDimensionMm <= 0) return null;
  if (maxDimensionMm >= UNIT_HINT_MIN_MM && maxDimensionMm <= UNIT_HINT_MAX_MM) return null;
  const tiny = maxDimensionMm < UNIT_HINT_MIN_MM;
  const candidates: Array<[UnitSuggestionKind, number]> = tiny
    ? [['meters', 1000], ['inches', 25.4], ['centimeters', 10], ['times100', 100]]
    : [['micrometers', 0.001], ['inches', 1 / 25.4], ['centimeters', 0.1], ['times100', 0.01]];
  const suggestions = candidates
    .map(([kind, factor]): UnitSuggestion => ({ kind, factor, resultMm: maxDimensionMm * factor }))
    .filter((s) => s.resultMm >= UNIT_HINT_MIN_MM && s.resultMm <= UNIT_HINT_MAX_MM)
    .sort((a, b) => plausibility(a.resultMm) - plausibility(b.resultMm));
  suggestions.push({ kind: 'fit', factor: UNIT_HINT_FIT_MM / maxDimensionMm, resultMm: UNIT_HINT_FIT_MM });
  return { maxDimensionMm, direction: tiny ? 'tiny' : 'huge', suggestions };
}

/** Diagnóstico del modelo completo (caja de todas sus piezas); solo formatos sin unidad. */
export function unitHintOf(model: ImportedModel): UnitHint | null {
  if (model.format === '3mf') return null; // el 3MF declara su unidad (`unit`) y se respeta
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const part of model.parts) {
    const b = partBounds(part);
    minX = Math.min(minX, b[0]); minY = Math.min(minY, b[1]); minZ = Math.min(minZ, b[2]);
    maxX = Math.max(maxX, b[3]); maxY = Math.max(maxY, b[4]); maxZ = Math.max(maxZ, b[5]);
  }
  return unitHintForSize(Math.max(maxX - minX, maxY - minY, maxZ - minZ));
}
