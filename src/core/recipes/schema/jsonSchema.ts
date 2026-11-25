/**
 * @file src/core/recipes/schema/jsonSchema.ts
 * @description JSON Schema (draft 2020-12) de `kura.recipe/1` generado desde el esquema zod con `z.toJSONSchema`,
 * para que editores e IA validen recetas. Lo escribe `npm run recetas:schema` en `docs/recetas/kura.recipe-1.schema.json`.
 * Las reglas semánticas (referencias, alcance de expresiones, ciclos, topes de trabajo) no caben en un JSON Schema:
 * las aplica solo el validador de Kurra3D Studio.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { z } from 'zod';
import { RecipeSchema } from './recipeSchema';

export const RECIPE_SCHEMA_ID = 'https://github.com/nicolasgroth/kura3d/blob/main/docs/recetas/kura.recipe-1.schema.json';

export function recipeJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(RecipeSchema, { target: 'draft-2020-12', io: 'input', unrepresentable: 'any', cycles: 'ref' }) as Record<string, unknown>;
  return { $schema: schema.$schema, $id: RECIPE_SCHEMA_ID, title: 'kura.recipe/1', ...schema };
}

/** Texto estable del archivo (dos espacios, salto de línea final). */
export function recipeJsonSchemaText(): string {
  return JSON.stringify(recipeJsonSchema(), null, 2) + '\n';
}
