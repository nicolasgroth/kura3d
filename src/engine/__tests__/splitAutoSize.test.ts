/**
 * @file src/engine/__tests__/splitAutoSize.test.ts
 * @description Tamaño de conector automático (`sizeAuto`) en "dividir para imprimir": cada unión usa su
 * radio recomendado, la unión no queda débil y un tamaño dado por la persona se respeta tal cual.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { initManifoldEngine } from '../manifoldKernel';
import { executeBedSplitGeometry, planBedSplit, type SplitConnectorOptions } from '../split';
import { recommendedConnectorRadius } from '../split/assemblyConnectors';
import { OPERATION_DEFAULTS } from '../operationLimits';
import { objFromM } from './splitModelHarness';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

describe('tamaño de conector automático', () => {
  it('el valor de fábrica es automático (una sola fuente)', () => {
    expect(OPERATION_DEFAULTS.split.connectorSize).toBe('auto');
    expect(OPERATION_DEFAULTS.split.prefConnectorSize).toBe('auto');
  });

  it('cubo de 440 mm: con tamaño automático la unión usa el recomendado; fijo en 4 queda débil y se respeta', async () => {
    const obj = objFromM(w.Manifold.cube([440, 440, 440], true), 'cubo');
    const bed = { widthMm: 250, depthMm: 250, heightMm: 250 };
    const base: SplitConnectorOptions = { type: 'dowel', size: 4, depth: 6, tolerance: 0.2, count: 2 };
    const fixed = await planBedSplit(obj, bed, { connector: base });
    const weak = await executeBedSplitGeometry(obj, fixed, { reinforceWeakJoints: false });
    expect(weak.assembly!.weak.length).toBeGreaterThan(0);
    for (const j of weak.joints) if (j.connector) expect(j.connector.size).toBe(4);

    const plan = await planBedSplit(obj, bed, { connector: { ...base, sizeAuto: true } });
    const res = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: false });
    const used = res.joints.filter((j) => j.connector);
    expect(used.length).toBeGreaterThan(0);
    for (const j of used) {
      expect(j.connector!.size).toBeGreaterThan(4);
      expect('sizeAuto' in j.connector!).toBe(false);
      const rec = recommendedConnectorRadius(j.contactAreaMm2, j.connectorCenters.length, 440);
      expect(j.connector!.size).toBeLessThanOrEqual(rec + 1e-6);
    }
    expect(res.assembly!.weak.length).toBeLessThan(weak.assembly!.weak.length);
  }, 120_000);

  it('cubo de 440 mm con tamaño automático: ninguna cara maciza queda débil, aunque solo quepa un conector', async () => {
    const obj = objFromM(w.Manifold.cube([440, 440, 440], true), 'cubo');
    const bed = { widthMm: 256, depthMm: 256, heightMm: 256 };
    for (const depth of [6, 8]) {
      const plan = await planBedSplit(obj, bed, { connector: { type: 'dowel', size: 4, depth, tolerance: 0.2, count: 2, sizeAuto: true } });
      const res = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: false });
      expect(res.assembly!.weak).toEqual([]);
      // Donde solo cabe uno, ese conector lleva el radio recomendado para uno (acotado por la profundidad).
      const single = res.joints.filter((j) => j.connector && j.connectorCenters.length === 1);
      for (const j of single) expect(j.connector!.size).toBeGreaterThan(5.6);
      // Un conector menos aunque más grande se avisa como reducción, no también como refuerzo.
      const codes = res.warnings.map((x) => x.code);
      expect(codes).not.toContain('SPLIT_CONNECTOR_REINFORCED');
    }
  }, 300_000);
});
