/**
 * @file src/core/recipes/schema/recipeSchema.ts
 * @description Esquema zod completo de una receta `kura.recipe/1` (manifiesto + secciones) y sus tipos. Es la fuente
 * del JSON Schema exportable (`npm run recetas:schema`). Estricto: rechaza campos desconocidos en todo nivel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { z } from 'zod';
import { RECIPE_FORMAT, RECIPE_LICENSES, RECIPE_LIMITS } from '../limits';
import { Asset, Check, Output, Override, Param, Preset, Rule, Step, Strings, Tables } from './parts';
import { Literal, NumOrExpr, SafeName, Text } from './values';

const L = RECIPE_LIMITS;

export const RecipeSchema = z
  .strictObject({
    format: z.literal(RECIPE_FORMAT),
    id: z
      .string()
      .max(L.maxIdLength)
      .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)
      .describe('autor.nombre en minúsculas, dígitos, puntos y guiones (máx. 64).'),
    version: z.string().max(32).regex(/^\d{1,4}\.\d{1,4}\.\d{1,6}(-[0-9A-Za-z.-]{1,20})?$/).describe('Versión semver de la receta.'),
    kura: z
      .string()
      .max(40)
      .regex(/^(>=|>|<=|<|=|\^|~)?\d{1,4}\.\d{1,4}\.\d{1,6}( (>=|>|<=|<|=|\^|~)?\d{1,4}\.\d{1,4}\.\d{1,6})?$/)
      .optional()
      .describe('Versiones de Kura3D compatibles (rango semver simple).'),
    title: Text,
    description: Text.optional(),
    author: Text,
    license: z.enum(RECIPE_LICENSES),
    category: z.string().regex(/^[a-z0-9-]{1,32}$/).optional(),
    tags: z.array(z.string().regex(/^[a-z0-9-]{1,32}$/)).max(L.maxTags).optional(),
    extends: z
      .string()
      .max(L.maxIdLength + 16)
      .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+@[\^~]?\d{1,4}(\.\d{1,4}){0,2}$/)
      .optional()
      .describe('Receta base (id@rango). Una receta derivada solo cambia default/min/max, presets, reglas y textos.'),
    overrides: z.record(SafeName, Override).optional(),
    params: z.array(Param).max(L.maxParams).optional(),
    derive: z.record(SafeName, z.union([NumOrExpr, Literal])).optional(),
    tables: Tables.optional(),
    rules: z.array(Rule).max(L.maxRules).optional(),
    presets: z.array(Preset).max(L.maxPresets).optional(),
    steps: z.array(Step).max(L.maxSteps).optional(),
    outputs: z.array(Output).max(L.maxOutputs).optional(),
    checks: z.array(Check).max(L.maxChecks).optional(),
    assets: z.array(Asset).max(L.maxAssets).optional(),
    strings: Strings.optional(),
  })
  .describe('Receta de Kura3D (kura.recipe/1): parámetros, reglas y pasos sobre comandos del programa. Datos, no código.');

export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeParam = z.infer<typeof Param>;
export type RecipeStep = z.infer<typeof Step>;
export type RecipeRule = z.infer<typeof Rule>;
export type RecipePreset = z.infer<typeof Preset>;
export type RecipeOutput = z.infer<typeof Output>;
export type RecipeAsset = z.infer<typeof Asset>;
