/**
 * @file src/engine/io/threeMfNumber.test.ts
 * @description El formateo rápido de coordenadas del escritor 3MF da exactamente el mismo texto que la
 * versión anterior con expresiones regulares (el formato del archivo no cambia).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { describe, expect, it } from 'vitest';
import { num } from './threeMfExport';

const reference = (n: number) => {
  const s = n.toFixed(5);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};

describe('num (coordenadas 3MF)', () => {
  it('coincide con la versión con expresiones regulares', () => {
    const cases = [0, -0, 1, -1, 10, 100, 0.5, -0.5, 1.25, 1e-6, -1e-6, 123.456789, 1e21, -2.000004, 0.000005, 99999.999999];
    let seed = 7;
    for (let i = 0; i < 2000; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      cases.push(((seed / 2147483648) - 0.5) * 10 ** ((i % 9) - 3));
    }
    for (const n of cases) expect(num(n)).toBe(reference(n));
  });
});
