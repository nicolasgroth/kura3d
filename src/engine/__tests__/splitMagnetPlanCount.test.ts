/**
 * @file src/engine/__tests__/splitMagnetPlanCount.test.ts
 * @description Dividir con imanes da las mismas piezas que sin conector: los imanes no sobresalen de su pieza (cada
 * alojamiento queda dentro), así que el plan no les suma saliente. Antes se sumaba el mínimo de 0,8 mm de los machos
 * y una figura que entraba justo en dos tramos pasaba a tres (Spiral Phoenix en cama de 70: 5 piezas con imanes y 4
 * sin ellos). Las espigas sí sobresalen y pueden pedir un tramo más.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { initManifoldEngine } from '../manifoldKernel';
import { planBedSplit, type SplitConnectorOptions } from '../split';
import { connectorProtrusion } from '../split/splitPlan';
import { magnetConnector } from '../split/splitMagnet';
import { MAGNET_DEFAULTS } from '../../core/addons/magnetPocket';
import { objFromM } from './splitModelHarness';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const BED = { widthMm: 200, depthMm: 200, heightMm: 70 };

describe('dividir: imanes y cantidad de piezas', () => {
  it('los imanes no suman saliente al plan', () => {
    expect(connectorProtrusion(magnetConnector(MAGNET_DEFAULTS, 'auto'))).toBe(0);
    expect(connectorProtrusion(magnetConnector({ ...MAGNET_DEFAULTS, shape: 'rect', sizeMm: 10, widthMm: 5 }, 2))).toBe(0);
    expect(connectorProtrusion(null)).toBe(0);
  });

  it('una pieza que entra justo en dos tramos da dos con imanes, igual que sin conector', async () => {
    const probe = objFromM(w.Manifold.cube([40, 100, 40], true), 'sonda');
    const usable = (await planBedSplit(probe, BED, { connector: null, axes: ['y'], allowRotation: false })).usableMm[1];
    const obj = objFromM(w.Manifold.cube([40, 2 * usable - 0.4, 40], true), 'justa');
    const none = await planBedSplit(obj, BED, { connector: null, axes: ['y'], allowRotation: false });
    const magnets = await planBedSplit(obj, BED, { connector: magnetConnector(MAGNET_DEFAULTS, 'auto'), axes: ['y'], allowRotation: false });
    expect(none.counts.y).toBe(2);
    expect(magnets.counts.y).toBe(none.counts.y);
    // Una espiga de 6 mm sí sobresale: esa misma pieza necesita un tramo más (comportamiento legítimo).
    const dowel: SplitConnectorOptions = { type: 'dowel', size: 4, depth: 6, tolerance: 0.25, count: 2 };
    expect((await planBedSplit(obj, BED, { connector: dowel, axes: ['y'], allowRotation: false })).counts.y).toBe(3);
  }, 60_000);
});
