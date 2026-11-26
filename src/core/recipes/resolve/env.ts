/**
 * @file src/core/recipes/resolve/env.ts
 * @description Entorno de evaluación de una resolución: valores de parámetros (`p`), derivados (`d`), cama (`bed`),
 * tablas y el contador compartido. Lee solo rutas declaradas; los mapas no tienen prototipo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { RecipeError } from '../errors';
import type { CompiledExpr } from '../expression/compile';
import { evaluateExpression, type EvalBudget, type ExprEnv, type ExprValue } from '../expression/evaluate';
import type { Recipe, RecipeParam } from '../schema/recipeSchema';
import type { FileAnswer, ObjectAnswer, ResolveOptions } from './types';
import type { PatternLocals } from './pattern';

export type ParamValue = ExprValue | ObjectAnswer | FileAnswer | null;

export class RecipeEnv {
  readonly values = new Map<string, ParamValue>();
  readonly derived = new Map<string, ExprValue>();

  constructor(
    readonly recipe: Recipe,
    readonly params: ReadonlyMap<string, RecipeParam>,
    readonly exprs: ReadonlyMap<string, CompiledExpr>,
    readonly budget: EvalBudget,
    readonly options: ResolveOptions,
  ) {}

  private read(path: readonly string[], at: string): ExprValue {
    const [root, name, field, axis] = path;
    if (root === 'p') {
      const param = this.params.get(name);
      const value = this.values.get(name);
      if (!param || value === undefined) throw new RecipeError('ref.unknownParam', at, { detail: path.join('.') });
      if (param.type === 'object') {
        if (value === null || typeof value !== 'object' || !('box' in value)) throw new RecipeError('param.required', at, { detail: name });
        const { min, max } = value.box;
        const k = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        if (field === 'min') return min[k];
        if (field === 'max') return max[k];
        if (field === 'size') return max[k] - min[k];
        if (field === 'center') return (min[k] + max[k]) / 2;
        throw new RecipeError('ref.badPath', at, { detail: path.join('.') });
      }
      if (value === null || typeof value === 'object') throw new RecipeError('expr.type', at, { expected: 'number', got: param.type });
      return value;
    }
    if (root === 'd') {
      const value = this.derived.get(name);
      if (value === undefined) throw new RecipeError('ref.unknownDerive', at, { detail: path.join('.') });
      return value;
    }
    if (root === 'bed') {
      const bed = this.options.bed;
      if (!bed) throw new RecipeError('expr.scope', at, { detail: 'bed' });
      return bed[name as 'w' | 'd' | 'h'];
    }
    // `s.*` solo existe en la ejecución: la resolución lo deja diferido antes de llegar aquí.
    throw new RecipeError('expr.scope', at, { detail: path.join('.') });
  }

  env(locals?: PatternLocals): ExprEnv {
    return {
      budget: this.budget,
      locals,
      read: (path, at) => this.read(path, at),
      has: (path) => {
        const value = this.values.get(path[1]);
        return value !== undefined && value !== null && value !== '';
      },
      lookup: (table, key, at) => {
        const rows = this.recipe.tables?.[table];
        const k = String(key);
        if (!rows || !Object.prototype.hasOwnProperty.call(rows, k)) throw new RecipeError('ref.unknownTable', at, { detail: `${table}[${k}]` });
        const value = rows[k];
        if (typeof value === 'string' && value.startsWith('=')) throw new RecipeError('expr.type', at, { expected: 'literal', got: 'expression' });
        return value;
      },
    };
  }

  /** Valor de un campo: literal tal cual o expresión compilada en validación (por su ruta). */
  value(raw: unknown, at: string, locals?: PatternLocals): ExprValue {
    if (typeof raw === 'string' && raw.startsWith('=')) {
      const compiled = this.exprs.get(at);
      if (!compiled) throw new RecipeError('expr.syntax', at, { detail: 'not compiled' });
      return evaluateExpression(compiled, this.env(locals), at);
    }
    if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string') return raw;
    throw new RecipeError('expr.type', at, { expected: 'literal', got: typeof raw });
  }

  number(raw: unknown, at: string, locals?: PatternLocals): number {
    const value = this.value(raw, at, locals);
    if (typeof value !== 'number') throw new RecipeError('expr.type', at, { expected: 'number', got: typeof value });
    return value;
  }

  boolean(raw: unknown, at: string, locals?: PatternLocals): boolean {
    const value = this.value(raw, at, locals);
    if (typeof value !== 'boolean') throw new RecipeError('expr.type', at, { expected: 'boolean', got: typeof value });
    return value;
  }
}
