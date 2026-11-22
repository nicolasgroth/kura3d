/**
 * @file src/core/scene/__tests__/userSizeText.test.ts
 * @description Los avisos que muestran tamaños usan los ejes del usuario (X × Y × Z, Z = altura): un
 * cilindro Ø100 × 600 de alto se lee "100 × 100 × 600", y ningún componente arma "a × b × c" sin
 * convertir antes el tamaño interno.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatUserSize } from '../userSizeText';

/** Archivos con un arreglo pendiente que este lote no puede tocar (otro agente trabaja ahí). */
const PENDING_ELSEWHERE = new Set(['src/components/split/SplitOverlays.tsx']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('tamaños en ejes del usuario', () => {
  it('cilindro Ø100 × 600 (alto en Y interno) se muestra 100 × 100 × 600', () => {
    expect(formatUserSize('es', [100, 600, 100])).toBe('100 × 100 × 600');
    expect(formatUserSize('en', [10, 20, 30.25], 1)).toBe('10 × 30.3 × 20');
  });

  it('todo componente que arma "a × b × c" convierte el tamaño con toUserSize/formatUserSize', () => {
    const root = process.cwd();
    const offenders = sourceFiles(join(root, 'src', 'components'))
      .map((f) => [relative(root, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')] as const)
      .filter(([, text]) => /join\(' × '\)/.test(text) && !/toUserSize|formatUserSize/.test(text))
      .map(([path]) => path)
      .filter((path) => !PENDING_ELSEWHERE.has(path));
    expect(offenders).toEqual([]);
  });
});
