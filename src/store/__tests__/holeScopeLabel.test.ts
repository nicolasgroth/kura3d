/**
 * @file src/store/__tests__/holeScopeLabel.test.ts
 * @description «Aplicar N restas»: el número del botón es lo que la acción consume (alcance de la selección y
 * solo negativos que tocan un sólido), y con una selección de 2+ piezas el rótulo lo dice.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { resolveHoleScope, touchingHoleScope } from '../../core/scene/sceneRules';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { applyHolesInfo, applyHolesLabel } from '../holeScopeLabel';

/** Cubo de lado 1 centrado en el origen (la superposición se mide con la malla). */
const CUBE = {
  positions: new Float32Array([-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]),
};
const box = (id: string, size: number, x: number, role: 'solid' | 'negative'): SceneObject => ({
  ...fakeBox(id, id, size), role, position: [x, 0, 0], scale: [size, size, size], mesh: CUBE,
});
const hole = (id: string, x = 0) => box(id, 10, x, 'negative');
const solid = box('s', 40, 0, 'solid');

describe('rótulo de «Aplicar restas»', () => {
  const objects = [solid, hole('h1'), hole('h2'), hole('h3'), hole('h4')];

  it('sin selección múltiple cuenta todas las restas visibles', () => {
    expect(applyHolesInfo(objects, [])).toEqual({ count: 4, fromSelection: false });
    expect(applyHolesLabel('es', objects, [])).toBe('Aplicar 4 restas');
  });

  it('con la pieza y 2 negativos seleccionados anuncia 2 y lo dice (no las 4 de la escena)', () => {
    const selected = ['s', 'h1', 'h2'];
    const scope = resolveHoleScope(objects, selected);
    const consumed = touchingHoleScope(scope.solids, scope.holes).holes.length;
    expect(consumed).toBe(2);
    expect(applyHolesInfo(objects, selected).count).toBe(consumed);
    expect(applyHolesLabel('es', objects, selected)).toBe('Aplicar 2 restas de la selección');
    expect(applyHolesLabel('en', objects, ['s', 'h1'])).toBe('Apply 1 subtraction from the selection');
  });

  it('un negativo lejano que no toca ningún sólido no cuenta', () => {
    const far = [solid, hole('h1'), hole('far', 500)];
    expect(applyHolesInfo(far, []).count).toBe(1);
  });
});
