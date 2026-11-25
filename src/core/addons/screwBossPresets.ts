/**
 * @file src/core/addons/screwBossPresets.ts
 * @description Tabla de medidas incluida de la torreta para tornillo (valores típicos, POR VERIFICAR con una
 * impresión de prueba): tornillo directo al plástico M2, M2,5, M3 (por defecto) y M4 con agujero piloto ≈ 0,85 ×
 * nominal, e insertos roscados M2 a M5 con el diámetro y el largo típicos del inserto (profundidad = largo + 1 mm).
 * Alto del poste por defecto = profundidad + 2 mm; diámetro exterior = 2,5 × nominal (mínimo agujero + 2 × 1,2 mm).
 * También el tipo de preajuste de usuario y el texto del resumen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { defaultOuterDiameter, sanitizeScrewBossParams, type ScrewBossParams, type ScrewBossType } from './screwBoss';

export interface BuiltinScrewBossPreset {
  id: string;
  values: ScrewBossParams;
  /** Largo del inserto (solo insertos), para el rótulo. */
  insertLengthMm?: number;
}

/** Margen bajo el agujero hasta la base del poste en los valores por defecto (mm). */
const FLOOR_MM = 2;
/** Profundidad extra bajo el inserto (mm): deja lugar al plástico que el inserto empuja al entrar. */
export const INSERT_EXTRA_DEPTH_MM = 1;

const round2 = (n: number) => Math.round(n * 100) / 100;

const screw = (nominalMm: number, holeDiameterMm: number, holeDepthMm: number): BuiltinScrewBossPreset => ({
  id: `screw-m${String(nominalMm).replace('.', '_')}`,
  values: {
    type: 'screw', nominalMm, holeDiameterMm, holeDepthMm,
    heightMm: holeDepthMm + FLOOR_MM, outerDiameterMm: defaultOuterDiameter(nominalMm, holeDiameterMm),
  },
});

const insert = (nominalMm: number, holeDiameterMm: number, insertLengthMm: number): BuiltinScrewBossPreset => {
  const holeDepthMm = round2(insertLengthMm + INSERT_EXTRA_DEPTH_MM);
  return {
    id: `insert-m${String(nominalMm).replace('.', '_')}`,
    insertLengthMm,
    values: {
      type: 'insert', nominalMm, holeDiameterMm, holeDepthMm,
      heightMm: round2(holeDepthMm + FLOOR_MM), outerDiameterMm: defaultOuterDiameter(nominalMm, holeDiameterMm),
    },
  };
};

/** Incluidos (por verificar). El por defecto es el tornillo directo M3. */
export const BUILTIN_SCREW_BOSS_PRESETS: readonly BuiltinScrewBossPreset[] = [
  screw(2, 1.7, 6),
  screw(2.5, 2.1, 7),
  screw(3, 2.5, 8),
  screw(4, 3.4, 10),
  insert(2, 3.2, 3),
  insert(2.5, 3.6, 4),
  insert(3, 4.0, 5.7),
  insert(4, 5.6, 8.1),
  insert(5, 6.4, 9.5),
];

export const DEFAULT_SCREW_BOSS_PRESET_ID = 'screw-m3';

export const SCREW_BOSS_DEFAULTS: Readonly<ScrewBossParams> =
  BUILTIN_SCREW_BOSS_PRESETS.find((p) => p.id === DEFAULT_SCREW_BOSS_PRESET_ID)!.values;

/** Preajustes incluidos de un tipo, en orden de medida. */
export const builtinScrewBossPresetsOf = (type: ScrewBossType) => BUILTIN_SCREW_BOSS_PRESETS.filter((p) => p.values.type === type);

export const SCREW_BOSS_PRESET_STORAGE_KEY = 'kura3d-presets-screw-boss';

/** Tipo de preajuste de usuario para `createUserPresetsStore`. */
export const SCREW_BOSS_PRESET_KIND = { storageKey: SCREW_BOSS_PRESET_STORAGE_KEY, sanitize: sanitizeScrewBossParams } as const;

/** Número con coma decimal si el idioma la usa (máximo 2 decimales). */
export const formatMm = (n: number, locale = 'es') => n.toLocaleString(locale, { maximumFractionDigits: 2 });

/** Medida métrica como texto («M3», «M2,5»). */
export const metricLabel = (nominalMm: number, locale = 'es') => `M${formatMm(nominalMm, locale)}`;
