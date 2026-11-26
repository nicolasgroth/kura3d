/**
 * @file src/engine/jointRules.ts
 * @description Reglas puras de "uniones firmes": números (pared mínima, conector mínimo útil,
 * encastre mínimo), tamaño máximo de un conector según la distancia al borde de la sección y nivel de
 * la unión (firme / justa / débil / pegada) con una regla explícita. Sin geometría: la medida de la
 * sección está en `jointSection.ts` y el plan en `jointSizing.ts`. Fuentes y límites de cada número en
 * `docs/diseno/UNIONES_FIRMES.md`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { CutConnectorType } from '../types/kura';
import { connectorFootprintRadius } from './cutConnectorLayout';
import { ASSEMBLY_LIMITS } from './operationLimits';

export type JointConnectorType = Exclude<CutConnectorType, 'none'>;

/** Números de las reglas (mm salvo indicación). Ver `docs/diseno/UNIONES_FIRMES.md`. */
export const JOINT_RULES = {
  /** Pared mínima alrededor del alojamiento: 3 perímetros de 0,4 mm (boquilla estándar FDM). */
  minWallMm: 1.2,
  /** Radio mínimo útil (Ø3 mm): el mismo `minConnectorRadiusMm` de la validación de armado. Por verificar. */
  minUsefulRadiusMm: ASSEMBLY_LIMITS.minConnectorRadiusMm,
  /** Encastre mínimo para que el conector sostenga (por debajo se descarta). Criterio propio, por verificar. */
  minDepthMm: 2,
  /** Encastre desde el que la unión puede ser firme (el mismo umbral de `suggestCutConnectors`). */
  firmDepthMm: 3,
  /** Fracción de área de conectores sobre la sección para no ser débil (`minConnectorAreaFraction`). */
  minAreaRatio: ASSEMBLY_LIMITS.minConnectorAreaFraction,
  /** Margen extra al borde que usa la ubicación por el facetado del offset (`layoutForCut`). */
  facetMarginMm: 0.02,
  /** Paso al que se redondean hacia abajo tamaño y profundidad. */
  stepMm: 0.05,
  /** Tope de conectores por unión (`OPERATION_RANGES.cut.connectorCount.max`). */
  maxCount: 8,
} as const;

/** Redondea hacia abajo al paso de las reglas (sin perder por el error de coma flotante). */
export const floorStep = (v: number) => Math.floor(v / JOINT_RULES.stepMm + 1e-6) * JOINT_RULES.stepMm;

/**
 * Mayor tamaño (radio, como `buildConnectorSolid`) de un conector cuyo alojamiento con holgura más la
 * pared `wallMm` cabe a `clearanceMm` del borde: huella(tamaño, holgura + pared) + margen ≤ distancia.
 * Equivale a «diámetro máximo = ancho local − 2·pared − 2·holgura» para el tarugo. 0 si no cabe nada.
 */
export function maxConnectorSize(type: JointConnectorType, clearanceMm: number, toleranceMm: number, wallMm: number): number {
  const fits = (s: number) => connectorFootprintRadius(type, s, toleranceMm + wallMm) + JOINT_RULES.facetMarginMm <= clearanceMm;
  if (!fits(0)) return 0;
  let lo = 0;
  let hi = Math.max(1, clearanceMm);
  while (fits(hi)) hi *= 2;
  for (let i = 0; i < 60 && hi - lo > 1e-7; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return floorStep(lo);
}

/** Área de la huella del macho (mm²) de un conector de tamaño `size`. */
export function connectorArea(type: JointConnectorType, size: number): number {
  if (type === 'dowel') return Math.PI * size * size;
  if (type === 'peg') return (1.8 * size) ** 2;
  // Cola de milano: trapecio medio (cuello 0,55·s, cabeza 0,95·s) por espesor 1,3·s
  return (0.55 + 0.95) * size * 1.3 * size;
}

export type JointLevel = 'firm' | 'fair' | 'weak' | 'glue';

/** Motivo de que una unión no sea firme (clave estable para i18n). */
export type JointLevelReason = 'no-connector' | 'single-connector' | 'low-area' | 'shallow' | 'islands-uncovered' | 'below-useful';

export interface JointLevelInput {
  count: number;
  /** Área de los machos / área de la sección. */
  areaRatio: number;
  islands: number;
  islandsCovered: number;
  depthMm: number;
  /** Algún conector bajo el mínimo útil (solo si el usuario lo pidió así). */
  belowUseful?: boolean;
}

/**
 * Nivel de la unión:
 * - `glue`: ningún conector.
 * - `weak`: área de machos < `minAreaRatio`·sección, encastre < `minDepthMm`, o conector bajo el mínimo útil.
 * - `firm`: ≥ 2 conectores (resiste el giro), área ≥ `minAreaRatio`, encastre ≥ `firmDepthMm` y todas las
 *   islas cubiertas.
 * - `fair` (justa): el resto (un solo conector, encastre corto o islas solo pegadas).
 */
export function jointLevel(i: JointLevelInput): { level: JointLevel; reasons: JointLevelReason[] } {
  if (i.count === 0) return { level: 'glue', reasons: ['no-connector'] };
  const weak: JointLevelReason[] = [];
  if (i.areaRatio < JOINT_RULES.minAreaRatio) weak.push('low-area');
  if (i.depthMm < JOINT_RULES.minDepthMm) weak.push('shallow');
  if (i.belowUseful) weak.push('below-useful');
  if (weak.length > 0) return { level: 'weak', reasons: weak };
  const fair: JointLevelReason[] = [];
  if (i.count < 2) fair.push('single-connector');
  if (i.depthMm < JOINT_RULES.firmDepthMm) fair.push('shallow');
  if (i.islandsCovered < i.islands) fair.push('islands-uncovered');
  return fair.length > 0 ? { level: 'fair', reasons: fair } : { level: 'firm', reasons: [] };
}
