/**
 * @file src/components/__tests__/pocketGhost.test.ts
 * @description Vista previa del hueco de imán: la geometría sale de la primitiva con las medidas ya estrechadas (sin
 * casts; una medida ausente da null en vez de NaN) y tiene aristas para dibujar el contorno de alto contraste.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS, placePocket } from '../../core/addons/magnetPocket';
import { pocketGhostEdges, pocketGhostGeometry } from '../viewport/pocketGhostGeometry';

describe('vista previa del hueco: geometría y contorno', () => {
  it('una primitiva sin medidas no produce geometría con NaN', () => {
    expect(pocketGhostGeometry({ type: 'cylinder', params: { height: 2 } })).toBeNull();
    expect(pocketGhostGeometry({ type: 'box', params: { width: 5 } })).toBeNull();
    expect(pocketGhostGeometry({ type: 'box', params: { width: 5, depth: 5, height: Number.NaN } })).toBeNull();
  });

  it('redondo y cuadrado tienen aristas para el contorno', () => {
    for (const shape of ['round', 'square'] as const) {
      const plan = placePocket({ ...MAGNET_DEFAULTS, shape }, [0, 0, 0], [0, 1, 0])!;
      const geometry = pocketGhostGeometry(plan.primitive)!;
      expect(geometry).not.toBeNull();
      expect(pocketGhostEdges(geometry).getAttribute('position').count).toBeGreaterThanOrEqual(24);
    }
  });
});
