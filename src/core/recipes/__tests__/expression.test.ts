/**
 * @file src/core/recipes/__tests__/expression.test.ts
 * @description Pruebas del lenguaje de expresiones de recetas: aritmética tipada, funciones en grados, cortocircuito,
 * lista blanca (sin miembros arbitrarios, métodos, `this`, prototipos) y presupuesto de largo, nodos, profundidad y
 * evaluaciones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { compileExpression, type ExprScope } from '../expression/compile';
import { createBudget, evaluateExpression, type ExprEnv, type ExprValue } from '../expression/evaluate';
import { RecipeError, type RecipeErrorCode } from '../errors';
import { EXPRESSION_LIMITS } from '../limits';

const ALL: ExprScope = { roots: new Set(['p', 'd', 's', 'bed']), locals: new Set(['i', 'n', 'x', 'y', 'z']) };
const PARAMS_ONLY: ExprScope = { roots: new Set(['p']), locals: new Set() };

const VALUES: Record<string, ExprValue> = { 'p.w': 80, 'p.dp': 60, 'p.fix': 'screw', 'p.vents': true, 'p.text': 'Kura', 'd.pr': 4 };

function env(overrides: Partial<ExprEnv> = {}): ExprEnv {
  return {
    budget: createBudget(),
    locals: { i: 2, n: 4, x: 1.5, y: -2, z: 0 },
    read: (path, at) => {
      const key = path.join('.');
      if (!(key in VALUES)) throw new RecipeError('ref.unknownParam', at, { detail: key });
      return VALUES[key];
    },
    has: (path) => path.join('.') in VALUES,
    lookup: (table, key) => (table === 'm' && key === 3 ? 0.5 : 0),
    ...overrides,
  };
}

function run(source: string, scope: ExprScope = ALL, e: ExprEnv = env()): ExprValue {
  return evaluateExpression(compileExpression(source, 'f', scope), e, 'f');
}

function codeOf(fn: () => unknown): RecipeErrorCode | 'ok' {
  try {
    fn();
    return 'ok';
  } catch (error) {
    if (error instanceof RecipeError) return error.issue.code;
    throw error;
  }
}

describe('expresiones: ruta feliz', () => {
  it('aritmética, precedencia y lectura de parámetros', () => {
    expect(run('=p.w + 2*3')).toBe(86);
    expect(run('=(p.w - 2*d.pr) / 2')).toBe(36);
    expect(run('=-p.dp % 7')).toBe(-4);
    expect(run('=min(p.w, p.dp)/4')).toBe(15);
  });

  it('comparación, lógica, ternario e if', () => {
    expect(run("=p.fix == 'screw' ? p.w : 0")).toBe(80);
    expect(run("=p.fix != 'screw' && p.vents")).toBe(false);
    expect(run('=!p.vents || p.w > 10')).toBe(true);
    expect(run('=if(p.w >= 80, 1, 2)')).toBe(1);
  });

  it('funciones en grados y clamp', () => {
    expect(run('=sin(90)')).toBe(1);
    expect(run('=cos(90)')).toBe(0);
    expect(run('=atan2(1, 1)')).toBeCloseTo(45, 12);
    expect(run('=clamp(floor((p.w - 20) / 5), 0, 10)')).toBe(10);
    expect(run('=round(2.5) + ceil(0.1) + abs(-1) + sqrt(16) + pow(2, 3)')).toBe(3 + 1 + 1 + 4 + 8);
    expect(run('=pi')).toBeCloseTo(Math.PI, 15);
  });

  it('texto, len, has, lookup y variables de patrón', () => {
    expect(run('=len(p.text)')).toBe(4);
    expect(run("=p.text + '!'")).toBe('Kura!');
    expect(run("=len(trim('  a b  '))")).toBe(3);
    expect(run("=trim('   ') == ''")).toBe(true);
    expect(() => run('=trim(3)')).toThrow();
    expect(run('=has(p.logo)')).toBe(false);
    expect(run("=lookup('m', 3)")).toBe(0.5);
    expect(run('=x + y + i*n')).toBe(7.5);
  });

  it('cortocircuito: la rama no elegida no se evalúa (ni sus errores)', () => {
    expect(run("=false && p.missing > 1")).toBe(false);
    expect(run('=true ? 1 : p.missing')).toBe(1);
    expect(run('=if(true, 1, 1/0)')).toBe(1);
  });
});

describe('expresiones: lista blanca', () => {
  const rejected: Array<[string, RecipeErrorCode]> = [
    ['=p.constructor', 'expr.forbiddenIdentifier'],
    ['=p.__proto__', 'expr.forbiddenIdentifier'],
    ['=p.w.prototype', 'expr.forbiddenIdentifier'],
    ["=p['w']", 'expr.forbiddenNode'],
    ['=p[0]', 'expr.forbiddenNode'],
    ['=this', 'expr.forbiddenNode'],
    ['=this.w', 'expr.forbiddenNode'],
    ['=constructor', 'expr.forbiddenIdentifier'],
    ['=Math.max(1, 2)', 'expr.forbiddenNode'],
    ['=p.text.toString()', 'expr.forbiddenNode'],
    ['=eval(1)', 'expr.forbiddenFunction'],
    ['=Function(1)', 'expr.forbiddenFunction'],
    ['=toString(1)', 'expr.forbiddenFunction'],
    ['=hasOwnProperty(1)', 'expr.forbiddenFunction'],
    ['=globalThis', 'expr.forbiddenIdentifier'],
    ['=window', 'expr.forbiddenIdentifier'],
    ['=[1, 2]', 'expr.forbiddenNode'],
    ['=(1, 2)', 'expr.forbiddenNode'],
    ['=1; 2', 'expr.forbiddenNode'],
    ['=p.w = 3', 'expr.syntax'],
    ['=1 | 2', 'expr.syntax'],
    ['=1 ** 2', 'expr.syntax'],
    ['=~1', 'expr.syntax'],
    ['=typeof p', 'expr.forbiddenNode'],
    ['=null', 'expr.forbiddenIdentifier'],
    ['=/a/', 'expr.syntax'],
    ['=min()', 'expr.arity'],
    ['=clamp(1, 2)', 'expr.arity'],
    ['=has(1)', 'expr.forbiddenNode'],
    ['=lookup(p.text, 1)', 'expr.forbiddenNode'],
    ['=q.w', 'expr.forbiddenIdentifier'],
    ['=s.a.b.c.d', 'ref.badPath'],
    ['=p.w +', 'expr.syntax'],
    ['p.w', 'expr.syntax'],
  ];
  it.each(rejected)('%s → %s', (source, code) => {
    expect(codeOf(() => compileExpression(source, 'f', ALL))).toBe(code);
  });

  it('alcance: un parámetro no puede leer derivados, pasos ni variables de patrón', () => {
    expect(codeOf(() => compileExpression('=d.ow', 'f', PARAMS_ONLY))).toBe('expr.scope');
    expect(codeOf(() => compileExpression('=s.outer.size.x', 'f', PARAMS_ONLY))).toBe('expr.scope');
    expect(codeOf(() => compileExpression('=x + 1', 'f', PARAMS_ONLY))).toBe('expr.scope');
  });

  it('tipos: sin coerciones de JavaScript', () => {
    expect(codeOf(() => run("=p.w + 'mm'"))).toBe('expr.type');
    expect(codeOf(() => run('=p.vents + 1'))).toBe('expr.type');
    expect(codeOf(() => run('=!p.w'))).toBe('expr.type');
    expect(codeOf(() => run('=p.w && true'))).toBe('expr.type');
    expect(codeOf(() => run('=if(1, 2, 3)'))).toBe('expr.type');
    expect(run("=p.w == '80'")).toBe(false);
  });

  it('números no finitos abortan con error tipado', () => {
    expect(codeOf(() => run('=1/0'))).toBe('expr.notFinite');
    expect(codeOf(() => run('=sqrt(-1)'))).toBe('expr.notFinite');
    expect(codeOf(() => run('=pow(10, 400)'))).toBe('expr.notFinite');
    expect(codeOf(() => run('=0 % 0'))).toBe('expr.notFinite');
    expect(codeOf(() => compileExpression('=1e400', 'f', ALL))).toBe('expr.forbiddenNode');
  });
});

describe('expresiones: presupuesto', () => {
  it('rechaza expresiones más largas que el tope sin leerlas', () => {
    const long = '=' + '1+'.repeat(EXPRESSION_LIMITS.maxLength) + '1';
    expect(codeOf(() => compileExpression(long, 'f', ALL))).toBe('expr.tooLong');
  });

  it('rechaza demasiados nodos', () => {
    // Árbol ancho y poco profundo: min() de 16 grupos de 10 sumandos (≈ 305 nodos, profundidad 11).
    const group = '(' + Array.from({ length: 10 }, () => '1').join('+') + ')';
    const many = '=min(' + Array.from({ length: 16 }, () => group).join(',') + ')';
    expect(many.length).toBeLessThanOrEqual(EXPRESSION_LIMITS.maxLength);
    expect(codeOf(() => compileExpression(many, 'f', ALL))).toBe('expr.tooManyNodes');
  });

  it('rechaza anidamiento más profundo que el tope y acepta el tope justo', () => {
    const nest = (depth: number) => '=' + '-'.repeat(depth - 1) + '1';
    expect(codeOf(() => compileExpression(nest(EXPRESSION_LIMITS.maxDepth), 'f', ALL))).toBe('ok');
    expect(codeOf(() => compileExpression(nest(EXPRESSION_LIMITS.maxDepth + 1), 'f', ALL))).toBe('expr.tooDeep');
    const parens = '=' + '('.repeat(250) + '1' + ')'.repeat(250);
    expect(['expr.tooDeep', 'ok']).toContain(codeOf(() => compileExpression(parens, 'f', ALL)));
  });

  it('el contador de evaluaciones aborta (error tipado, no cuelgue)', () => {
    const compiled = compileExpression('=p.w + p.w + p.w + p.w', 'f', ALL);
    const e = env({ budget: createBudget(20) });
    expect(codeOf(() => {
      for (let k = 0; k < 10; k++) evaluateExpression(compiled, e, 'f');
    })).toBe('expr.budget');
    expect(e.budget.used).toBeLessThanOrEqual(21);
  });

  it('textos: literal y concatenación acotados', () => {
    const big = "='" + 'a'.repeat(EXPRESSION_LIMITS.maxStringLength + 1) + "'";
    expect(codeOf(() => compileExpression(big, 'f', ALL))).toBe('expr.stringTooLong');
    const half = "'" + 'a'.repeat(150) + "'";
    expect(codeOf(() => run(`=${half} + ${half}`))).toBe('expr.stringTooLong');
  });
});
