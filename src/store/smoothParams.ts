/**
 * @file src/store/smoothParams.ts
 * @description Parámetros de «Suavizar» tal como los ve la interfaz (intensidad en %, pasadas, aristas
 * vivas, zona por color) y su traducción a las opciones de la tarea `smooth` del motor, más reglas puras:
 * colores presentes en la pieza, firma de los parámetros (para reutilizar la vista previa) y detección del
 * caso «la protección de aristas frena el suavizado». Sin dependencias de React.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { CommandError } from '../core/bus/commandErrors';
import type { SmoothTaskOptions } from '../core/operations/smoothOperations';
import { SMOOTH_DEFAULTS, SMOOTH_RANGES, trianglesWithColor, type SmoothReport } from '../engine/smooth';
import type { MeshData } from '../types/kura';

export type SmoothZoneMode = 'all' | 'color';

export interface SmoothParams {
  /** Intensidad en % (10–100); fuerza del motor = % / 100. */
  intensityPct: number;
  iterations: number;
  keepSharpEdges: boolean;
  sharpAngleDeg: number;
  zoneMode: SmoothZoneMode;
  /** Color de la zona pintada (con `zoneMode` = `color`). */
  zoneColor: string | null;
  falloffRings: number;
}

export const SMOOTH_UI_DEFAULTS: SmoothParams = {
  intensityPct: SMOOTH_DEFAULTS.strength * 100,
  iterations: SMOOTH_DEFAULTS.iterations,
  keepSharpEdges: SMOOTH_DEFAULTS.preserveSharpEdges,
  sharpAngleDeg: SMOOTH_DEFAULTS.sharpAngleDeg,
  zoneMode: 'all',
  zoneColor: null,
  falloffRings: SMOOTH_DEFAULTS.falloffRings,
};

/** Rangos de los campos de la interfaz (la intensidad en %, derivada de `SMOOTH_RANGES.strength`). */
export const SMOOTH_UI_RANGES = {
  intensityPct: { min: Math.round(SMOOTH_RANGES.strength.min * 100), max: Math.round(SMOOTH_RANGES.strength.max * 100) },
  iterations: SMOOTH_RANGES.iterations,
  sharpAngleDeg: SMOOTH_RANGES.sharpAngleDeg,
  falloffRings: SMOOTH_RANGES.falloffRings,
} as const;

/** Sobre esta fracción de vértices fijos por aristas vivas se sugiere subir el ángulo o desactivar. */
export const SMOOTH_LOCKED_SUGGEST_RATIO = 0.3;
/** Ángulo al que sube el botón de la sugerencia (por encima del diedro de un chaflán de 45°). */
export const SMOOTH_SUGGESTED_ANGLE_DEG = 70;

/** Colores distintos pintados en la pieza (minúsculas, en orden de aparición). */
export function paintedColors(mesh: MeshData): string[] {
  const seen = new Set<string>();
  for (const c of mesh.faceColors ?? []) if (c) seen.add(c.toLowerCase());
  return [...seen];
}

/** Error tipado de una zona por color que no corresponde a ningún color pintado en la pieza. */
export function unpaintedZoneError(): CommandError {
  return new CommandError('invalid-params', 'bus.error.invalidParam', { param: 'zoneColor', expected: 'a color painted on the object' });
}

/**
 * Opciones de la tarea del motor para estos parámetros sobre esta malla. Con zona «color» exige un color pintado en
 * la pieza: si no lo hay lanza `invalid-params` (antes suavizaba la pieza entera sin avisar).
 */
export function smoothTaskOptions(params: SmoothParams, mesh: MeshData): SmoothTaskOptions {
  const opts: SmoothTaskOptions = {
    iterations: params.iterations,
    strength: params.intensityPct / 100,
    preserveSharpEdges: params.keepSharpEdges,
    sharpAngleDeg: params.sharpAngleDeg,
  };
  if (params.zoneMode === 'color') {
    const triangles = params.zoneColor ? trianglesWithColor(mesh, params.zoneColor) : new Uint32Array(0);
    if (triangles.length === 0) throw unpaintedZoneError();
    opts.zone = { triangles, falloffRings: params.falloffRings };
  }
  return opts;
}

/** Firma de los parámetros que cambian el resultado (el ángulo solo cuenta con la protección activa). */
export function smoothSignature(params: SmoothParams): string {
  const zone = params.zoneMode === 'color' ? `${params.zoneColor ?? ''}|${params.falloffRings}` : 'all';
  const angle = params.keepSharpEdges ? params.sharpAngleDeg : 0;
  return [params.intensityPct, params.iterations, params.keepSharpEdges ? 1 : 0, angle, zone].join(';');
}

/** Fracción de vértices fijos del informe (0–1). */
export function lockedRatio(report: Pick<SmoothReport, 'lockedVertices' | 'weldedVertices'>): number {
  return report.weldedVertices > 0 ? report.lockedVertices / report.weldedVertices : 0;
}

/** ¿La protección de aristas fija demasiados vértices y frena el suavizado? */
export function edgeProtectionBlocks(params: SmoothParams, report: SmoothReport | null): boolean {
  return report !== null && params.keepSharpEdges && lockedRatio(report) > SMOOTH_LOCKED_SUGGEST_RATIO;
}
