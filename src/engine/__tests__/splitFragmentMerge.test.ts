/**
 * @file src/engine/__tests__/splitFragmentMerge.test.ts
 * @description Fusión de fragmentos diminutos en "dividir para imprimir": la pieza que absorbe un
 * fragmento de la celda vecina cruza el plano de corte a propósito; el resultado lo informa con el aviso
 * tipado `SPLIT_FRAGMENT_MERGED` (pieza, volumen y cuánto sobresale), y sin fusión no hay aviso ni saliente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { normalizeMeshToBed } from '../primitives';
import { executeBedSplitGeometry, planBedSplit } from '../split';
import { makeObject } from './geometryTestUtils';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

/** Bloque 100×100×100 con una pestaña de 4×4×6 sobre el plano Y = 100 (cama de 110,5 de alto, útil 100,5: hay que cortar). */
function blockWithTab() {
  const block = w.Manifold.cube([100, 100, 100], false).translate([-50, 0, -50]);
  const tab = w.Manifold.cube([4, 6, 4], false).translate([-2, 100, -2]);
  const m = w.Manifold.union([block, tab]);
  block.delete();
  tab.delete();
  const mesh = manifoldToMeshData(m);
  m.delete();
  return makeObject('bloque', normalizeMeshToBed(mesh), { position: [0, 0, 0] });
}

describe('fusión de fragmentos', () => {
  it('la pieza que absorbe un fragmento lo informa con SPLIT_FRAGMENT_MERGED y su saliente real', async () => {
    const obj = blockWithTab();
    const plan = await planBedSplit(obj, { widthMm: 250, depthMm: 250, heightMm: 110.5 }, { axes: ['y'], planePositions: { y: [100] }, connector: null, allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan, { labels: 'none', minFragmentMm3: 500 });
    expect(res.parts.length).toBe(1);
    const warn = res.warnings.find((x) => x.code === 'SPLIT_FRAGMENT_MERGED');
    expect(warn).toBeDefined();
    const p = res.parts[0];
    const cell = plan.pieces.find((q) => q.cell.join() === p.cell.join())!.bounds;
    const out = Math.max(0, ...[0, 1, 2].flatMap((a) => [p.bounds.max[a] - cell.max[a], cell.min[a] - p.bounds.min[a]]));
    expect(out).toBeGreaterThan(5);
    expect(Number(warn!.params.protrusion)).toBeCloseTo(out, 1);
    expect(Number(warn!.params.volume)).toBeCloseTo(96, 0);
  }, 60_000);

  it('sin fusión (umbral 0) no hay aviso y el fragmento queda como pieza dentro de su celda', async () => {
    const obj = blockWithTab();
    const plan = await planBedSplit(obj, { widthMm: 250, depthMm: 250, heightMm: 110.5 }, { axes: ['y'], planePositions: { y: [100] }, connector: null, allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan, { labels: 'none', minFragmentMm3: 0 });
    expect(res.parts.length).toBe(2);
    expect(res.warnings.some((x) => x.code === 'SPLIT_FRAGMENT_MERGED')).toBe(false);
  }, 60_000);
});
