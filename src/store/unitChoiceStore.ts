/**
 * @file src/store/unitChoiceStore.ts
 * @description Estado del diálogo «¿En qué unidad está este modelo?»: qué piezas importadas se corrigen y
 * el diagnóstico de unidades (sugerencias con su factor y tamaño resultante). Lo abre la segunda acción
 * del aviso de unidades dudosas; aplicar usa `rescaleObjects` del store (un solo paso de deshacer).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import type { UnitHint } from '../engine/io/unitHint';

export interface UnitChoiceRequest {
  fileName: string;
  ids: string[];
  hint: UnitHint;
}

interface UnitChoiceState {
  request: UnitChoiceRequest | null;
  open: (request: UnitChoiceRequest) => void;
  close: () => void;
}

export const useUnitChoiceStore = create<UnitChoiceState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));

/** Tamaño mínimo y máximo aceptados para «ajustar el lado mayor a N mm». */
export const UNIT_FIT_MIN_MM = 1;
export const UNIT_FIT_MAX_MM = 5000;

/** Factor para que el lado mayor mida `targetMm`, o null si el tamaño no es válido. */
export function fitFactor(maxDimensionMm: number, targetMm: number): number | null {
  if (!Number.isFinite(targetMm) || targetMm < UNIT_FIT_MIN_MM || targetMm > UNIT_FIT_MAX_MM) return null;
  if (!Number.isFinite(maxDimensionMm) || maxDimensionMm <= 0) return null;
  return targetMm / maxDimensionMm;
}
