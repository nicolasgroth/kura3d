/**
 * @file src/store/splitPreferences.ts
 * @description Preferencias del usuario para "Dividir para imprimir" y el corte por plano: conector por
 * defecto, holgura por defecto y si se refuerzan solas las uniones débiles. Son del usuario (localStorage,
 * no van al proyecto) y no guardan nada sensible. Aquí viven el tipo, los valores iniciales (de
 * `OPERATION_DEFAULTS`), la validación al leer y la traducción al tipo de conector del corte por plano.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { OPERATION_DEFAULTS, OPERATION_RANGES } from '../engine/operationLimits';
import type { CutConnectorType } from '../types/kura';
import { readStorage } from './preferencesStorage';

export const STORAGE_SPLIT_PREFS_KEY = 'kura3d-split-prefs';

/** Tipos de unión que ofrece el panel (`auto` = espiga donde quepa y corte liso donde no). */
export const SPLIT_PREF_CONNECTORS = ['auto', 'dowel', 'peg', 'dovetail', 'loose-dowel', 'lap', 'none'] as const;
export type SplitPrefConnector = (typeof SPLIT_PREF_CONNECTORS)[number];

export interface SplitPreferences {
  connectorType: SplitPrefConnector;
  /** Holgura de ajuste en mm. */
  tolerance: number;
  /** Tamaño del conector: `'auto'` (cada unión usa su radio recomendado) o el radio fijo en mm (se muestra como diámetro Ø). */
  connectorSize: 'auto' | number;
  /** Casilla "Reforzar uniones débiles" al abrir el panel. */
  reinforceWeakJoints: boolean;
}

const D = OPERATION_DEFAULTS.split;
export const DEFAULT_SPLIT_PREFERENCES: SplitPreferences = {
  connectorType: D.prefConnectorType,
  tolerance: D.prefTolerance,
  connectorSize: D.prefConnectorSize,
  reinforceWeakJoints: D.reinforceWeakJoints,
};

/** Valida (y recorta al rango) un valor leído o recibido; lo inválido vuelve al valor base. */
export function sanitizeSplitPreferences(raw: unknown, base: SplitPreferences = DEFAULT_SPLIT_PREFERENCES): SplitPreferences {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof SplitPreferences, unknown>>;
  const { min, max } = OPERATION_RANGES.cut.tolerance;
  const tol = typeof r.tolerance === 'number' && Number.isFinite(r.tolerance) ? Math.min(max, Math.max(min, r.tolerance)) : base.tolerance;
  const size = OPERATION_RANGES.cut.connectorSize;
  const connectorSize =
    r.connectorSize === 'auto' ? 'auto'
      : typeof r.connectorSize === 'number' && Number.isFinite(r.connectorSize) ? Math.round(Math.min(size.max, Math.max(size.min, r.connectorSize)) * 100) / 100
        : base.connectorSize;
  return {
    connectorSize,
    connectorType: SPLIT_PREF_CONNECTORS.includes(r.connectorType as SplitPrefConnector) ? (r.connectorType as SplitPrefConnector) : base.connectorType,
    tolerance: Math.round(tol * 100) / 100,
    reinforceWeakJoints: typeof r.reinforceWeakJoints === 'boolean' ? r.reinforceWeakJoints : base.reinforceWeakJoints,
  };
}

export function loadInitialSplitPreferences(): SplitPreferences {
  const raw = readStorage(STORAGE_SPLIT_PREFS_KEY);
  if (!raw) return DEFAULT_SPLIT_PREFERENCES;
  try {
    return sanitizeSplitPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_SPLIT_PREFERENCES;
  }
}

/** Conector inicial del diálogo de corte por plano: el preferido si ese diálogo lo ofrece; si no, espiga. */
export function cutConnectorFromPreference(type: SplitPrefConnector): CutConnectorType {
  return type === 'none' || type === 'dowel' || type === 'peg' || type === 'dovetail' ? type : 'dowel';
}
