/**
 * @file src/ai/toolValidation.ts
 * @description Valida nombre y parámetros de cada llamada de herramienta devuelta por un proveedor IA
 * contra la lista permitida de `toolSchemas.ts` antes de ejecutarla en la escena. Rechaza comandos
 * desconocidos, parámetros no declarados, tipos incorrectos, valores fuera de enumeración o de rango.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describeOperationRange, isInOperationRange, type OperationRange } from '../engine/operationLimits';
import type { KuraCommandRequest } from '../types/kura';
import { KURA_TOOL_SCHEMAS, TOOL_PARAM_RANGES } from './toolSchemas';

/** Máximo de llamadas de herramienta que se ejecutan en un mismo turno de chat. */
export const MAX_TOOL_CALLS_PER_TURN = 8;

const MAX_ABS_NUMBER = 100_000;
const MAX_STRING_LENGTH = 200;
const MAX_TEXT_LENGTH = 500;
const VECTOR_KEYS = new Set(['position', 'rotation', 'scale']);
const POSITIVE_KEYS = new Set(['width', 'height', 'radius', 'outerRadius', 'innerRadius']);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const SCHEMAS = new Map(KURA_TOOL_SCHEMAS.map((schema) => [schema.name, schema]));

export type ToolValidation =
  | { ok: true; request: Pick<KuraCommandRequest, 'command' | 'params'> }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function checkNumber(
  key: string,
  value: unknown,
  spec: Record<string, unknown> = {},
  range?: OperationRange,
): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_ABS_NUMBER) {
    return `"${key}" must be a finite number within ±${MAX_ABS_NUMBER}`;
  }
  // Rango de la fuente única (`operationLimits`), el mismo que aplica el Command Bus.
  if (range && !isInOperationRange(value, range)) return `"${key}" must be ${describeOperationRange(range)}`;
  if (spec.type === 'integer' && !Number.isInteger(value)) return `"${key}" must be an integer`;
  // Rango declarado en el esquema (para primitivas, el mismo del motor: `primitiveLimits`).
  const { minimum, maximum } = spec;
  if ((typeof minimum === 'number' && value < minimum) || (typeof maximum === 'number' && value > maximum)) {
    return `"${key}" must be between ${String(minimum ?? -MAX_ABS_NUMBER)} and ${String(maximum ?? MAX_ABS_NUMBER)}`;
  }
  if (POSITIVE_KEYS.has(key) && value <= 0) return `"${key}" must be greater than 0`;
  return null;
}

function checkValue(
  key: string,
  spec: Record<string, unknown>,
  value: unknown,
  range?: OperationRange,
): string | null {
  switch (spec.type) {
    case 'string': {
      if (typeof value !== 'string') return `"${key}" must be a string`;
      const limit = typeof spec.maxLength === 'number'
        ? spec.maxLength
        : key === 'text' ? MAX_TEXT_LENGTH : MAX_STRING_LENGTH;
      if (value.length > limit) return `"${key}" exceeds ${limit} characters`;
      // Mismo criterio que el puente MCP: sin caracteres de control en textos, IDs ni nombres.
      if (/[\u0000-\u001f\u007f]/.test(value)) return `"${key}" contains control characters`;
      if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
        return `"${key}" must be one of: ${spec.enum.join(', ')}`;
      }
      if (key === 'color' && !HEX_COLOR.test(value)) return '"color" must be #rrggbb';
      return null;
    }
    case 'number':
    case 'integer':
      return checkNumber(key, value, spec, range);
    case 'boolean':
      return typeof value === 'boolean' ? null : `"${key}" must be a boolean`;
    case 'array': {
      if (!Array.isArray(value)) return `"${key}" must be an array`;
      if (VECTOR_KEYS.has(key) && value.length !== 3) return `"${key}" must have 3 numbers`;
      for (const item of value) {
        const error = checkNumber(key, item, (spec.items ?? {}) as Record<string, unknown>, range);
        if (error) return error;
      }
      return null;
    }
    default:
      return `"${key}" has an unsupported type`;
  }
}

/**
 * Comprueba una llamada de herramienta de un proveedor. `rawArgs` puede venir como objeto o como
 * cadena JSON (OpenAI). Devuelve una copia de los parámetros aceptados o el motivo del rechazo.
 */
export function validateToolCall(name: unknown, rawArgs: unknown): ToolValidation {
  if (typeof name !== 'string' || !SCHEMAS.has(name as KuraCommandRequest['command'])) {
    return { ok: false, error: `Tool "${String(name).slice(0, 64)}" is not allowed` };
  }
  const schema = SCHEMAS.get(name as KuraCommandRequest['command'])!;

  let args: unknown = rawArgs ?? {};
  if (typeof args === 'string') {
    try {
      args = args.trim() ? JSON.parse(args) : {};
    } catch {
      return { ok: false, error: `Arguments for "${name}" are not valid JSON` };
    }
  }
  if (!isPlainObject(args)) {
    return { ok: false, error: `Arguments for "${name}" must be an object` };
  }

  const properties = schema.parameters.properties;
  const ranges = TOOL_PARAM_RANGES[schema.name] ?? {};
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) {
      return { ok: false, error: `Parameter "${key.slice(0, 64)}" is not allowed for "${name}"` };
    }
    if (value === null || value === undefined) continue;
    const range = Object.prototype.hasOwnProperty.call(ranges, key) ? ranges[key] : undefined;
    const error = checkValue(key, properties[key], value, range);
    if (error) return { ok: false, error };
    params[key] = Array.isArray(value) ? [...value] : value;
  }
  for (const key of schema.parameters.required ?? []) {
    if (!(key in params)) return { ok: false, error: `Missing required parameter "${key}"` };
  }
  return { ok: true, request: { command: schema.name, params } };
}
