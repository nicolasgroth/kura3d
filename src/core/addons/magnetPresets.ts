/**
 * @file src/core/addons/magnetPresets.ts
 * @description Preajustes incluidos de imanes (discos de neodimio comunes y un cuadrado) y el tipo de preajuste de
 * usuario para imanes (clave de almacenamiento y saneo). Las holguras de los incluidos son las por defecto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MAGNET_DEFAULTS, sanitizeMagnetParams, type MagnetParams } from './magnetPocket';

export interface BuiltinMagnetPreset {
  id: string;
  values: MagnetParams;
}

const preset = (id: string, shape: MagnetParams['shape'], sizeMm: number, heightMm: number): BuiltinMagnetPreset => ({
  id, values: { ...MAGNET_DEFAULTS, shape, sizeMm, heightMm },
});

/** Incluidos; el primero es el por defecto. */
export const BUILTIN_MAGNET_PRESETS: readonly BuiltinMagnetPreset[] = [
  preset('round-5x2', 'round', 5, 2),
  preset('round-6x3', 'round', 6, 3),
  preset('round-8x3', 'round', 8, 3),
  preset('round-10x3', 'round', 10, 3),
  preset('square-5x5x2', 'square', 5, 2),
];

export const MAGNET_PRESET_STORAGE_KEY = 'kura3d-presets-magnet';

/** Tipo de preajuste de usuario para `createUserPresetsStore`. */
export const MAGNET_PRESET_KIND = { storageKey: MAGNET_PRESET_STORAGE_KEY, sanitize: sanitizeMagnetParams } as const;

/** Medidas del imán como texto («5 × 2», «5 × 5 × 2»), con coma decimal si el idioma la usa. */
export function magnetSizeLabel(p: Pick<MagnetParams, 'shape' | 'sizeMm' | 'heightMm'>, locale = 'es'): string {
  const f = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });
  return p.shape === 'square' ? `${f(p.sizeMm)} × ${f(p.sizeMm)} × ${f(p.heightMm)}` : `${f(p.sizeMm)} × ${f(p.heightMm)}`;
}

/** Dos imanes son iguales si coinciden forma, medidas, holguras y modo. */
export function sameMagnet(a: MagnetParams, b: MagnetParams): boolean {
  return a.shape === b.shape && a.sizeMm === b.sizeMm && a.heightMm === b.heightMm && a.clearanceMm === b.clearanceMm
    && a.depthClearanceMm === b.depthClearanceMm && a.hidden === b.hidden;
}
