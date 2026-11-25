/**
 * @file src/utils/numericExpression.ts
 * @description Evaluador puro y seguro de expresiones numéricas para los campos de Kurra Studio:
 * suma, resta, multiplicación, división, paréntesis, coma o punto decimal y unidades
 * (`2cm`, `1in`) convertidas a la unidad activa. Descenso recursivo propio: no usa `eval` ni `Function`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { UnitSystem } from '../types/kura';
import { fromMm, toMm } from './units';

export type ExpressionFailure = 'empty' | 'syntax' | 'unit' | 'divZero' | 'range' | 'tooLong';

export type ExpressionResult = { ok: true; value: number } | { ok: false; reason: ExpressionFailure };

export interface ExpressionOptions {
  /** Unidad activa del campo. Con `null` el campo no es de longitud y no admite unidades. */
  unit?: UnitSystem | null;
}

const UNITS: readonly UnitSystem[] = ['mm', 'cm', 'm', 'in', 'ft'];
const MAX_LENGTH = 200;
const MAX_DEPTH = 24;

type Token =
  | { t: 'num'; v: number }
  | { t: 'unit'; v: UnitSystem }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '(' | ')' };

class ExprError extends Error {
  constructor(public reason: ExpressionFailure) {
    super(reason);
  }
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if (/[0-9.,]/.test(ch)) {
      const m = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)/.exec(text.slice(i));
      if (!m) throw new ExprError('syntax');
      tokens.push({ t: 'num', v: Number(m[0].replace(',', '.')) });
      i += m[0].length;
    } else if (/[a-zA-Z]/.test(ch)) {
      const m = /^[a-zA-Z]+/.exec(text.slice(i))!;
      const unit = UNITS.find((u) => u === m[0].toLowerCase());
      if (!unit) throw new ExprError('unit');
      tokens.push({ t: 'unit', v: unit });
      i += m[0].length;
    } else if (ch === '×') {
      tokens.push({ t: 'op', v: '*' });
      i += 1;
    } else if (ch === '÷') {
      tokens.push({ t: 'op', v: '/' });
      i += 1;
    } else if (ch === '−') {
      tokens.push({ t: 'op', v: '-' });
      i += 1;
    } else if ('+-*/()'.includes(ch)) {
      tokens.push({ t: 'op', v: ch as '+' });
      i += 1;
    } else {
      throw new ExprError('syntax');
    }
  }
  return tokens;
}

/**
 * Evalúa `text`. Los números sin unidad ya están en la unidad activa; con unidad se convierten a ella.
 * Nunca lanza: devuelve `{ ok: false, reason }` ante entradas inválidas.
 */
export function evaluateExpression(text: string, options: ExpressionOptions = {}): ExpressionResult {
  const source = text.trim();
  if (source === '') return { ok: false, reason: 'empty' };
  if (source.length > MAX_LENGTH) return { ok: false, reason: 'tooLong' };
  const active = options.unit ?? null;
  try {
    const tokens = tokenize(source);
    let pos = 0;
    const peek = () => tokens[pos];

    const applyUnit = (value: number): number => {
      const tok = peek();
      if (tok?.t !== 'unit') return value;
      pos += 1;
      if (!active) throw new ExprError('unit');
      return fromMm(toMm(value, tok.v), active);
    };

    const parseExpr = (depth: number): number => {
      if (depth > MAX_DEPTH) throw new ExprError('syntax');
      let left = parseTerm(depth);
      for (let tok = peek(); tok?.t === 'op' && (tok.v === '+' || tok.v === '-'); tok = peek()) {
        pos += 1;
        const right = parseTerm(depth);
        left = tok.v === '+' ? left + right : left - right;
      }
      return left;
    };

    const parseTerm = (depth: number): number => {
      let left = parseUnary(depth);
      for (let tok = peek(); tok?.t === 'op' && (tok.v === '*' || tok.v === '/'); tok = peek()) {
        pos += 1;
        const right = parseUnary(depth);
        if (tok.v === '/') {
          if (right === 0) throw new ExprError('divZero');
          left /= right;
        } else {
          left *= right;
        }
      }
      return left;
    };

    const parseUnary = (depth: number): number => {
      const tok = peek();
      if (tok?.t === 'op' && (tok.v === '+' || tok.v === '-')) {
        pos += 1;
        const v = parseUnary(depth + 1);
        return tok.v === '-' ? -v : v;
      }
      return parsePrimary(depth);
    };

    const parsePrimary = (depth: number): number => {
      const tok = peek();
      if (tok?.t === 'num') {
        pos += 1;
        return applyUnit(tok.v);
      }
      if (tok?.t === 'op' && tok.v === '(') {
        pos += 1;
        const inner = parseExpr(depth + 1);
        const close = peek();
        if (!(close?.t === 'op' && close.v === ')')) throw new ExprError('syntax');
        pos += 1;
        return applyUnit(inner);
      }
      throw new ExprError('syntax');
    };

    const value = parseExpr(0);
    if (pos !== tokens.length) throw new ExprError('syntax');
    if (!Number.isFinite(value)) return { ok: false, reason: 'range' };
    return { ok: true, value: Object.is(value, -0) ? 0 : value };
  } catch (err) {
    if (err instanceof ExprError) return { ok: false, reason: err.reason };
    return { ok: false, reason: 'syntax' };
  }
}

/** Unidad de longitud que corresponde a un sufijo de campo, o `null` si el campo no es de longitud. */
export function unitFromSuffix(suffix?: string): UnitSystem | null {
  return UNITS.find((u) => u === suffix) ?? null;
}
