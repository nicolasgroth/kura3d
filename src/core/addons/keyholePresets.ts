/**
 * @file src/core/addons/keyholePresets.ts
 * @description Tabla de medidas incluida del ojo de cerradura (valores típicos de tornillos para madera o tarugo de
 * cabeza redonda o plana, POR VERIFICAR con el tornillo real y una impresión de prueba): 3, 3,5, 4 (por defecto) y
 * 5 mm. Entrada = cabeza típica + ~0,5 mm; cuello = caña + ~0,5–1 mm; cámara de 3 mm (3,5 en el de 5 mm) para la
 * altura de la cabeza; labio de 1,5 mm (mínimo 1,2). También el tipo de preajuste de usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { sanitizeKeyholeParams, type KeyholeParams } from './keyhole';

export interface BuiltinKeyholePreset {
  id: string;
  values: KeyholeParams;
}

const LIP_MM = 1.5;

const preset = (screwMm: number, headDiameterMm: number, neckWidthMm: number, slotLengthMm: number, chamberDepthMm: number): BuiltinKeyholePreset => ({
  id: `screw-${String(screwMm).replace('.', '_')}`,
  values: { screwMm, headDiameterMm, neckWidthMm, slotLengthMm, chamberDepthMm, lipMm: LIP_MM, angleDeg: 0 },
});

/** Incluidos (por verificar). El por defecto es el de 4 mm: cabeza Ø 8,5, cuello 4,5, recorrido 10, cámara 3. */
export const BUILTIN_KEYHOLE_PRESETS: readonly BuiltinKeyholePreset[] = [
  preset(3, 6.5, 3.5, 8, 3),
  preset(3.5, 7.5, 4, 9, 3),
  preset(4, 8.5, 4.5, 10, 3),
  preset(5, 10.5, 5.5, 12, 3.5),
];

export const DEFAULT_KEYHOLE_PRESET_ID = 'screw-4';

export const KEYHOLE_DEFAULTS: Readonly<KeyholeParams> =
  BUILTIN_KEYHOLE_PRESETS.find((p) => p.id === DEFAULT_KEYHOLE_PRESET_ID)!.values;

export const KEYHOLE_PRESET_STORAGE_KEY = 'kura3d-presets-keyhole';

/** Tipo de preajuste de usuario para `createUserPresetsStore`. */
export const KEYHOLE_PRESET_KIND = { storageKey: KEYHOLE_PRESET_STORAGE_KEY, sanitize: sanitizeKeyholeParams } as const;
