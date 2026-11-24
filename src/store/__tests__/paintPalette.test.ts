/**
 * @file src/store/__tests__/paintPalette.test.ts
 * @description Reglas de la paleta de pintura: paletas predefinidas, cambiar, agregar y quitar muestras, colores
 * del proyecto (por cantidad de caras, sin tope pequeño) y lectura tolerante de lo guardado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { fakeBox } from '../../test/fakeObjects';
import {
  addColor,
  applyPreset,
  DEFAULT_PALETTE,
  normalizeHex,
  PALETTE_MAX,
  PALETTE_PRESET_IDS,
  PALETTE_PRESETS,
  parsePalette,
  projectPaintColors,
  removeColorAt,
  replaceColor,
} from '../paintPalette';

describe('paleta de pintura', () => {
  it('trae al menos cinco paletas predefinidas, todas válidas y sin repetidos', () => {
    expect(PALETTE_PRESET_IDS).toEqual(['original', 'vivid', 'sober', 'pastel', 'grays']);
    for (const id of PALETTE_PRESET_IDS) {
      const colors = PALETTE_PRESETS[id];
      expect(colors.every((c) => normalizeHex(c) === c)).toBe(true);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it('cambia, agrega y quita muestras; nunca queda vacía ni con repetidos', () => {
    let p = applyPreset('grays');
    p = replaceColor(p, 0, '#FF0000');
    expect(p.colors[0]).toBe('#ff0000');
    expect(p.preset).toBe('custom');
    expect(replaceColor(p, 1, '#ff0000')).toBe(p);
    p = addColor(p, '#123');
    expect(p.colors.at(-1)).toBe('#112233');
    expect(addColor(p, '#112233')).toBe(p);
    let one = { preset: 'custom' as const, colors: ['#000000'] };
    one = removeColorAt(one, 0);
    expect(one.colors).toEqual(['#000000']);
  });

  it('lee lo guardado con tolerancia: datos rotos vuelven a la original', () => {
    expect(parsePalette(null)).toEqual(DEFAULT_PALETTE);
    expect(parsePalette('{roto')).toEqual(DEFAULT_PALETTE);
    expect(parsePalette(JSON.stringify({ preset: 'x', colors: ['no', '#ABCDEF'] }))).toEqual({ preset: 'custom', colors: ['#abcdef'] });
  });

  it('colores del proyecto: por cantidad de caras y con muchos colores (sin tope de 8–10)', () => {
    const a = fakeBox('a', 'A');
    const triangles = 600;
    const many = Array.from({ length: triangles }, (_, i) => `#${(i * 997).toString(16).padStart(6, '0').slice(-6)}`);
    const painted = { ...a, mesh: { ...a.mesh, faceColors: many.map((c, i) => (i % 2 === 0 ? '#ff0000' : c)) } };
    const colors = projectPaintColors([painted]);
    expect(colors[0]).toBe('#ff0000');
    expect(colors.length).toBeGreaterThan(1);
    expect(colors.length).toBeLessThanOrEqual(PALETTE_MAX);
    expect(PALETTE_MAX).toBeGreaterThanOrEqual(200);
  });
});
