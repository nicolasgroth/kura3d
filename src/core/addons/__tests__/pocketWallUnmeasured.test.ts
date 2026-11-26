/**
 * @file src/core/addons/__tests__/pocketWallUnmeasured.test.ts
 * @description Pared de un alojamiento de imán cuando ningún rayo lateral cuenta (cara muy curva, todas las alturas
 * sobre la superficie local): la pared lateral queda «sin medida», nunca infinita; `minWallMm` es lo medido (el fondo)
 * y el aviso de pared sigue saltando si ese fondo es delgado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS, placePocket } from '../magnetPocket';
import { measurePocketWall } from '../pocketWall';
import { wallWarningKey } from '../../../store/magnetWarnings';
import { boxMesh } from './magnetPocket.test';

// La superficie baja mucho hacia el borde en todas las direcciones: ningún nivel lateral se mide.
const rimHeights = new Array(64).fill(-100);

describe('pared del imán sin medida lateral', () => {
  it('el informe es finito, marca la pared lateral sin medir e informa el fondo', () => {
    const box = boxMesh(30, 30, 30);
    const plan = placePocket(MAGNET_DEFAULTS, [0, 30, 0], [0, 1, 0])!;
    const r = measurePocketWall(box, [0, 30, 0], plan.frame, plan.dims, { rimHeights });
    expect(Number.isFinite(r.minWallMm)).toBe(true);
    expect(r.sideMeasured).toBe(false);
    expect(r.side).toBe('bottom');
    // 30 − 2,2 = 27,8 mm de fondo.
    expect(r.minWallMm).toBeCloseTo(27.8, 3);
  });

  it('con el fondo delgado el aviso de pared no se silencia aunque no haya medida lateral', () => {
    const plate = boxMesh(30, 3, 30);
    const plan = placePocket(MAGNET_DEFAULTS, [0, 3, 0], [0, 1, 0])!;
    const r = measurePocketWall(plate, [0, 3, 0], plan.frame, plan.dims, { rimHeights });
    expect(r.sideMeasured).toBe(false);
    expect(r.minWallMm).toBeCloseTo(0.8, 3);
    expect(wallWarningKey(r)).toBe('magnet.warn.wall');
  });

  it('con rayos laterales válidos la pared lateral se mide como siempre', () => {
    const box = boxMesh(30, 30, 30);
    const plan = placePocket(MAGNET_DEFAULTS, [0, 30, 0], [0, 1, 0])!;
    const r = measurePocketWall(box, [0, 30, 0], plan.frame, plan.dims);
    expect(r.sideMeasured).toBe(true);
    expect(r.minWallMm).toBeCloseTo(12.4, 3);
  });
});
