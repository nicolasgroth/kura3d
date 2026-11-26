/**
 * @file src/core/bus/commandValidation.ts
 * @description Lectores tipados de parámetros del Command Bus (números con rango, vectores 3D
 * finitos, enumeraciones, textos, colores e IDs). Un parámetro ausente devuelve `undefined`; uno
 * presente con tipo o rango incorrecto lanza `CommandError('invalid-params')` en vez de caer en un
 * valor por defecto silencioso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { OperationRange } from '../../engine/operationLimits';
import type { Vec3 } from '../../types/kura';
import { CommandError } from './commandErrors';
import { isFiniteVec3, isValidScale, MAX_ABS_COORDINATE, MAX_SCALE, MIN_SCALE } from './transformLimits';

export type RawParams = Record<string, unknown>;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MAX_ID_LENGTH = 128;
const MAX_IDS = 256;

function invalid(param: string, expected: string): CommandError {
  return new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });
}

/** Primer parámetro presente (no `undefined`/`null`) entre varios alias y su nombre. */
export function pick(p: RawParams, ...keys: string[]): [string, unknown] | undefined {
  for (const key of keys) {
    const value = p[key];
    if (value !== undefined && value !== null) return [key, value];
  }
  return undefined;
}

export interface NumberRule {
  min?: number;
  max?: number;
  /** Mínimo exclusivo (p. ej. dimensiones > 0). */
  gt?: number;
  integer?: boolean;
}

function describeRule(rule: NumberRule): string {
  const kind = rule.integer ? 'integer' : 'number';
  const low = rule.gt !== undefined ? `(${rule.gt}` : `[${rule.min ?? -MAX_ABS_COORDINATE}`;
  return `${kind} ∈ ${low}, ${rule.max ?? MAX_ABS_COORDINATE}]`;
}

/** Número finito dentro del rango indicado. */
export function readNumber(p: RawParams, rule: NumberRule, ...keys: string[]): number | undefined {
  const found = pick(p, ...keys);
  if (!found) return undefined;
  const [key, value] = found;
  const max = rule.max ?? MAX_ABS_COORDINATE;
  const min = rule.min ?? -MAX_ABS_COORDINATE;
  const ok =
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value <= max &&
    value >= min &&
    (rule.gt === undefined || value > rule.gt) &&
    (!rule.integer || Number.isInteger(value));
  if (!ok) throw invalid(key, describeRule(rule));
  return value as number;
}

/** Número dentro de un rango de la fuente única (`operationLimits`). */
export function readRange(p: RawParams, range: OperationRange, ...keys: string[]): number | undefined {
  const rule: NumberRule = range.exclusiveMin
    ? { gt: range.min, min: range.min, max: range.max, integer: range.integer }
    : { min: range.min, max: range.max, integer: range.integer };
  return readNumber(p, rule, ...keys);
}

/** Longitud positiva en mm (0, max]. */
export const positiveMm = (max = 10_000): NumberRule => ({ gt: 0, max });
/** Valor no negativo [0, max]. */
export const nonNegative = (max = 10_000): NumberRule => ({ min: 0, max });

/** Vector [x, y, z] de números finitos (posición o rotación). */
export function readVec3(p: RawParams, ...keys: string[]): Vec3 | undefined {
  const found = pick(p, ...keys);
  if (!found) return undefined;
  const [key, value] = found;
  if (!isFiniteVec3(value)) throw invalid(key, `[number, number, number] (finite, ±${MAX_ABS_COORDINATE})`);
  return [...value] as Vec3;
}

/** Escala [sx, sy, sz] con cada factor en [MIN_SCALE, MAX_SCALE]. */
export function readScale(p: RawParams, ...keys: string[]): Vec3 | undefined {
  const found = pick(p, ...keys);
  if (!found) return undefined;
  const [key, value] = found;
  if (!isValidScale(value)) throw invalid(key, `[number, number, number] ∈ [${MIN_SCALE}, ${MAX_SCALE}]`);
  return [...value] as Vec3;
}

/** Booleano estricto. */
export function readBoolean(p: RawParams, ...keys: string[]): boolean | undefined {
  const found = pick(p, ...keys);
  if (!found) return undefined;
  const [key, value] = found;
  if (typeof value !== 'boolean') throw invalid(key, 'boolean');
  return value;
}

/** Texto sin caracteres de control y con longitud máxima. */
export function readString(p: RawParams, maxLength: number, ...keys: string[]): string | undefined {
  const found = pick(p, ...keys);
  if (!found) return undefined;
  const [key, value] = found;
  if (typeof value !== 'string' || value.length > maxLength) throw invalid(key, `string (≤ ${maxLength})`);
  // Los SVG legítimos llevan saltos de línea y tabulaciones; el resto de textos no.
  const allowsWhitespace = key === 'svgContent';
  // El texto 3D admite saltos de línea (varias líneas); el resto de controles no.
  const bad = allowsWhitespace ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : key === 'text' ? /[\u0000-\u0009\u000b-\u001f\u007f]/ : CONTROL_CHARS;
  if (bad.test(value)) throw invalid(key, 'string without control characters');
  return value;
}

/** Valor de una enumeración cerrada. */
export function readEnum<T extends string>(
  p: RawParams,
  allowed: readonly T[],
  ...keys: string[]
): T | undefined {
  const found = pick(p, ...keys);
  if (!found) return undefined;
  const [key, value] = found;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw invalid(key, allowed.join(' | '));
  }
  return value as T;
}

/** Color hexadecimal #rrggbb. */
export function readColor(p: RawParams, ...keys: string[]): string | undefined {
  const found = pick(p, ...keys);
  if (!found) return undefined;
  const [key, value] = found;
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) throw invalid(key, '#rrggbb');
  return value;
}

function isId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH &&
    !CONTROL_CHARS.test(value)
  );
}

/** ID de objeto con formato válido (la existencia se comprueba en `commandTargets`). */
export function readId(p: RawParams, ...keys: string[]): string | undefined {
  const found = pick(p, ...keys);
  if (!found) return undefined;
  const [key, value] = found;
  if (!isId(value)) throw invalid(key, `id (string ≤ ${MAX_ID_LENGTH})`);
  return value;
}

/** Lista de IDs únicos y con formato válido. */
export function readIds(p: RawParams, ...keys: string[]): string[] | undefined {
  const found = pick(p, ...keys);
  if (!found) return undefined;
  const [key, value] = found;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_IDS ||
    !value.every(isId) ||
    new Set(value).size !== value.length
  ) {
    throw invalid(key, `id[] (1–${MAX_IDS}, unique)`);
  }
  return [...value];
}
