/**
 * @file src/core/recipes/schema/values.ts
 * @description Piezas básicas del esquema `kura.recipe/1` en zod: expresiones, literales, textos, nombres seguros,
 * vectores y argumentos de pasos (recursivos y acotados). Solo forma; el análisis de expresiones y referencias vive
 * en `../validate`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { z } from 'zod';
import { EXPRESSION_LIMITS, RECIPE_LIMITS } from '../limits';
import { SAFE_NAME_PATTERN, STRING_KEY_PATTERN, isForbiddenKey } from '../names';

/** Identificador de parámetro, derivado, paso, tabla o recurso. */
export const SafeName = z
  .string()
  .regex(SAFE_NAME_PATTERN)
  .refine((name) => !isForbiddenKey(name), { message: 'forbidden name' })
  .describe('Identificador: letras, dígitos y _, sin empezar por dígito ni por __ (máx. 64).');

export const StringKey = z.string().regex(STRING_KEY_PATTERN).refine((key) => !isForbiddenKey(key), { message: 'forbidden key' });

/** Expresión: texto que empieza con `=`. */
export const Expr = z
  .string()
  .regex(/^=/)
  .max(EXPRESSION_LIMITS.maxLength)
  .describe('Expresión acotada: empieza con "=" (ver docs/recetas/FORMATO.md).');

/** Texto visible: plano (≤ 200) o clave traducible `$t:clave`. */
export const Text = z.string().min(1).max(RECIPE_LIMITS.maxShortText).describe('Texto plano (≤ 200) o "$t:clave" buscada en strings.<idioma>.');

export const NumOrExpr = z.union([z.number(), Expr]);
export const BoolOrExpr = z.union([z.boolean(), Expr]);

/** Literal: número, booleano o texto corto. Un texto que empieza con `=` se lee como expresión. */
export const Literal = z.union([z.number(), z.boolean(), z.string().max(RECIPE_LIMITS.maxShortText)]);

export const Vec3 = z.tuple([NumOrExpr, NumOrExpr, NumOrExpr]);

/** Referencia al resultado de un paso anterior: `@id`. */
export const StepRef = z.string().regex(/^@[A-Za-z_][A-Za-z0-9_]{0,63}$/).describe('Resultado de un paso anterior: "@id".');

/** Argumento de un paso: literal, expresión, `@paso`, `$asset:id`, lista u objeto (nombres del bus). */
export type ArgValue = number | boolean | string | ArgValue[] | { [key: string]: ArgValue };

export const ArgValue: z.ZodType<ArgValue> = z.lazy(() =>
  z.union([
    z.number(),
    z.boolean(),
    z.string().max(EXPRESSION_LIMITS.maxLength),
    z.array(ArgValue).max(RECIPE_LIMITS.maxListItems),
    z.record(SafeName, ArgValue),
  ]),
);

export const Args = z.record(SafeName, ArgValue).describe('Argumentos del comando, con los nombres del Command Bus.');
