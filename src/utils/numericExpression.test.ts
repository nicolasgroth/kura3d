/**
 * @file src/utils/numericExpression.test.ts
 * @description Pruebas del evaluador seguro de expresiones numéricas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { evaluateExpression, unitFromSuffix } from './numericExpression';

const val = (s: string, unit: 'mm' | 'cm' | 'in' | null = 'mm') => {
  const r = evaluateExpression(s, { unit });
  return r.ok ? r.value : r.reason;
};

describe('evaluateExpression', () => {
  it('opera con precedencia y paréntesis', () => {
    expect(val('10+5')).toBe(15);
    expect(val('20/2')).toBe(10);
    expect(val('2*3+4')).toBe(10);
    expect(val('2*(3+4)')).toBe(14);
    expect(val('-(2+3)*2')).toBe(-10);
    expect(val('10-2-3')).toBe(5);
  });

  it('acepta coma o punto decimal', () => {
    expect(val('1,5+1.5')).toBe(3);
    expect(val(',5')).toBe(0.5);
  });

  it('convierte unidades a la activa', () => {
    expect(val('2cm')).toBe(20);
    expect(val('1in')).toBeCloseTo(25.4);
    expect(val('25.4mm', 'in')).toBeCloseTo(1);
    expect(val('1cm+5')).toBe(15);
    expect(val('(1+1)cm')).toBe(20);
    expect(val('2CM')).toBe(20);
  });

  it('rechaza unidades en campos que no son de longitud', () => {
    expect(val('2cm', null)).toBe('unit');
    expect(val('2+3', null)).toBe(5);
  });

  it('marca como inválido lo que no es expresión', () => {
    expect(val('abc')).toBe('unit');
    expect(val('')).toBe('empty');
    expect(val('10+')).toBe('syntax');
    expect(val('(1+2')).toBe('syntax');
    expect(val('1 2')).toBe('syntax');
    expect(val('1;2')).toBe('syntax');
    expect(val('1/0')).toBe('divZero');
    expect(val('2xyz')).toBe('unit');
  });

  it('no ejecuta código', () => {
    expect(val('process.exit()')).not.toBeTypeOf('number');
    expect(val('alert(1)')).not.toBeTypeOf('number');
    expect(val('1'.repeat(300))).toBe('tooLong');
    expect(val('('.repeat(50) + '1' + ')'.repeat(50))).toBe('syntax');
  });

  it('unitFromSuffix', () => {
    expect(unitFromSuffix('mm')).toBe('mm');
    expect(unitFromSuffix('°')).toBeNull();
    expect(unitFromSuffix(undefined)).toBeNull();
  });
});
