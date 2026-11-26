/**
 * @file src/core/recipes/run/limits.ts
 * @description Topes duros de la ejecución de una receta: triángulos y objetos de la escena de trabajo, memoria
 * aproximada de mallas y tiempo de pared. Superar uno es un error tipado y no deja nada en la escena del usuario.
 * Quien llama puede bajarlos (pruebas, vista previa), nunca subirlos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { MODEL_IO_LIMITS } from '../../../engine/operationLimits';

const MIB = 1024 * 1024;

export const RECIPE_RUN_LIMITS = {
  /** Triángulos sumados de todos los objetos de la escena de trabajo (intermedios incluidos). */
  maxTriangles: MODEL_IO_LIMITS.maxTriangles,
  /** Objetos creados en la escena de trabajo (instancias de patrones, intermedios y salidas). */
  maxObjects: 512,
  /** Bytes de mallas (posiciones + índices) vivos en la escena de trabajo. */
  maxMemoryBytes: 512 * MIB,
  /** Tiempo de pared total. La cancelación es cooperativa: se revisa antes y después de cada operación. */
  maxWallMs: 30_000,
} as const;

export type RunLimits = { -readonly [K in keyof typeof RECIPE_RUN_LIMITS]: number };

/** Topes efectivos: cada valor pedido se acepta solo si es finito, positivo y menor que el tope duro. */
export function effectiveRunLimits(requested: Partial<RunLimits> = {}): RunLimits {
  const out = { ...RECIPE_RUN_LIMITS } as RunLimits;
  for (const key of Object.keys(out) as (keyof RunLimits)[]) {
    const value = requested[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[key] = Math.min(out[key], value);
  }
  return out;
}
