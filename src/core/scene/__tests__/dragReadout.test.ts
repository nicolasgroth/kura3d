/**
 * @file src/core/scene/__tests__/dragReadout.test.ts
 * @description Lectura del arrastre en ejes del usuario: mover 10 mm hacia el fondo es ΔY +10; girar en
 * torno a la vertical es giro en Z; escalar la altura es % en Z.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { dragReadout, type TransformSample } from '../dragReadout';

const base: TransformSample = { position: [0, 10, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };

describe('lectura del arrastre del gizmo', () => {
  it('mover: interno −Z es +Y del usuario; interno +Y es +Z', () => {
    const r = dragReadout('translate', base, { ...base, position: [5, 30, -10] });
    expect(r).toEqual({ kind: 'move', deltaMm: [5, 10, 20] });
  });

  it('rotar en torno a la vertical interna (Y) se lee como giro en Z del usuario', () => {
    const r = dragReadout('rotate', base, { ...base, rotation: [0, Math.PI / 4, 0] });
    expect(r.kind).toBe('rotate');
    if (r.kind !== 'rotate') return;
    expect(r.axis).toBe('Z');
    expect(r.deg).toBeCloseTo(45);
  });

  it('rotar en torno a Z interno se lee como giro en Y del usuario con el signo invertido', () => {
    const r = dragReadout('rotate', base, { ...base, rotation: [0, 0, Math.PI / 6] });
    if (r.kind !== 'rotate') throw new Error('esperaba giro');
    expect(r.axis).toBe('Y');
    expect(r.deg).toBeCloseTo(-30);
  });

  it('escalar la altura interna (Y) es % en Z del usuario', () => {
    const r = dragReadout('scale', base, { ...base, scale: [1, 1.5, 0.5] });
    expect(r).toEqual({ kind: 'scale', pct: [100, 50, 150] });
  });
});
