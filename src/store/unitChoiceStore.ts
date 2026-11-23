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

/** Diagnóstico guardado por objeto importado: el inspector ofrece «¿Unidad equivocada?» mientras su escala no cambie. */
export interface UnitDoubt {
  request: UnitChoiceRequest;
  scale: readonly [number, number, number];
}

interface UnitChoiceState {
  request: UnitChoiceRequest | null;
  doubts: Record<string, UnitDoubt>;
  open: (request: UnitChoiceRequest) => void;
  close: () => void;
  /** Recuerda el diagnóstico de unas piezas recién importadas (con su escala de partida). */
  remember: (request: UnitChoiceRequest, scales: Record<string, readonly [number, number, number]>) => void;
}

export const useUnitChoiceStore = create<UnitChoiceState>((set) => ({
  request: null,
  doubts: {},
  open: (request) => set({ request }),
  close: () => set({ request: null }),
  remember: (request, scales) =>
    set((s) => ({
      doubts: {
        ...s.doubts,
        ...Object.fromEntries(request.ids.filter((id) => scales[id]).map((id) => [id, { request, scale: scales[id] }])),
      },
    })),
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
