/**
 * @file src/core/scene/__tests__/plateArrangePack.test.ts
 * @description Empaquetado rectangular MaxRects de «Repartir en placas»: sin solapes, dentro del contenedor,
 * obstáculos respetados, rectángulo que no cabe y determinismo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { MaxRectsBin, type PackedRect } from '../plateArrangePack';

const overlap = (a: PackedRect, b: PackedRect) => a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.z < b.z + b.d - 1e-9 && b.z < a.z + a.d - 1e-9;

describe('MaxRectsBin', () => {
  it('coloca rectángulos sin solaparse y dentro del contenedor', () => {
    const bin = new MaxRectsBin(100, 80);
    const placed: PackedRect[] = [];
    for (const [w, d] of [[40, 30], [60, 50], [30, 30], [20, 70], [10, 10], [35, 25]]) {
      const at = bin.insert(w, d);
      if (at) placed.push({ ...at, w, d });
    }
    expect(placed.length).toBeGreaterThanOrEqual(4);
    for (const r of placed) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.z).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(100 + 1e-9);
      expect(r.z + r.d).toBeLessThanOrEqual(80 + 1e-9);
    }
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlap(placed[i], placed[j])).toBe(false);
  });

  it('llena exacto cuatro cuartos', () => {
    const bin = new MaxRectsBin(100, 100);
    for (let i = 0; i < 4; i++) expect(bin.insert(50, 50)).not.toBeNull();
    expect(bin.insert(1, 1)).toBeNull();
  });

  it('rechaza lo que no cabe y no ocupa nada al rechazar', () => {
    const bin = new MaxRectsBin(50, 50);
    expect(bin.insert(51, 10)).toBeNull();
    expect(bin.insert(50, 50)).toEqual({ x: 0, z: 0 });
  });

  it('evita obstáculos', () => {
    const bin = new MaxRectsBin(100, 100);
    bin.occupy({ x: 0, z: 0, w: 60, d: 100 });
    const at = bin.insert(40, 40)!;
    expect(at.x).toBeGreaterThanOrEqual(60);
    expect(bin.insert(41, 10)).toBeNull();
  });

  it('es determinista', () => {
    const run = () => {
      const bin = new MaxRectsBin(200, 200);
      return [[30, 70], [70, 30], [50, 50], [20, 20], [90, 10]].map(([w, d]) => bin.insert(w, d));
    };
    expect(run()).toEqual(run());
  });
});
