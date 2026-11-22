/**
 * @file src/styles/reducedMotion.test.ts
 * @description Con `prefers-reduced-motion: reduce` se anulan todas las transiciones y animaciones, incluidas
 * las que mueven con `transform`, y la hoja de accesibilidad forma parte de la cascada del estudio.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';

interface NodeFs {
  readFileSync: (path: URL, encoding: 'utf8') => string;
}
const nodeFs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const css = nodeFs.readFileSync(new URL('./a11yUx.css', import.meta.url), 'utf8');

describe('Movimiento reducido', () => {
  it('anula transiciones y animaciones (también las de transform) con prefers-reduced-motion', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });

  it('las acciones de fila de la escena miden 44 px en pantallas táctiles o estrechas', () => {
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 760px\)[\s\S]*min-width: 44px;[\s\S]*min-height: 44px;/);
  });
});
