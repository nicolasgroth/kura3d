/**
 * @file src/core/recipes/expression/compile.ts
 * @description Lectura y análisis estático de expresiones de recetas (`"=p.w + 2*p.wall"`). `jsep` solo produce el
 * AST, con su tabla de operadores reducida a la lista blanca; luego se recorre el árbol y se rechaza todo nodo,
 * identificador, función o acceso a miembro que no esté permitido, con topes de largo, nodos y profundidad.
 * Nunca se usa `eval` ni `new Function`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import jsep from 'jsep';
import { RecipeError } from '../errors';
import { EXPRESSION_LIMITS } from '../limits';
import { BINARY_OPERATORS, CONSTANTS, UNARY_OPERATORS, arityOf, isFunctionName } from './functions';
import { isSafeName } from '../names';

/** Espacios de nombres de solo lectura que una expresión puede leer. */
export type ExprRoot = 'p' | 'd' | 's' | 'bed';
/** Variables de un patrón (`pattern`). */
export type ExprLocal = 'i' | 'n' | 'x' | 'y' | 'z';

export const EXPR_ROOTS: readonly ExprRoot[] = ['p', 'd', 's', 'bed'];
export const EXPR_LOCALS: readonly ExprLocal[] = ['i', 'n', 'x', 'y', 'z'];

/** Qué puede leer una expresión según dónde está escrita. */
export interface ExprScope {
  readonly roots: ReadonlySet<ExprRoot>;
  readonly locals: ReadonlySet<ExprLocal>;
}

/** Nodo del AST ya validado (subconjunto cerrado de `jsep`). */
export type ExprNode =
  | { readonly type: 'lit'; readonly value: number | boolean | string }
  | { readonly type: 'local'; readonly name: ExprLocal }
  | { readonly type: 'const'; readonly name: string }
  | { readonly type: 'path'; readonly path: readonly string[] }
  | { readonly type: 'unary'; readonly op: string; readonly arg: ExprNode }
  | { readonly type: 'binary'; readonly op: string; readonly left: ExprNode; readonly right: ExprNode }
  | { readonly type: 'cond'; readonly test: ExprNode; readonly then: ExprNode; readonly else: ExprNode }
  | { readonly type: 'call'; readonly name: string; readonly args: readonly ExprNode[] };

export interface CompiledExpr {
  readonly source: string;
  readonly root: ExprNode;
  /** Rutas leídas (`['p','w']`, `['s','outer','size','x']`), sin repetir. */
  readonly paths: readonly (readonly string[])[];
  /** Tablas nombradas en `lookup('tabla', …)`. */
  readonly tables: readonly string[];
  readonly nodeCount: number;
}

let configured = false;

/** Reduce la tabla global de `jsep` a la lista blanca. Kurra Studio no usa `jsep` en otro lugar. */
function configureJsep(): void {
  if (configured) return;
  jsep.removeAllBinaryOps();
  for (const [op, precedence] of Object.entries(BINARY_OPERATORS)) jsep.addBinaryOp(op, precedence);
  jsep.removeAllUnaryOps();
  for (const op of UNARY_OPERATORS) jsep.addUnaryOp(op);
  jsep.removeAllLiterals();
  jsep.addLiteral('true', true);
  jsep.addLiteral('false', false);
  configured = true;
}

export function isExpression(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('=');
}

interface Walk {
  readonly path: string;
  readonly scope: ExprScope;
  nodes: number;
  readonly paths: Map<string, readonly string[]>;
  readonly tables: Set<string>;
}

function fail(walk: Walk, code: 'expr.forbiddenNode' | 'expr.forbiddenIdentifier' | 'expr.forbiddenFunction' | 'expr.arity' | 'expr.scope' | 'ref.badPath' | 'expr.stringTooLong', detail: string): never {
  throw new RecipeError(code, walk.path, { detail });
}

/** `p.board.size.x` → `['p','board','size','x']`; cualquier otra forma (índice calculado, llamada, `this`) se rechaza. */
function memberPath(node: jsep.Expression, walk: Walk): string[] {
  if (node.type === 'Identifier') return [(node as jsep.Identifier).name];
  if (node.type !== 'MemberExpression') fail(walk, 'expr.forbiddenNode', node.type);
  const member = node as jsep.MemberExpression;
  if (member.computed || member.optional || member.property.type !== 'Identifier') fail(walk, 'expr.forbiddenNode', 'computed-member');
  const name = (member.property as jsep.Identifier).name;
  if (!isSafeName(name)) fail(walk, 'expr.forbiddenIdentifier', name);
  return [...memberPath(member.object, walk), name];
}

function convert(node: jsep.Expression, walk: Walk, depth: number): ExprNode {
  walk.nodes += 1;
  if (walk.nodes > EXPRESSION_LIMITS.maxNodes) throw new RecipeError('expr.tooManyNodes', walk.path, { max: EXPRESSION_LIMITS.maxNodes });
  if (depth > EXPRESSION_LIMITS.maxDepth) throw new RecipeError('expr.tooDeep', walk.path, { max: EXPRESSION_LIMITS.maxDepth });
  switch (node.type) {
    case 'Literal': {
      const value = (node as jsep.Literal).value;
      if (typeof value === 'string') {
        if (value.length > EXPRESSION_LIMITS.maxStringLength) fail(walk, 'expr.stringTooLong', String(EXPRESSION_LIMITS.maxStringLength));
        return { type: 'lit', value };
      }
      if (typeof value === 'number' && Number.isFinite(value)) return { type: 'lit', value };
      if (typeof value === 'boolean') return { type: 'lit', value };
      return fail(walk, 'expr.forbiddenNode', 'literal');
    }
    case 'Identifier': {
      const name = (node as jsep.Identifier).name;
      if ((EXPR_LOCALS as readonly string[]).includes(name)) {
        if (!walk.scope.locals.has(name as ExprLocal)) fail(walk, 'expr.scope', name);
        return { type: 'local', name: name as ExprLocal };
      }
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) return { type: 'const', name };
      return fail(walk, 'expr.forbiddenIdentifier', name);
    }
    case 'MemberExpression': {
      const path = memberPath(node, walk);
      walk.nodes += path.length - 1;
      const root = path[0];
      if (!(EXPR_ROOTS as readonly string[]).includes(root)) fail(walk, 'expr.forbiddenIdentifier', root);
      if (!walk.scope.roots.has(root as ExprRoot)) fail(walk, 'expr.scope', root);
      if (path.length > 4) fail(walk, 'ref.badPath', path.join('.'));
      walk.paths.set(path.join('.'), path);
      return { type: 'path', path };
    }
    case 'UnaryExpression': {
      const unary = node as jsep.UnaryExpression;
      if (!UNARY_OPERATORS.has(unary.operator)) fail(walk, 'expr.forbiddenNode', unary.operator);
      return { type: 'unary', op: unary.operator, arg: convert(unary.argument, walk, depth + 1) };
    }
    case 'BinaryExpression': {
      const binary = node as jsep.BinaryExpression;
      if (!Object.prototype.hasOwnProperty.call(BINARY_OPERATORS, binary.operator)) fail(walk, 'expr.forbiddenNode', binary.operator);
      return { type: 'binary', op: binary.operator, left: convert(binary.left, walk, depth + 1), right: convert(binary.right, walk, depth + 1) };
    }
    case 'ConditionalExpression': {
      const cond = node as jsep.ConditionalExpression;
      return {
        type: 'cond',
        test: convert(cond.test, walk, depth + 1),
        then: convert(cond.consequent, walk, depth + 1),
        else: convert(cond.alternate, walk, depth + 1),
      };
    }
    case 'CallExpression': {
      const call = node as jsep.CallExpression;
      if (call.callee.type !== 'Identifier') fail(walk, 'expr.forbiddenNode', 'method-call');
      const name = (call.callee as jsep.Identifier).name;
      if (!isFunctionName(name)) fail(walk, 'expr.forbiddenFunction', name);
      const arity = arityOf(name);
      if (call.arguments.length < arity.minArgs || call.arguments.length > arity.maxArgs) fail(walk, 'expr.arity', name);
      if (name === 'has') {
        const arg = call.arguments[0];
        if (arg.type !== 'MemberExpression') fail(walk, 'expr.forbiddenNode', 'has');
      }
      if (name === 'lookup') {
        const table = call.arguments[0];
        if (table.type !== 'Literal' || typeof (table as jsep.Literal).value !== 'string') fail(walk, 'expr.forbiddenNode', 'lookup');
        walk.tables.add((table as jsep.Literal).value as string);
      }
      return { type: 'call', name, args: call.arguments.map((arg) => convert(arg, walk, depth + 1)) };
    }
    default:
      // Compound, SequenceExpression, ArrayExpression, ThisExpression y cualquier nodo de un plugin.
      return fail(walk, 'expr.forbiddenNode', node.type);
  }
}

/**
 * Lee y valida una expresión (con su `=` inicial). Lanza `RecipeError` con `path` si excede un tope, no se puede leer
 * o usa algo fuera de la lista blanca o del alcance del lugar donde está escrita.
 */
export function compileExpression(source: string, path: string, scope: ExprScope): CompiledExpr {
  if (!isExpression(source)) throw new RecipeError('expr.syntax', path, { detail: 'missing =' });
  if (source.length > EXPRESSION_LIMITS.maxLength) throw new RecipeError('expr.tooLong', path, { max: EXPRESSION_LIMITS.maxLength });
  configureJsep();
  let ast: jsep.Expression;
  try {
    ast = jsep(source.slice(1));
  } catch (error) {
    throw new RecipeError('expr.syntax', path, { detail: error instanceof Error ? error.message.slice(0, 120) : 'parse' });
  }
  const walk: Walk = { path, scope, nodes: 0, paths: new Map(), tables: new Set() };
  const root = convert(ast, walk, 1);
  return { source, root, paths: [...walk.paths.values()], tables: [...walk.tables], nodeCount: walk.nodes };
}
