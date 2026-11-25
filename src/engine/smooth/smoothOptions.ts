/**
 * @file src/engine/smooth/smoothOptions.ts
 * @description Opciones, rangos y valores por defecto de «Suavizar malla» (Taubin λ/μ) y su
 * validación. La fuerza se expresa de 0,1 a 1 y se traduce a λ = 0,5·fuerza; μ sale de la
 * frecuencia de paso kPB = 0,1 (Taubin 1995): 1/λ + 1/μ = kPB, que con λ ≤ 0,5 mantiene
 * |f(k)| ≤ 1 en todo el espectro del laplaciano uniforme (k ∈ [0, 2]) y no encoge.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { requireOperationRange } from '../engineErrors';
import type { OperationRange } from '../operationLimits';

/** Rangos de Suavizar (fuente única del motor; el MCP y la interfaz los tomarán de aquí). */
export const SMOOTH_RANGES = {
  iterations: { min: 1, max: 100, integer: true },
  strength: { min: 0.1, max: 1 },
  sharpAngleDeg: { min: 1, max: 180 },
  falloffRings: { min: 0, max: 10, integer: true },
} as const satisfies Record<string, OperationRange>;

/** Valores por defecto (justificados en `docs/diseno/SUAVIZAR.md`). */
export const SMOOTH_DEFAULTS = {
  iterations: 10,
  strength: 1,
  preserveSharpEdges: true,
  sharpAngleDeg: 40,
  preserveBoundary: true,
  falloffRings: 2,
  onDamage: 'reduce',
  /** Sobre este cambio de volumen (%) se avisa con `SMOOTH_VOLUME_CHANGED`. */
  volumeWarnPct: 2,
} as const;

/** Frecuencia de paso de Taubin: 1/λ + 1/μ = kPB. */
export const TAUBIN_PASS_BAND = 0.1;
/** λ con fuerza 1 (Taubin 1995). */
export const TAUBIN_MAX_LAMBDA = 0.5;
/** Reintentos con la fuerza a la mitad cuando el resultado trae daño. */
export const SMOOTH_DAMAGE_RETRIES = 3;

/** Zona a suavizar: vértices o triángulos de la malla original (índices). */
export interface SmoothZone {
  vertices?: ArrayLike<number>;
  triangles?: ArrayLike<number>;
  /** Anillos de vecinos con peso decreciente alrededor de la zona (0 = borde duro). */
  falloffRings?: number;
}

/** Opciones públicas de `smoothMesh`. Todas opcionales. */
export interface SmoothOptions {
  iterations?: number;
  /** 0,1–1; λ = 0,5·fuerza. */
  strength?: number;
  preserveSharpEdges?: boolean;
  /** Diedro (grados entre normales) desde el cual una arista es viva y sus vértices no se mueven. */
  sharpAngleDeg?: number;
  /** No mover los vértices de bordes abiertos (mallas no cerradas). */
  preserveBoundary?: boolean;
  zone?: SmoothZone;
  /** Ante triángulos invertidos o autointersecciones nuevas: bajar la fuerza (por defecto) o fallar. */
  onDamage?: 'reduce' | 'error';
  /** Avance legible por máquina (`smooth:iter/total`, `smooth:check`). */
  onProgress?: (phase: string) => void;
}

/** Opciones validadas y completas. */
export interface ResolvedSmoothOptions {
  iterations: number;
  strength: number;
  preserveSharpEdges: boolean;
  sharpAngleDeg: number;
  preserveBoundary: boolean;
  zone: { vertices?: ArrayLike<number>; triangles?: ArrayLike<number>; falloffRings: number } | null;
  onDamage: 'reduce' | 'error';
}

/** Valida y completa las opciones; lanza `INVALID_PARAMETER` si algo está fuera de rango. */
export function resolveSmoothOptions(o: SmoothOptions = {}): ResolvedSmoothOptions {
  const D = SMOOTH_DEFAULTS;
  return {
    iterations: requireOperationRange('iterations', o.iterations, SMOOTH_RANGES.iterations, D.iterations),
    strength: requireOperationRange('strength', o.strength, SMOOTH_RANGES.strength, D.strength),
    preserveSharpEdges: o.preserveSharpEdges ?? D.preserveSharpEdges,
    sharpAngleDeg: requireOperationRange('sharpAngleDeg', o.sharpAngleDeg, SMOOTH_RANGES.sharpAngleDeg, D.sharpAngleDeg),
    preserveBoundary: o.preserveBoundary ?? D.preserveBoundary,
    zone: o.zone
      ? {
          vertices: o.zone.vertices,
          triangles: o.zone.triangles,
          falloffRings: requireOperationRange('falloffRings', o.zone.falloffRings, SMOOTH_RANGES.falloffRings, D.falloffRings),
        }
      : null,
    onDamage: o.onDamage ?? D.onDamage,
  };
}

/** Coeficientes (λ, μ) de Taubin para una fuerza dada. */
export function taubinCoefficients(strength: number): { lambda: number; mu: number } {
  const lambda = TAUBIN_MAX_LAMBDA * strength;
  return { lambda, mu: 1 / (TAUBIN_PASS_BAND - 1 / lambda) };
}
