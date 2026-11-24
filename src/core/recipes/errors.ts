/**
 * @file src/core/recipes/errors.ts
 * @description Errores tipados de recetas: código estable, ruta del campo (`steps[3].args.position[0]`), clave i18n
 * del mensaje y valores para interpolar. Ningún error de receta es un texto libre ni un cuelgue.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { TranslationKey } from '../../i18n';

/** Clave i18n de cada código (en `src/i18n/locales/recetas.ts`). Literal para que la prueba de claves sin uso la vea. */
export const RECIPE_ERROR_KEYS = {
  'format.tooLarge': 'recipe.error.format.tooLarge',
  'format.json': 'recipe.error.format.json',
  'format.depth': 'recipe.error.format.depth',
  'format.nodes': 'recipe.error.format.nodes',
  'format.forbiddenKey': 'recipe.error.format.forbiddenKey',
  'format.controlChar': 'recipe.error.format.controlChar',
  'format.notFinite': 'recipe.error.format.notFinite',
  'format.version': 'recipe.error.format.version',
  'schema.unknownField': 'recipe.error.schema.unknownField',
  'schema.invalid': 'recipe.error.schema.invalid',
  'id.duplicate': 'recipe.error.id.duplicate',
  'ref.unknownParam': 'recipe.error.ref.unknownParam',
  'ref.unknownDerive': 'recipe.error.ref.unknownDerive',
  'ref.unknownStep': 'recipe.error.ref.unknownStep',
  'ref.stepOrder': 'recipe.error.ref.stepOrder',
  'ref.unknownTable': 'recipe.error.ref.unknownTable',
  'ref.unknownAsset': 'recipe.error.ref.unknownAsset',
  'ref.unknownString': 'recipe.error.ref.unknownString',
  'ref.badPath': 'recipe.error.ref.badPath',
  'graph.cycle': 'recipe.error.graph.cycle',
  'expr.tooLong': 'recipe.error.expr.tooLong',
  'expr.syntax': 'recipe.error.expr.syntax',
  'expr.tooManyNodes': 'recipe.error.expr.tooManyNodes',
  'expr.tooDeep': 'recipe.error.expr.tooDeep',
  'expr.forbiddenNode': 'recipe.error.expr.forbiddenNode',
  'expr.forbiddenIdentifier': 'recipe.error.expr.forbiddenIdentifier',
  'expr.forbiddenFunction': 'recipe.error.expr.forbiddenFunction',
  'expr.arity': 'recipe.error.expr.arity',
  'expr.scope': 'recipe.error.expr.scope',
  'expr.budget': 'recipe.error.expr.budget',
  'expr.type': 'recipe.error.expr.type',
  'expr.notFinite': 'recipe.error.expr.notFinite',
  'expr.stringTooLong': 'recipe.error.expr.stringTooLong',
  'pattern.count': 'recipe.error.pattern.count',
  'pattern.overMax': 'recipe.error.pattern.overMax',
  'pattern.total': 'recipe.error.pattern.total',
  'asset.badData': 'recipe.error.asset.badData',
  'asset.tooLarge': 'recipe.error.asset.tooLarge',
  'asset.totalTooLarge': 'recipe.error.asset.totalTooLarge',
  'answer.unknown': 'recipe.error.answer.unknown',
  'answer.type': 'recipe.error.answer.type',
  'param.outOfRange': 'recipe.error.param.outOfRange',
  'param.notInteger': 'recipe.error.param.notInteger',
  'param.notOption': 'recipe.error.param.notOption',
  'param.textTooLong': 'recipe.error.param.textTooLong',
  'param.fileType': 'recipe.error.param.fileType',
  'param.fileTooLarge': 'recipe.error.param.fileTooLarge',
  'param.required': 'recipe.error.param.required',
  'variant.unknown': 'recipe.error.variant.unknown',
  'rule.failed': 'recipe.error.rule.failed',
  'extends.unresolved': 'recipe.error.extends.unresolved',
  // Ejecución (`src/core/recipes/run`): nada entra a la escena si aparece uno de estos.
  'run.unknownOp': 'recipe.error.run.unknownOp',
  'run.badArgs': 'recipe.error.run.badArgs',
  'run.refArity': 'recipe.error.run.refArity',
  'run.refMissing': 'recipe.error.run.refMissing',
  'run.engine': 'recipe.error.run.engine',
  'run.asset': 'recipe.error.run.asset',
  'run.file': 'recipe.error.run.file',
  'run.triangles': 'recipe.error.run.triangles',
  'run.objects': 'recipe.error.run.objects',
  'run.memory': 'recipe.error.run.memory',
  'run.timeout': 'recipe.error.run.timeout',
  'run.aborted': 'recipe.error.run.aborted',
  'run.emptyOutput': 'recipe.error.run.emptyOutput',
  'run.notReady': 'recipe.error.run.notReady',
  /** El motor rechazó lo que dio el usuario en un paso con `onError`: ruta `params[N]`, mensaje de la receta. */
  'run.input': 'recipe.error.run.input',
} as const satisfies Record<string, TranslationKey>;

export type RecipeErrorCode = keyof typeof RECIPE_ERROR_KEYS;
export type RecipeIssueParams = Record<string, string | number>;

/** Problema de una receta, listo para mostrarse con `t(key, params)`. */
export interface RecipeIssue {
  readonly code: RecipeErrorCode;
  /** Ruta del campo, estilo JS (`params[2].max`, `derive.ow`); vacía para la receta entera. */
  readonly path: string;
  readonly key: TranslationKey;
  readonly params: RecipeIssueParams;
}

export function issue(code: RecipeErrorCode, path: string, params: RecipeIssueParams = {}): RecipeIssue {
  return { code, path, key: RECIPE_ERROR_KEYS[code], params: { path, ...params } };
}

/** Error que corta una evaluación (presupuesto agotado, tipo inválido, ciclo). Lleva el mismo `RecipeIssue`. */
export class RecipeError extends Error {
  readonly issue: RecipeIssue;
  constructor(code: RecipeErrorCode, path: string, params: RecipeIssueParams = {}) {
    super(`${code} @ ${path || '(receta)'}`);
    this.name = 'RecipeError';
    this.issue = issue(code, path, params);
  }
}

/** Une una ruta base con un segmento (`a` + `b` → `a.b`, `a` + 3 → `a[3]`). */
export function joinPath(base: string, segment: string | number): string {
  if (typeof segment === 'number') return `${base}[${segment}]`;
  return base ? `${base}.${segment}` : segment;
}
