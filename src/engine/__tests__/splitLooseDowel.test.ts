/**
 * @file src/engine/__tests__/splitLooseDowel.test.ts
 * @description Tarugo suelto (`loose-dowel`) en "dividir para imprimir": agujero en ambas piezas, sin
 * salientes, tarugos como piezas aparte cerradas y contadas; firmeza activa (el conector débil se
 * agranda hasta el recomendado si cabe) y sugerencias por unión trabada (pegar o cambiar de tipo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { initManifoldEngine } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { executeBedSplitGeometry, planBedSplit, type SplitConnectorOptions } from '../split';
import { recommendedConnectorRadius } from '../split/assemblyConnectors';
import { objFromM } from './qa5SplitHarness';

const LOOSE: SplitConnectorOptions = { type: 'loose-dowel', size: 3, depth: 6, tolerance: 0.2, count: 1 };
let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

describe('tarugo suelto (loose-dowel)', () => {
  it('cilindro en 5 tramos: agujeros a ambos lados, sin salientes y 4 tarugos aparte cerrados', async () => {
    const obj = objFromM(w.Manifold.cylinder(500, 30, 30, 48).rotate([-90, 0, 0]), 'cil');
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 115 }, { connector: LOOSE, axes: ['y'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: false });
    expect(res.joints.every((j) => j.kind === 'connector' && j.connector?.type === 'loose-dowel')).toBe(true);
    // Sin salientes: cada pieza termina en sus planos de corte
    const ys = plan.planes.map((p) => p.position).sort((a, b) => a - b);
    const cuts = [plan.bounds.min[1], ...ys, plan.bounds.max[1]];
    res.parts.forEach((p, i) => {
      expect(p.bounds.min[1]).toBeGreaterThanOrEqual(cuts[i] - 1e-3);
      expect(p.bounds.max[1]).toBeLessThanOrEqual(cuts[i + 1] + 1e-3);
      expect(countUnpairedEdges(p.mesh)).toBe(0);
    });
    const n = res.joints.reduce((s, j) => s + j.connectorCenters.length, 0);
    expect(res.looseDowels).toHaveLength(1);
    const d = res.looseDowels[0];
    expect(d.count).toBe(n);
    expect(d.diameterMm).toBeCloseTo(6, 6);
    expect(d.lengthMm).toBeCloseTo(2 * 6 - 2 * 0.2, 6);
    expect(countUnpairedEdges(d.mesh)).toBe(0);
    // Volumen del lote: n cilindros de r=3 y largo 11,6 (24 lados ≈ 0,989 del círculo)
    expect(d.volumeMm3).toBeGreaterThan(n * Math.PI * 9 * d.lengthMm * 0.98);
    expect(d.volumeMm3).toBeLessThan(n * Math.PI * 9 * d.lengthMm * 1.001);
    // Montaje lineal y cierre por volumen (los agujeros cuentan como holgura)
    const a = res.assembly!;
    expect(a.blocked).toEqual([]);
    expect(a.clashes).toEqual([]);
    expect(Math.abs(a.closure.volumeErrorPct!)).toBeLessThan(0.5);
  }, 60_000);
});

describe('firmeza activa', () => {
  it('un conector débil se agranda hasta el recomendado cuando cabe', async () => {
    const obj = objFromM(w.Manifold.cylinder(300, 40, 40, 64).rotate([-90, 0, 0]), 'cil');
    const small: SplitConnectorOptions = { type: 'dowel', size: 1.5, depth: 6, tolerance: 0.2, count: 1 };
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 160 }, { connector: small, axes: ['y'], allowRotation: false });
    const weak = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: false });
    expect(weak.assembly!.weak.length).toBeGreaterThan(0);
    const res = await executeBedSplitGeometry(obj, plan);
    const j = res.joints[0];
    const rec = recommendedConnectorRadius(j.contactAreaMm2, j.connectorCenters.length, 160);
    expect(j.connector!.size).toBeGreaterThan(small.size);
    expect(j.connector!.size).toBeGreaterThanOrEqual(rec - 0.5);
    expect(res.assembly!.weak).toEqual([]);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
  }, 60_000);
});

describe('sugerencias por unión trabada', () => {
  it('cubo 2×2×2: cada unión trabada ofrece pegar o cambiar a cola de milano y, si se pide, autoFix conserva más conectores', async () => {
    const obj = objFromM(w.Manifold.cube([100, 100, 100], true), 'cubo');
    const plan = await planBedSplit(obj, { widthMm: 70, depthMm: 70, heightMm: 70 }, { connector: { type: 'dowel', size: 4, depth: 5, tolerance: 0.2, count: 1 } });
    const raw = await executeBedSplitGeometry(obj, plan, { assemblyAutoFix: false, reinforceWeakJoints: false });
    const s = raw.assembly!.suggestions;
    expect(s.length).toBeGreaterThan(0);
    for (const x of s) expect(x.options).toContain('glue');
    expect(s.some((x) => x.options.some((o) => o.startsWith('change-type:')))).toBe(true);
    // La cola de milano pasante abre la superficie: solo se aplica si el usuario la pide
    const res = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: false, assemblyAllowSurfaceChange: true });
    const a = res.assembly!;
    expect(a.blocked).toEqual([]);
    const withConnector = res.joints.filter((j) => j.kind === 'connector').length;
    // Solo pegar dejaba 12 − 5 = 7 uniones con conector
    expect(withConnector).toBeGreaterThan(7);
    expect(res.joints.some((j) => j.connector?.type === 'dovetail')).toBe(true);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
    expect(Math.abs(a.closure.volumeErrorPct!)).toBeLessThan(0.5);
  }, 120_000);
});
