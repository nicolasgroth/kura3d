/**
 * @file src/engine/__tests__/splitMagnetRoundRegression.test.ts
 * @description Regresión exacta de los imanes redondos en la unión del corte tras sumar cuadrados y rectangulares:
 * mismas posiciones (±0,001 mm), cantidades y fuerza que antes del cambio, en un bloque, una sección grande con
 * imán de 8 × 3, una caja girada 30° (sección oblicua) y una cantidad fija de 3. Valores medidos con el motor previo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { initManifoldEngine } from '../manifoldKernel';
import { executeBedSplitGeometry, planBedSplit, type SplitBed, type SplitConnectorOptions } from '../split';
import { magnetConnector } from '../split/splitMagnet';
import { MAGNET_DEFAULTS } from '../../core/addons/magnetPocket';
import { objFromM } from './splitModelHarness';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const BED50: SplitBed = { widthMm: 200, depthMm: 200, heightMm: 50 };
const GIRADA: Vec3[] = [[4.0777, 0, 39.4228], [-4.0777, 0, -39.4228], [17.1762, 0, -1.9711], [-20.2754, 0, -3.9423]];

const CASES: Array<{ name: string; make: () => Manifold; bed: SplitBed; connector: () => SplitConnectorOptions; joints: Vec3[][]; area: number }> = [
  {
    name: 'bloque 40 × 60 × 30, Ø5 × 2 automática', make: () => w.Manifold.cube([40, 60, 30], true), bed: BED50,
    connector: () => magnetConnector(MAGNET_DEFAULTS, 'auto'), joints: [[[-16.18, 0, -11.18], [16.18, 0, 11.18]]], area: 0.03272492347489368,
  },
  {
    name: 'bloque 120 × 60 × 90, Ø8 × 3 automática', make: () => w.Manifold.cube([120, 60, 90], true), bed: BED50,
    connector: () => magnetConnector({ ...MAGNET_DEFAULTS, sizeMm: 8, heightMm: 3 }, 'auto'),
    joints: [[[-54.68, 0, -39.68], [54.68, 0, 39.68], [-30.074, 0, 39.68], [30.074, 0, -39.606], [-13.67, 0, -9.532]]], area: 0.023271056693257727,
  },
  {
    name: 'caja girada 30°, Ø5 × 2 automática', bed: { widthMm: 200, depthMm: 200, heightMm: 60 },
    make: () => {
      const raw = w.Manifold.cube([40, 100, 80], true);
      const out = raw.rotate([0, 30, 0]);
      raw.delete();
      return out;
    },
    connector: () => magnetConnector(MAGNET_DEFAULTS, 'auto'),
    joints: [GIRADA.map(([x, , z]) => [x, -16.6667, z] as Vec3), GIRADA.map(([x, , z]) => [x, 16.6667, z] as Vec3)], area: 0.024543692324484244,
  },
  {
    name: 'bloque 60 × 60 × 30, cantidad fija 3', make: () => w.Manifold.cube([60, 60, 30], true), bed: BED50,
    connector: () => magnetConnector(MAGNET_DEFAULTS, 3), joints: [[[-26.18, 0, -11.18], [26.18, 0, 11.18], [-5.236, 0, 11.18]]], area: 0.032724923474893676,
  },
];

describe('imanes redondos: mismas posiciones y cantidades que antes de los rectangulares', () => {
  it.each(CASES)('$name', async ({ make, bed, connector, joints, area }) => {
    const obj = objFromM(make(), 'pieza');
    const res = await executeBedSplitGeometry(obj, await planBedSplit(obj, bed, { connector: connector(), axes: ['y'], allowRotation: false }));
    expect(res.joints).toHaveLength(joints.length);
    res.joints.forEach((j, k) => {
      expect(j.connectorCenters).toHaveLength(joints[k].length);
      j.connectorCenters.forEach((c, i) => c.forEach((v, a) => expect(Math.abs(v - joints[k][i][a])).toBeLessThan(1e-3)));
      expect(j.strength?.level).toBe('firm');
      expect(j.strength?.areaRatio).toBeCloseTo(area, 9);
    });
  }, 60_000);
});
