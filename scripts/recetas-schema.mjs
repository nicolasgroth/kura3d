/**
 * @file scripts/recetas-schema.mjs
 * @description Escribe el JSON Schema de las recetas (`kura.recipe/1`) en `docs/recetas/kura.recipe-1.schema.json`,
 * generado desde el esquema zod de `src/core/recipes/schema/`. Usa el cargador de módulos de Vite (sin servidor).
 * Uso: `npm run recetas:schema`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'docs/recetas/kura.recipe-1.schema.json');

const { module } = await runnerImport(resolve(root, 'src/core/recipes/schema/jsonSchema.ts'), { root, configFile: false, logLevel: 'error' });
await mkdir(dirname(target), { recursive: true });
await writeFile(target, module.recipeJsonSchemaText(), 'utf8');
console.log(`JSON Schema escrito en ${target}`);
