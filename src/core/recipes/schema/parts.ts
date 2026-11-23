/**
 * @file src/core/recipes/schema/parts.ts
 * @description Esquema zod de las secciones de una receta `kura.recipe/1`: parámetros por tipo, reglas, variantes,
 * pasos con `pattern` (siempre con `max`), salidas, chequeos, tablas, recursos embebidos y textos. Todo objeto es
 * estricto: un campo desconocido es error.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { z } from 'zod';
import { RECIPE_ASSET_MAX_BYTES, RECIPE_LANGUAGES, RECIPE_LIMITS } from '../limits';
import { Args, BoolOrExpr, Expr, Literal, NumOrExpr, SafeName, StepRef, StringKey, Text, Vec3 } from './values';

/** Comandos del bus (y operaciones propias del ejecutor) que una receta puede usar como paso. */
export const RECIPE_OPS = [
  'create_primitive',
  'transform_object',
  'boolean_operation',
  'convex_hull',
  'mirror_object',
  'hollow_object',
  'create_thread',
  'import_svg',
  'plane_cut',
  'combine_objects',
  'align_objects',
  'recipe.place',
] as const;

const PageId = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/);

const paramBase = {
  id: SafeName,
  label: Text,
  help: Text.optional(),
  page: PageId.optional(),
  visibleWhen: BoolOrExpr.optional(),
  enabledWhen: BoolOrExpr.optional(),
};

const NumberParam = z.strictObject({
  ...paramBase,
  type: z.enum(['number', 'integer']),
  unit: z.enum(['mm', 'deg', 'percent', 'count']).optional(),
  min: NumOrExpr.optional(),
  max: NumOrExpr.optional(),
  step: NumOrExpr.optional(),
  default: NumOrExpr,
});

const BooleanParam = z.strictObject({ ...paramBase, type: z.literal('boolean'), default: BoolOrExpr });

const OptionValue = z.union([z.number(), z.string().regex(/^[^=@$]/).max(64)]);

const ChoiceParam = z.strictObject({
  ...paramBase,
  type: z.literal('choice'),
  options: z.array(z.strictObject({ value: OptionValue, label: Text })).min(1).max(RECIPE_LIMITS.maxOptions),
  default: z.union([OptionValue, Expr]),
});

const TextParam = z.strictObject({
  ...paramBase,
  type: z.literal('text'),
  maxLength: z.number().int().min(1).max(RECIPE_LIMITS.maxTextParamLength),
  multiline: z.boolean().optional(),
  default: z.string().max(RECIPE_LIMITS.maxTextParamLength),
});

const FileParam = z.strictObject({
  ...paramBase,
  type: z.literal('file'),
  accept: z.array(z.enum(['svg', 'png', 'jpg'])).min(1).max(3),
  maxBytes: z.number().int().min(1).max(RECIPE_LIMITS.maxFileParamBytes),
  optional: z.boolean().optional(),
});

const ObjectParam = z.strictObject({ ...paramBase, type: z.literal('object'), optional: z.boolean().optional() });

export const Param = z.discriminatedUnion('type', [NumberParam, BooleanParam, ChoiceParam, TextParam, FileParam, ObjectParam]);

export const Rule = z.strictObject({
  when: BoolOrExpr,
  level: z.enum(['error', 'warning', 'info']),
  message: Text,
  /** Valores para interpolar en el mensaje (`{nombre}`). */
  params: z.record(SafeName, z.union([Literal, Expr])).optional(),
  /** Parámetro que la interfaz resalta. */
  focus: SafeName.optional(),
});

export const Preset = z.strictObject({
  id: SafeName,
  label: Text,
  verified: z.boolean(),
  values: z.record(SafeName, Literal),
});

const PatternMax = z.number().int().min(1).max(RECIPE_LIMITS.maxPatternInstances).describe('Tope de instancias del patrón (obligatorio, ≤ 256).');

export const Pattern = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('linear'), count: NumOrExpr, step: Vec3, centered: z.boolean().optional(), max: PatternMax }),
  z.strictObject({
    kind: z.literal('grid'),
    nx: NumOrExpr,
    ny: NumOrExpr,
    dx: NumOrExpr,
    dy: NumOrExpr,
    centered: z.boolean().optional(),
    max: PatternMax,
  }),
  z.strictObject({ kind: z.literal('circular'), count: NumOrExpr, radius: NumOrExpr, startDeg: NumOrExpr.optional(), max: PatternMax }),
  z.strictObject({ kind: z.literal('corners'), width: NumOrExpr, depth: NumOrExpr, max: PatternMax }),
  z.strictObject({ kind: z.literal('points'), points: z.array(Vec3).min(1).max(RECIPE_LIMITS.maxPatternPoints), max: PatternMax }),
]);

export const Step = z.strictObject({
  id: SafeName,
  op: z.enum(RECIPE_OPS),
  args: Args,
  when: BoolOrExpr.optional(),
  pattern: Pattern.optional(),
});

export const Output = z.strictObject({
  ref: StepRef,
  name: z.union([Text, Expr]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isHole: z.boolean().optional(),
});

export const Check = z.strictObject({
  kind: z.literal('fits_bed'),
  refs: z.array(StepRef).min(1).max(RECIPE_LIMITS.maxOutputs),
  onFail: z.enum(['offer_split', 'warn']),
});

export const Tables = z.record(SafeName, z.record(z.string().min(1).max(64), Literal));

const maxBase64 = (bytes: number) => Math.ceil(bytes / 3) * 4;

export const Asset = z.strictObject({
  id: SafeName,
  kind: z.enum(Object.keys(RECIPE_ASSET_MAX_BYTES) as [keyof typeof RECIPE_ASSET_MAX_BYTES, ...(keyof typeof RECIPE_ASSET_MAX_BYTES)[]]),
  /** Contenido en base64 (sin prefijo `data:`). */
  data: z.string().max(maxBase64(RECIPE_LIMITS.maxAssetsTotalBytes)),
  label: Text.optional(),
});

const LanguageStrings = z.record(StringKey, Text);
export const Strings = z.strictObject(
  Object.fromEntries(RECIPE_LANGUAGES.map((lang) => [lang, LanguageStrings.optional()])) as Record<(typeof RECIPE_LANGUAGES)[number], z.ZodOptional<typeof LanguageStrings>>,
);

export const Override = z.strictObject({ default: z.union([Literal, Expr]).optional(), min: NumOrExpr.optional(), max: NumOrExpr.optional() });

export { Expr };
