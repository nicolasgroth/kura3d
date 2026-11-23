/**
 * @file src/engine/threadDefaults.ts
 * @description Valores por defecto de una pieza roscada según su diámetro: paso grueso ISO 261, altura
 * de tuerca ≈ ISO 4032 (m = 0,8·d redondeado a 0,1 mm; aproximación de la norma, que da 0,8–0,9·d) y
 * largo roscado del perno o del agujero proporcional al diámetro (2,5·d redondeado a 0,5 mm), todo
 * dentro de los rangos de `OPERATION_RANGES.thread`. El diálogo y el bus los usan al cambiar el
 * diámetro sin pisar un valor que el usuario ya editó.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ThreadOptions } from '../types/kura';
import { OPERATION_RANGES } from './operationLimits';
import { isoCoarsePitch } from './threads';

/** Altura de tuerca respecto del diámetro (ISO 4032: m ≈ 0,8–0,9·d). */
export const NUT_HEIGHT_RATIO = 0.8;
/** Largo roscado por defecto del perno y del agujero respecto del diámetro. */
export const BOLT_LENGTH_RATIO = 2.5;

export interface ThreadDefaults {
  pitchMm: number;
  lengthMm: number;
}

const clampLength = (mm: number) => {
  const { min, max } = OPERATION_RANGES.thread.lengthMm;
  return Math.min(max, Math.max(min, mm));
};

/** Paso y largo por defecto para un diámetro nominal `diameterMm` y el tipo de pieza. */
export function threadDefaults(diameterMm: number, kind: ThreadOptions['kind']): ThreadDefaults {
  const lengthMm = kind === 'nut'
    ? Math.round(diameterMm * NUT_HEIGHT_RATIO * 10) / 10
    : Math.round(diameterMm * BOLT_LENGTH_RATIO * 2) / 2;
  return { pitchMm: isoCoarsePitch(diameterMm), lengthMm: clampLength(lengthMm) };
}
