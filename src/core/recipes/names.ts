/**
 * @file src/core/recipes/names.ts
 * @description Nombres seguros en recetas: ids de parámetros, derivados, pasos, tablas y claves de textos. Rechaza
 * `__proto__`, `constructor`, `prototype` y todo nombre con doble guion bajo inicial, para que ninguna clave de una
 * receta pueda tocar prototipos aunque termine como propiedad de un objeto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** Identificador de parámetro, derivado, paso o tabla: `[A-Za-z_][A-Za-z0-9_]*`, ≤ 64. */
export const SAFE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** Clave de texto traducible (`$t:clave`): admite puntos y guiones. */
export const STRING_KEY_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/;

export function isForbiddenKey(name: string): boolean {
  return FORBIDDEN_KEYS.has(name) || name.startsWith('__');
}

export function isSafeName(name: string): boolean {
  return SAFE_NAME_PATTERN.test(name) && !isForbiddenKey(name);
}

/** Copia de pares a un objeto sin prototipo (las claves ya se validaron). */
export function nullRecord<T>(entries: Iterable<readonly [string, T]>): Record<string, T> {
  const out = Object.create(null) as Record<string, T>;
  for (const [key, value] of entries) out[key] = value;
  return out;
}
