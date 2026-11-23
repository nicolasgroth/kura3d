/**
 * @file src/components/dialogs/threadLengthDefaults.ts
 * @description Largo (o altura) por defecto de una rosca según su diámetro y tipo: perno ≈ 2,5·d, tuerca ≈ 0,8·d,
 * agujero roscado ≈ 2·d. Usa `threadDefaults` del motor cuando existe; si no, estos mismos valores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as threadsEngine from '../../engine/threads';
import type { ThreadOptions } from '../../types/kura';

const MIN_LENGTH_MM = 4;
const MAX_LENGTH_MM = 120;
const FACTOR: Record<ThreadOptions['kind'], number> = { bolt: 2.5, nut: 0.8, hole: 2 };

type EngineDefaults = (kind: ThreadOptions['kind'], diameterMm: number) => { lengthMm?: number } | number | undefined;

/** Largo por defecto en mm (redondeado a 0,5 y dentro del rango permitido). */
export function defaultThreadLength(kind: ThreadOptions['kind'], diameterMm: number): number {
  const fromEngine = (threadsEngine as unknown as { threadDefaults?: EngineDefaults }).threadDefaults;
  if (typeof fromEngine === 'function') {
    const value = fromEngine(kind, diameterMm);
    const length = typeof value === 'number' ? value : value?.lengthMm;
    if (typeof length === 'number' && Number.isFinite(length) && length > 0) {
      return Math.min(MAX_LENGTH_MM, Math.max(MIN_LENGTH_MM, length));
    }
  }
  const raw = FACTOR[kind] * diameterMm;
  return Math.min(MAX_LENGTH_MM, Math.max(MIN_LENGTH_MM, Math.round(raw * 2) / 2));
}
