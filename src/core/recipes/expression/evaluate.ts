/**
 * @file src/core/recipes/expression/evaluate.ts
 * @description Intérprete propio de expresiones de recetas sobre el AST ya validado por `compile.ts`. Tipado
 * (número, booleano, texto), sin coerciones de JavaScript, con cortocircuito en `&&`, `||`, ternario e `if`, y un
 * contador de nodos evaluados compartido por toda la resolución que aborta con error tipado al agotarse.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { RecipeError } from '../errors';
import { EXPRESSION_LIMITS } from '../limits';
import type { CompiledExpr, ExprLocal, ExprNode } from './compile';
import { CONSTANTS, NUMERIC_FUNCTIONS } from './functions';

export type ExprValue = number | boolean | string;

/** Contador compartido de nodos evaluados (uno por resolución de receta). */
export interface EvalBudget {
  used: number;
  readonly max: number;
}

export function createBudget(max: number = EXPRESSION_LIMITS.maxEvaluations): EvalBudget {
  return { used: 0, max };
}

/** Lo que una expresión puede leer. Cada lectura fuera de lo declarado lanza `RecipeError`. */
export interface ExprEnv {
  readonly budget: EvalBudget;
  readonly locals?: Readonly<Partial<Record<ExprLocal, number>>>;
  read(path: readonly string[], at: string): ExprValue;
  has(path: readonly string[], at: string): boolean;
  lookup(table: string, key: ExprValue, at: string): ExprValue;
}

function typeOf(value: ExprValue): string {
  return typeof value;
}

function typeError(at: string, expected: string, got: ExprValue): never {
  throw new RecipeError('expr.type', at, { expected, got: typeOf(got) });
}

function num(value: ExprValue, at: string): number {
  if (typeof value !== 'number') typeError(at, 'number', value);
  return value;
}

function bool(value: ExprValue, at: string): boolean {
  if (typeof value !== 'boolean') typeError(at, 'boolean', value);
  return value;
}

function finite(value: number, at: string): number {
  if (!Number.isFinite(value)) throw new RecipeError('expr.notFinite', at);
  return value;
}

function binary(op: string, left: ExprValue, right: ExprValue, at: string): ExprValue {
  switch (op) {
    case '==':
      return typeof left === typeof right && left === right;
    case '!=':
      return !(typeof left === typeof right && left === right);
    case '+':
      if (typeof left === 'string' && typeof right === 'string') {
        const text = left + right;
        if (text.length > EXPRESSION_LIMITS.maxStringLength) throw new RecipeError('expr.stringTooLong', at, { detail: String(EXPRESSION_LIMITS.maxStringLength) });
        return text;
      }
      return finite(num(left, at) + num(right, at), at);
    case '-':
      return finite(num(left, at) - num(right, at), at);
    case '*':
      return finite(num(left, at) * num(right, at), at);
    case '/':
      return finite(num(left, at) / num(right, at), at);
    case '%':
      return finite(num(left, at) % num(right, at), at);
    case '<':
      return num(left, at) < num(right, at);
    case '>':
      return num(left, at) > num(right, at);
    case '<=':
      return num(left, at) <= num(right, at);
    case '>=':
      return num(left, at) >= num(right, at);
    default:
      throw new RecipeError('expr.forbiddenNode', at, { detail: op });
  }
}

function evalNode(node: ExprNode, env: ExprEnv, at: string): ExprValue {
  env.budget.used += 1;
  if (env.budget.used > env.budget.max) throw new RecipeError('expr.budget', at, { max: env.budget.max });
  switch (node.type) {
    case 'lit':
      return node.value;
    case 'const':
      return CONSTANTS[node.name];
    case 'local': {
      const value = env.locals?.[node.name];
      if (value === undefined) throw new RecipeError('expr.scope', at, { detail: node.name });
      return value;
    }
    case 'path':
      return env.read(node.path, at);
    case 'unary': {
      const value = evalNode(node.arg, env, at);
      if (node.op === '!') return !bool(value, at);
      if (node.op === '-') return finite(-num(value, at), at);
      return num(value, at);
    }
    case 'binary': {
      if (node.op === '&&') return bool(evalNode(node.left, env, at), at) ? bool(evalNode(node.right, env, at), at) : false;
      if (node.op === '||') return bool(evalNode(node.left, env, at), at) ? true : bool(evalNode(node.right, env, at), at);
      return binary(node.op, evalNode(node.left, env, at), evalNode(node.right, env, at), at);
    }
    case 'cond':
      return bool(evalNode(node.test, env, at), at) ? evalNode(node.then, env, at) : evalNode(node.else, env, at);
    case 'call':
      return evalCall(node.name, node.args, env, at);
  }
}

function evalCall(name: string, args: readonly ExprNode[], env: ExprEnv, at: string): ExprValue {
  switch (name) {
    case 'if':
      return bool(evalNode(args[0], env, at), at) ? evalNode(args[1], env, at) : evalNode(args[2], env, at);
    case 'has': {
      const target = args[0];
      if (target.type !== 'path') throw new RecipeError('expr.forbiddenNode', at, { detail: 'has' });
      return env.has(target.path, at);
    }
    case 'len': {
      const value = evalNode(args[0], env, at);
      if (typeof value !== 'string') typeError(at, 'string', value);
      return value.length;
    }
    case 'trim': {
      const value = evalNode(args[0], env, at);
      if (typeof value !== 'string') typeError(at, 'string', value);
      return value.trim();
    }
    case 'lookup': {
      const table = args[0];
      if (table.type !== 'lit' || typeof table.value !== 'string') throw new RecipeError('expr.forbiddenNode', at, { detail: 'lookup' });
      return env.lookup(table.value, evalNode(args[1], env, at), at);
    }
    default: {
      const fn = NUMERIC_FUNCTIONS[name];
      if (!fn) throw new RecipeError('expr.forbiddenFunction', at, { detail: name });
      const values = args.map((arg) => num(evalNode(arg, env, at), at));
      return finite(fn.apply(values), at);
    }
  }
}

/** Evalúa una expresión compilada. Lanza `RecipeError` ante tipos inválidos, valores no finitos o presupuesto agotado. */
export function evaluateExpression(compiled: CompiledExpr, env: ExprEnv, at: string): ExprValue {
  const value = evalNode(compiled.root, env, at);
  if (typeof value === 'number') return finite(value === 0 ? 0 : value, at);
  return value;
}
