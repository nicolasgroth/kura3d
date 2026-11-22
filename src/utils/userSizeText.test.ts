/**
 * @file src/utils/userSizeText.test.ts
 * @description Los avisos que muestran tamaños usan los ejes del usuario (X × Y × Z, Z = altura): un
 * cilindro Ø100 × 600 de alto se lee "100 × 100 × 600", y ningún componente arma "a × b × c" sin
 * convertir antes el tamaño interno.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { formatUserSize } from './userSizeText';

/** Archivos con un arreglo pendiente que este lote no puede tocar (otro agente trabaja ahí). */
const PENDING_ELSEWHERE = new Set<string>();

/** Fuentes de los componentes (sin pruebas), como texto. */
const SOURCES = import.meta.glob(['/src/components/**/*.{ts,tsx}', '!/src/components/**/__tests__/**'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

describe('tamaños en ejes del usuario', () => {
  it('cilindro Ø100 × 600 (alto en Y interno) se muestra 100 × 100 × 600', () => {
    expect(formatUserSize('es', [100, 600, 100])).toBe('100 × 100 × 600');
    expect(formatUserSize('en', [10, 20, 30.25], 1)).toBe('10 × 30.3 × 20');
  });

  it('todo componente que arma "a × b × c" convierte el tamaño con toUserSize/formatUserSize', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
    const offenders = Object.entries(SOURCES)
      .filter(([, text]) => /join\(' × '\)/.test(text) && !/toUserSize|formatUserSize/.test(text))
      .map(([path]) => path.replace(/^\//, ''))
      .filter((path) => !PENDING_ELSEWHERE.has(path));
    expect(offenders).toEqual([]);
  });
});
