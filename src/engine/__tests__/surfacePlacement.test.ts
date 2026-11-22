/**
 * @file src/engine/__tests__/surfacePlacement.test.ts
 * @description Inversa de la proyección: el clic en una cara da el eje y el U/V que centran el
 * diseño en ese punto, con el mismo convenio de signos que `buildProjectionRay`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { placementFromHit } from '../surfacePlacement';

const c: [number, number, number] = [10, 20, 30];

describe('placementFromHit', () => {
  it('elige la cara por la normal dominante y su signo', () => {
    expect(placementFromHit(c, [13, 24, 40], [0, 0, 1])).toEqual({ axis: '+z', offsetU: 3, offsetV: 4 });
    expect(placementFromHit(c, [13, 24, 20], [0, 0, -1])).toEqual({ axis: '-z', offsetU: -3, offsetV: 4 });
    expect(placementFromHit(c, [20, 24, 33], [1, 0.1, 0])).toEqual({ axis: '+x', offsetU: -3, offsetV: 4 });
    expect(placementFromHit(c, [0, 24, 33], [-1, 0, 0])).toEqual({ axis: '-x', offsetU: 3, offsetV: 4 });
    expect(placementFromHit(c, [13, 40, 35], [0, 1, 0])).toEqual({ axis: '+y', offsetU: 3, offsetV: -5 });
    expect(placementFromHit(c, [13, 0, 35], [0, -1, 0])).toEqual({ axis: '-y', offsetU: 3, offsetV: 5 });
  });
});
