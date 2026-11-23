/**
 * @file src/core/scene/__tests__/explodedAboveBed.test.ts
 * @description La vista explosionada de un grupo dividido en vertical (cubo/cilindro alto cortado en Z del
 * usuario) nunca deja piezas bajo la cama; con factor 0 respeta el armado exacto si ya está apoyado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { explodedSplitPositions, type SplitGroup } from '../splitGroups';

/** Tres piezas apiladas de 120×200×120 mm (Y arriba): bases en 0, 200 y 400. */
function stacked(baseY = 0): SplitGroup {
  const parts = [0, 200, 400].map((y, i) => ({
    id: `p${i}`,
    stats: { dimensionsMm: [120, 200, 120] },
    metadata: { split: { assembly: { position: [0, y + baseY, 0], rotation: [0, 0, 0] } } },
  }));
  return { parts } as unknown as SplitGroup;
}

const lowest = (group: SplitGroup, factor: number) => {
  const pos = explodedSplitPositions(group, factor);
  return Math.min(...group.parts.map((p) => pos.get(p.id)![1]));
};

describe('vista explosionada sobre la cama', () => {
  it('separar al 100 % no baja ninguna pieza de Y=0', () => {
    expect(lowest(stacked(), 1)).toBeGreaterThanOrEqual(-1e-9);
    expect(lowest(stacked(), 0.5)).toBeGreaterThanOrEqual(-1e-9);
  });

  it('armado exacto (factor 0) sin cambios si ya está apoyado', () => {
    const pos = explodedSplitPositions(stacked(), 0);
    expect(pos.get('p0')![1]).toBeCloseTo(0);
    expect(pos.get('p2')![1]).toBeCloseTo(400);
  });

  it('un armado que dejaba una pieza bajo la cama se apoya en ella', () => {
    expect(lowest(stacked(-30), 0)).toBeCloseTo(0);
  });
});
