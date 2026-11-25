/**
 * @file src/core/addons/cablePassPresets.ts
 * @description Tabla de medidas incluida del paso de cable (POR VERIFICAR con el cable o conector real): redondos de
 * 5 (por defecto), 8 y 12 mm; ranuras para pasar el conector USB-C (9,5 × 4) y micro-USB (8 × 4) y para cable plano
 * (12 × 2,5). Chaflán de 0,5 mm en las bocas y profundidad medida sola para atravesar la pared; la profundidad a mano
 * por defecto (10 mm) solo se usa si se elige o si la pared es demasiado gruesa para medirla. Tipo de preajuste de
 * usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { sanitizeCablePassParams, type CablePassParams } from './cablePass';

export interface BuiltinCablePassPreset {
  id: string;
  /** Rótulo propio (conector) o null para «Redondo Ø». */
  labelKey: 'usbc' | 'microusb' | 'flat' | null;
  values: CablePassParams;
}

const BASE = { chamferMm: 0.5, angleDeg: 0, autoDepth: true, depthMm: 10 } as const;

const round = (d: number): BuiltinCablePassPreset => ({
  id: `round-${d}`, labelKey: null, values: { shape: 'round', widthMm: d, lengthMm: d, ...BASE },
});
const slot = (id: string, labelKey: BuiltinCablePassPreset['labelKey'], lengthMm: number, widthMm: number): BuiltinCablePassPreset => ({
  id, labelKey, values: { shape: 'slot', widthMm, lengthMm, ...BASE },
});

export const BUILTIN_CABLE_PASS_PRESETS: readonly BuiltinCablePassPreset[] = [
  round(5),
  round(8),
  round(12),
  slot('usbc', 'usbc', 9.5, 4),
  slot('microusb', 'microusb', 8, 4),
  slot('flat', 'flat', 12, 2.5),
];

export const DEFAULT_CABLE_PASS_PRESET_ID = 'round-5';

export const CABLE_PASS_DEFAULTS: Readonly<CablePassParams> =
  BUILTIN_CABLE_PASS_PRESETS.find((p) => p.id === DEFAULT_CABLE_PASS_PRESET_ID)!.values;

/** Ranura por defecto al cambiar de redondo a ranura (8 × 4). */
export const CABLE_SLOT_DEFAULTS: Readonly<CablePassParams> = { shape: 'slot', widthMm: 4, lengthMm: 8, ...BASE };

export const CABLE_PASS_PRESET_STORAGE_KEY = 'kura3d-presets-cable-pass';

export const CABLE_PASS_PRESET_KIND = { storageKey: CABLE_PASS_PRESET_STORAGE_KEY, sanitize: sanitizeCablePassParams } as const;
