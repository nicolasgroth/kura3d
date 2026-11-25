/**
 * @file src/engine/__tests__/splitMagnetOblique.test.ts
 * @description Imanes en el corte con secciones no alineadas con los ejes, con el motor real: una caja girada 30°
 * sobre el eje del corte (sección de 40 × 80 mm oblicua) recibe los imanes que caben con su pared, no uno solo
 * «débil».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { initManifoldEngine } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { executeBedSplitGeometry, planBedSplit } from '../split';
import { magnetConnector } from '../split/splitMagnet';
import { MAGNET_DEFAULTS } from '../../core/addons/magnetPocket';
import { objFromM } from './splitModelHarness';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const BED = { widthMm: 200, depthMm: 200, heightMm: 60 };

/** Caja 40 × 100 (alto) × 80 girada 30° sobre la vertical: el corte horizontal da una sección oblicua 40 × 80. */
function turnedBox() {
  const raw = w.Manifold.cube([40, 100, 80], true);
  const turned = raw.rotate([0, 30, 0]);
  raw.delete();
  return objFromM(turned, 'girada');
}

describe('imanes en secciones oblicuas', () => {
  it('automática: los que dan una unión firme (4 en 40 × 80), sin aviso de reducción', async () => {
    const obj = turnedBox();
    const res = await executeBedSplitGeometry(obj, await planBedSplit(obj, BED, { connector: magnetConnector(MAGNET_DEFAULTS, 'auto'), axes: ['y'], allowRotation: false }));
    const j = res.joints[0];
    console.info(`girada 30°: ${j.connectorCenters.length} imanes, fuerza ${j.strength?.level} ${j.strength?.reasons}, avisos ${res.warnings.map((x) => x.code).join(',')}`);
    expect(j.kind).toBe('connector');
    expect(j.connectorCenters.length).toBe(4);
    expect(j.strength?.level).toBe('firm');
    expect(res.warnings.map((x) => x.code)).not.toContain('SPLIT_MAGNET_REDUCED');
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
  }, 60_000);

  it('caja inclinada 30° sobre un eje horizontal (paredes oblicuas en el corte): varios imanes con su pared', async () => {
    const raw = w.Manifold.cube([40, 100, 80], true);
    const tilted = raw.rotate([30, 0, 0]);
    raw.delete();
    const obj = objFromM(tilted, 'inclinada');
    const res = await executeBedSplitGeometry(obj, await planBedSplit(obj, BED, { connector: magnetConnector(MAGNET_DEFAULTS, 'auto'), axes: ['y'], allowRotation: false }));
    const j = res.joints[0];
    console.info(`inclinada 30°: ${j.connectorCenters.length} imanes, fuerza ${j.strength?.level} ${j.strength?.reasons}, avisos ${res.warnings.map((x) => x.code).join(',')}`);
    expect(j.connectorCenters.length).toBeGreaterThanOrEqual(2);
    expect(j.strength?.level).not.toBe('weak');
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
  }, 60_000);

  it('cantidad fija 4: caben los 4', async () => {
    const obj = turnedBox();
    const res = await executeBedSplitGeometry(obj, await planBedSplit(obj, BED, { connector: magnetConnector(MAGNET_DEFAULTS, 4), axes: ['y'], allowRotation: false }));
    console.info(`girada 30°, fija 4: ${res.joints[0].connectorCenters.length} imanes`);
    expect(res.joints[0].connectorCenters).toHaveLength(4);
  }, 60_000);
});
