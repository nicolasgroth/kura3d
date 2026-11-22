/**
 * @file src/styles/themeContrast.test.ts
 * @description Verifica contraste WCAG AA (≥ 4.5:1) de los pares texto/fondo declarados en los 6 temas,
 * en claro y oscuro, leyendo las variables de `studio.css`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../utils/contrast';

interface NodeFs {
  readFileSync: (path: URL, encoding: 'utf8') => string;
}
const nodeFs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const css = nodeFs.readFileSync(new URL('./studio.css', import.meta.url), 'utf8');


function parseBlock(selector: RegExp): Record<string, string> {
  const m = selector.exec(css);
  if (!m) throw new Error(`Bloque no encontrado: ${selector}`);
  let depth = 0;
  let end = m.index + m[0].length;
  for (; end < css.length; end += 1) {
    if (css[end] === '{') depth += 1;
    if (css[end] === '}') {
      if (depth === 0) break;
      depth -= 1;
    }
  }
  const body = css.slice(m.index + m[0].length, end);
  const vars: Record<string, string> = {};
  for (const v of body.matchAll(/(--[\w-]+-(?:light|dark)):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) vars[v[1]] = v[2];
  return vars;
}

const base = parseBlock(/:root\s*\{/);
const THEMES = ['default', 'kura_prism', 'studio_pro', 'nordic_frost', 'solar_amber', 'high_contrast'] as const;

/** Mezcla `a` al `share` con `b` (equivale a color-mix(in srgb, a share%, b)). */
function mixHex(a: string, b: string, share: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.replace('#', '').slice(i * 2, i * 2 + 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) * share + ch(b, i) * (1 - share)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const TEXT = ['text-primary', 'text-secondary', 'text-muted'];
const SURFACES = ['bg-canvas', 'bg-panel', 'bg-elevated', 'bg-hover'];
const ACCENT_TEXT = ['accent-cyan', 'accent-amber', 'accent-green', 'accent-red'];
const ACCENT_FILLS: Array<[string, string]> = [
  ['accent-cyan-fg', 'accent-cyan'],
  ['accent-amber-fg', 'accent-amber'],
];

describe.each(THEMES)('contraste del tema %s', (theme) => {
  const vars = theme === 'default' ? base : { ...base, ...parseBlock(new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{`)) };
  describe.each(['light', 'dark'] as const)('modo %s', (mode) => {
    const get = (name: string) => {
      const v = vars[`--${name}-${mode}`];
      if (!v) throw new Error(`Falta --${name}-${mode}`);
      return v;
    };
    const collect = (pairs: Array<[string, string]>) =>
      pairs
        .map(([fg, bg]) => ({ fg, bg, ratio: contrastRatio(get(fg), get(bg)) }))
        .filter((p) => p.ratio < 4.5)
        .map((p) => `${p.fg} sobre ${p.bg}: ${p.ratio.toFixed(2)}`);
    const cross = (fgs: string[], bgs: string[]) => fgs.flatMap((f) => bgs.map((b): [string, string] => [f, b]));
    it('texto sobre superficies ≥ 4.5:1', () => {
      expect(collect(cross(TEXT, SURFACES))).toEqual([]);
    });
    it('acentos como texto sobre superficies ≥ 4.5:1', () => {
      expect(collect(cross(ACCENT_TEXT, SURFACES))).toEqual([]);
    });
    it('botón de herramienta activo (acento sobre 18 % de acento + elevado) ≥ 4.5:1', () => {
      const elevated = get('bg-elevated');
      const tools: Array<[string, string]> = [
        ['accent-cyan', get('accent-cyan')],
        ['accent-amber', get('accent-amber')],
        ['paint', mode === 'light' ? '#7c3aed' : '#a855f7'],
        ['erase', mode === 'light' ? '#e11d48' : '#f43f5e'],
      ];
      const out = tools
        .map(([name, accent]) => ({ name, ratio: contrastRatio(get('text-primary'), mixHex(accent, elevated, 0.18)) }))
        .filter((r) => r.ratio < 4.5)
        .map((r) => `${r.name}: ${r.ratio.toFixed(2)}`);
      expect(out).toEqual([]);
    });
    it('texto sobre relleno de acento ≥ 4.5:1', () => {
      expect(collect(ACCENT_FILLS)).toEqual([]);
      // Herramientas pintar y borrar (colores fijos en `.kura-app[data-tool]`).
      const fixed: Array<[string, string]> =
        mode === 'light' ? [['#ffffff', '#7c3aed'], ['#ffffff', '#e11d48']] : [['#14052b', '#a855f7'], ['#2b060e', '#f43f5e']];
      expect(fixed.filter(([f, b]) => contrastRatio(f, b) < 4.5)).toEqual([]);
    });
  });
});
