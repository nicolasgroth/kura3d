/**
 * @file src/project/primitiveParamsBounds.ts
 * @description Acota los parámetros de primitiva de un proyecto .kura a los rangos del motor
 * (`primitiveLimits.ts`). Se acota en vez de rechazar: la malla va guardada aparte, así que un
 * proyecto antiguo o editado a mano con un valor fuera de rango se sigue abriendo igual y solo
 * sus parámetros editables quedan dentro de lo que la interfaz y el motor aceptan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { PRIMITIVE_PARAM_RANGES, primitiveRangeFor, type PrimitiveRangeKey } from '../engine/primitiveLimits';
import type { SceneObject } from '../types/kura';

type PrimitiveParams = NonNullable<SceneObject['primitiveParams']>;

const isRangeKey = (key: string): key is PrimitiveRangeKey => Object.hasOwn(PRIMITIVE_PARAM_RANGES, key);

/**
 * Devuelve `params` con cada número dentro del rango de su tipo (enteros redondeados). Si nada
 * cambia, devuelve el mismo objeto. Espera números ya validados como finitos por el esquema.
 */
export function boundPrimitiveParams(type: string | undefined, params: PrimitiveParams): PrimitiveParams {
  let out: Record<string, unknown> | null = null;
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'number' || !isRangeKey(key)) continue;
    const range = primitiveRangeFor(type ?? '', key);
    const rounded = range.integer ? Math.round(value) : value;
    const bounded = Math.min(range.max, Math.max(range.min, rounded));
    if (bounded !== value) {
      out ??= { ...params };
      out[key] = bounded;
    }
  }
  return (out as PrimitiveParams | null) ?? params;
}

/** Copia del objeto guardado con sus parámetros acotados (o el mismo si no hay nada que acotar). */
export function withBoundedParams<T extends { primitiveType?: string; primitiveParams?: PrimitiveParams }>(stored: T): T {
  if (!stored.primitiveParams) return stored;
  const bounded = boundPrimitiveParams(stored.primitiveType, stored.primitiveParams);
  return bounded === stored.primitiveParams ? stored : { ...stored, primitiveParams: bounded };
}
