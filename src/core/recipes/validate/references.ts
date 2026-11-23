/**
 * @file src/core/recipes/validate/references.ts
 * @description Comprueba que cada ruta leída por una expresión exista y tenga la forma permitida: `p.<param>`
 * (y `p.<objeto>.<min|max|size|center>.<x|y|z>`), `d.<derivado>`, `s.<paso anterior>.<caja>.<eje>`, `bed.<w|d|h>`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { issue, type RecipeIssue } from '../errors';
import type { CompiledExpr } from '../expression/compile';
import type { RecipeParam } from '../schema/recipeSchema';
import type { ExprSite } from './collect';

export const BOX_FIELDS: ReadonlySet<string> = new Set(['min', 'max', 'size', 'center']);
export const AXES: ReadonlySet<string> = new Set(['x', 'y', 'z']);
export const BED_FIELDS: ReadonlySet<string> = new Set(['w', 'd', 'h']);

export interface RefContext {
  readonly params: ReadonlyMap<string, RecipeParam>;
  readonly derive: ReadonlySet<string>;
  readonly steps: ReadonlyMap<string, number>;
  readonly tables: ReadonlySet<string>;
}

const isBoxPath = (rest: readonly string[]) => rest.length === 2 && BOX_FIELDS.has(rest[0]) && AXES.has(rest[1]);

/** Problemas de referencias de una expresión ya compilada (lista vacía si todo existe). */
export function checkReferences(site: ExprSite, compiled: CompiledExpr, ctx: RefContext): RecipeIssue[] {
  const out: RecipeIssue[] = [];
  for (const path of compiled.paths) {
    const [root, name, ...rest] = path;
    const shown = path.join('.');
    if (name === undefined) {
      out.push(issue('ref.badPath', site.path, { detail: shown }));
      continue;
    }
    if (root === 'p') {
      const param = ctx.params.get(name);
      if (!param) out.push(issue('ref.unknownParam', site.path, { detail: shown }));
      else if (rest.length > 0 && !(param.type === 'object' && isBoxPath(rest))) out.push(issue('ref.badPath', site.path, { detail: shown }));
    } else if (root === 'd') {
      if (!ctx.derive.has(name)) out.push(issue('ref.unknownDerive', site.path, { detail: shown }));
      else if (rest.length > 0) out.push(issue('ref.badPath', site.path, { detail: shown }));
    } else if (root === 's') {
      const index = ctx.steps.get(name);
      if (index === undefined) out.push(issue('ref.unknownStep', site.path, { detail: shown }));
      else if (site.stepIndex === undefined || index >= site.stepIndex) out.push(issue('ref.stepOrder', site.path, { detail: shown }));
      else if (!isBoxPath(rest)) out.push(issue('ref.badPath', site.path, { detail: shown }));
    } else if (root === 'bed') {
      if (!BED_FIELDS.has(name) || rest.length > 0) out.push(issue('ref.badPath', site.path, { detail: shown }));
    }
  }
  for (const table of compiled.tables) {
    if (!ctx.tables.has(table)) out.push(issue('ref.unknownTable', site.path, { detail: table }));
  }
  return out;
}

/** Ids de parámetros `p.*` que una expresión lee (para el grafo de dependencias de parámetros). */
export function paramDeps(compiled: CompiledExpr): string[] {
  return compiled.paths.filter((path) => path[0] === 'p' && path.length >= 2).map((path) => path[1]);
}

export function deriveDeps(compiled: CompiledExpr): string[] {
  return compiled.paths.filter((path) => path[0] === 'd' && path.length >= 2).map((path) => path[1]);
}
