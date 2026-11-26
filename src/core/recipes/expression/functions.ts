/**
 * @file src/core/recipes/expression/functions.ts
 * @description Lista blanca de funciones y operadores del lenguaje de expresiones de recetas. Funciones puras sobre
 * números; los ángulos van en grados. `if`, `has`, `len`, `trim` y `lookup` son especiales y los resuelve el intérprete.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

const RAD = Math.PI / 180;

/** Evita `sin(180) = 1.2e-16`: los restos de coma flotante bajo 1e-12 se vuelven 0. */
function snap(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

interface NumericFunction {
  readonly minArgs: number;
  readonly maxArgs: number;
  readonly apply: (args: readonly number[]) => number;
}

const MAX_VARIADIC = 16;

/** Funciones numéricas puras. Un objeto sin prototipo: `toString`, `constructor`… no son funciones del lenguaje. */
export const NUMERIC_FUNCTIONS: Readonly<Record<string, NumericFunction>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, NumericFunction>, {
    min: { minArgs: 1, maxArgs: MAX_VARIADIC, apply: (a: readonly number[]) => Math.min(...a) },
    max: { minArgs: 1, maxArgs: MAX_VARIADIC, apply: (a: readonly number[]) => Math.max(...a) },
    abs: { minArgs: 1, maxArgs: 1, apply: (a: readonly number[]) => Math.abs(a[0]) },
    floor: { minArgs: 1, maxArgs: 1, apply: (a: readonly number[]) => Math.floor(a[0]) },
    ceil: { minArgs: 1, maxArgs: 1, apply: (a: readonly number[]) => Math.ceil(a[0]) },
    round: { minArgs: 1, maxArgs: 1, apply: (a: readonly number[]) => Math.round(a[0]) },
    sqrt: { minArgs: 1, maxArgs: 1, apply: (a: readonly number[]) => Math.sqrt(a[0]) },
    pow: { minArgs: 2, maxArgs: 2, apply: (a: readonly number[]) => Math.pow(a[0], a[1]) },
    clamp: { minArgs: 3, maxArgs: 3, apply: (a: readonly number[]) => Math.min(Math.max(a[0], a[1]), a[2]) },
    sin: { minArgs: 1, maxArgs: 1, apply: (a: readonly number[]) => snap(Math.sin(a[0] * RAD)) },
    cos: { minArgs: 1, maxArgs: 1, apply: (a: readonly number[]) => snap(Math.cos(a[0] * RAD)) },
    tan: { minArgs: 1, maxArgs: 1, apply: (a: readonly number[]) => snap(Math.tan(a[0] * RAD)) },
    atan2: { minArgs: 2, maxArgs: 2, apply: (a: readonly number[]) => snap(Math.atan2(a[0], a[1]) / RAD) },
  }),
);

/** Funciones especiales con su aridad: `if` evalúa solo la rama elegida; `has` recibe una ruta; `lookup` una tabla. */
export const SPECIAL_FUNCTIONS: Readonly<Record<string, { minArgs: number; maxArgs: number }>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, { minArgs: number; maxArgs: number }>, {
    if: { minArgs: 3, maxArgs: 3 },
    has: { minArgs: 1, maxArgs: 1 },
    len: { minArgs: 1, maxArgs: 1 },
    trim: { minArgs: 1, maxArgs: 1 },
    lookup: { minArgs: 2, maxArgs: 2 },
  }),
);

/** Constantes con nombre. */
export const CONSTANTS: Readonly<Record<string, number>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, number>, { pi: Math.PI }),
);

/** Operadores binarios aceptados y su precedencia (la misma de JavaScript). No hay bit a bit, `**`, `in` ni `??`. */
export const BINARY_OPERATORS: Readonly<Record<string, number>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, number>, {
    '||': 1,
    '&&': 2,
    '==': 6,
    '!=': 6,
    '<': 7,
    '>': 7,
    '<=': 7,
    '>=': 7,
    '+': 9,
    '-': 9,
    '*': 10,
    '/': 10,
    '%': 10,
  }),
);

export const UNARY_OPERATORS: ReadonlySet<string> = new Set(['-', '+', '!']);

export function isFunctionName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(NUMERIC_FUNCTIONS, name) || Object.prototype.hasOwnProperty.call(SPECIAL_FUNCTIONS, name);
}

export function arityOf(name: string): { minArgs: number; maxArgs: number } {
  return NUMERIC_FUNCTIONS[name] ?? SPECIAL_FUNCTIONS[name];
}
