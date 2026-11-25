/**
 * @file src/engine/__tests__/splitMagnetLabel.test.ts
 * @description Dividir con imanes y marca de pareja grabada en la cara del corte (motor real): la marca (0,4 mm) nunca
 * se solapa con un alojamiento de imán. Si se solaparan, el volumen quitado a las piezas sería menor que la suma de
 * los alojamientos y la marca; aquí es igual (±0,5 %). Además la zona de la marca excluye un anillo de 1,5 mm
 * alrededor de cada alojamiento, y los alojamientos del armado siguen completos.
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
import { pocketDims, pocketSectionArea } from '../../core/addons/magnetPocket';
import { BUILTIN_MAGNET_PRESETS } from '../../core/addons/magnetPresets';
import { objFromM } from './splitModelHarness';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const BED = { widthMm: 200, depthMm: 200, heightMm: 50 };

describe('marca de pareja y alojamientos de imán', () => {
  it.each(['round-5x2', 'round-8x3', 'round-10x3'])('%s: la marca grabada no se solapa con los alojamientos', async (id) => {
    const preset = BUILTIN_MAGNET_PRESETS.find((p) => p.id === id)!;
    const obj = objFromM(w.Manifold.cube([60, 60, 30], true), 'bloque');
    const connector = magnetConnector(preset.values, 'auto');
    const plan = await planBedSplit(obj, BED, { connector, axes: ['y'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan, { labels: 'engraved', labelPlacement: 'joint', labelDepthMm: 0.4 });
    expect(res.parts).toHaveLength(2);
    const j = res.joints[0];
    expect(j.kind).toBe('connector');
    expect(j.labelEngraved).toBe(true);
    expect(j.labelPlacement).toBe('joint');
    expect(res.engravedVolumeMm3).toBeGreaterThan(1);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
    const dims = pocketDims(preset.values);
    const pockets = 2 * j.connectorCenters.length * pocketSectionArea({ ...dims, shape: 'round' }) * dims.depthMm;
    const removed = res.sourceVolumeMm3 - res.parts.reduce((s, p) => s + p.volumeMm3, 0);
    // Sin solape: quitado = alojamientos + marca. Con solape, menos.
    const expected = pockets + res.engravedVolumeMm3;
    expect(Math.abs(removed - expected) / expected).toBeLessThan(0.005);
  }, 90_000);
});
