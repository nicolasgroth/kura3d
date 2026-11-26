/**
 * @file src/engine/__tests__/splitModelHarness.ts
 * @description Modelos y medidor independientes (QA ronda 5) de "dividir para imprimir": tubería en T
 * horizontal, L con codo toroidal, tubos de pared 2 y 12, cruz, reducción cónica, mezcla maciza/delgada
 * y peine de brazos finos; mide cuerpos, aristas sueltas, volumen, interferencia, uniones y marcas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { SceneObject } from '../../types/kura';
import { manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { normalizeMeshToBed } from '../primitives';
import { executeBedSplitGeometry, planBedSplit, type BedSplitExecuteOptions, type BedSplitPlanOptions, type SplitBed } from '../split';
import { makeObject } from './geometryTestUtils';

export function objFromM(m: Manifold, name: string): SceneObject {
  const mesh = manifoldToMeshData(m);
  const bb = m.boundingBox();
  const obj = makeObject(name, normalizeMeshToBed(mesh), { position: [(bb.min[0] + bb.max[0]) / 2, bb.min[1], (bb.min[2] + bb.max[2]) / 2] });
  m.delete();
  return obj;
}
const del = (...ms: Manifold[]) => ms.forEach((m) => m.delete());
function cylX(w: ManifoldToplevel, l: number, r: number, x0: number, y: number, z = 0, seg = 64) {
  const c = w.Manifold.cylinder(l, r, r, seg);
  const o = c.rotate([0, 90, 0]).translate([x0, y, z]);
  c.delete();
  return o;
}
/** Cilindro de eje Z desde `z0`. */
function cylZ(w: ManifoldToplevel, l: number, r: number, z0: number, y: number, x = 0, seg = 64) {
  return w.Manifold.cylinder(l, r, r, seg).translate([x, y, z0]);
}
function sub(outer: Manifold[], inner: Manifold[], w: ManifoldToplevel) {
  const o = w.Manifold.union(outer);
  const i = w.Manifold.union(inner);
  const r = o.subtract(i);
  del(o, i, ...outer, ...inner);
  return r;
}

/** (a) T horizontal: tubo X de 1000, Ø150 pared t; ramal Z de 500 en el centro. */
export const modelT = (w: ManifoldToplevel, t = 4) => {
  const R = 75, r = R - t;
  return sub([cylX(w, 1000, R, -500, R), cylZ(w, 500, R, 0, R)], [cylX(w, 1002, r, -501, R), cylZ(w, 502, r, -1, R)], w);
};
/** (b) L plana 1000×1000 con codo toroidal (cuarto de toro), Ø150 pared t. */
export const modelL = (w: ManifoldToplevel, t = 3) => {
  const R = 75, Rb = 150, leg = 1000 - (Rb + R);
  const quarter = (rr: number, ext: number) => {
    const circ = w.CrossSection.circle(rr, 64).translate([Rb, 0]);
    const rev = circ.revolve(64, 90);
    circ.delete();
    const a = w.Manifold.cylinder(leg + ext, rr, rr, 64).rotate([90, 0, 0]).translate([Rb, 0, 0]); // hacia -Y
    const b = w.Manifold.cylinder(leg + ext, rr, rr, 64).rotate([0, -90, 0]).translate([0, Rb, 0]); // hacia -X
    const u = w.Manifold.union([rev, a, b]);
    del(rev, a, b);
    return u;
  };
  const o = quarter(R, 0);
  const i = quarter(R - t, 1);
  const res = o.subtract(i);
  del(o, i);
  const flat = res.rotate([-90, 0, 0]);
  res.delete();
  return flat;
};
/** (c) tubo recto X de 1000, Ø100, pared t. */
export const modelStraight = (w: ManifoldToplevel, t: number) => sub([cylX(w, 1000, 50, -500, 50)], [cylX(w, 1002, 50 - t, -501, 50)], w);
/** (d) cruz de 4 brazos 1000×1000, Ø100 pared 3. */
export const modelCross = (w: ManifoldToplevel, t = 3) =>
  sub([cylX(w, 1000, 50, -500, 50), cylZ(w, 1000, 50, -500, 50)], [cylX(w, 1002, 50 - t, -501, 50), cylZ(w, 1002, 50 - t, -501, 50)], w);
/** (e) reducción cónica hueca vertical Ø300→Ø100, 600 de alto, pared 3 en radio. */
export const modelCone = (w: ManifoldToplevel) => {
  const o = w.Manifold.cylinder(600, 150, 50, 96).rotate([-90, 0, 0]);
  const i = w.Manifold.cylinder(602, 147, 47, 96).rotate([-90, 0, 0]).translate([0, -1, 0]);
  const r = o.subtract(i);
  del(o, i);
  return r;
};
/** (f) tubo Ø150 pared 3 de 800 + varilla maciza Ø30 paralela, unida por un puente en un extremo. */
export const modelMixed = (w: ManifoldToplevel, extraBridgeX?: number) => {
  const tube = sub([cylX(w, 800, 75, -400, 75)], [cylX(w, 802, 72, -401, 75)], w);
  const rod = cylX(w, 800, 15, -400, 15, 105);
  const bridge = w.Manifold.cube([20, 90, 50], false).translate([-400, 0, 60]);
  const parts = [tube, rod, bridge];
  if (extraBridgeX !== undefined) parts.push(w.Manifold.cube([20, 90, 50], false).translate([extraBridgeX, 0, 60]));
  const u = w.Manifold.union(parts);
  del(...parts);
  return u;
};
/** (g) base 500×10×60 con 8 brazos finos Ø4 de 150 de alto. */
export const modelComb = (w: ManifoldToplevel) => {
  const parts: Manifold[] = [w.Manifold.cube([500, 10, 60], false).translate([-250, 0, -30])];
  for (let k = 0; k < 8; k++) parts.push(w.Manifold.cylinder(150, 2, 2, 16).rotate([-90, 0, 0]).translate([-220 + k * 62, 5, 0]));
  const u = w.Manifold.union(parts);
  del(...parts);
  return u;
};

export interface Row {
  name: string; bed: number; opts: string; pieces: number; planned: number; joints: number;
  connectorPct: number; gluePct: number; lapPct: number; lapNoClear: number; markBothPct: number; markOutside: number;
  fitFail: number; multiBody: number; unpaired: number; volErrPct: number; interferenceMm3: number;
  strips: number; minDimMm: number; minBedMargin: number; secs: number; warnings: string[]; err?: string;
}

export async function measure(
  w: ManifoldToplevel, m: Manifold, name: string, bed: number, planOpts: BedSplitPlanOptions, execOpts: BedSplitExecuteOptions, optsLabel: string,
) {
  const obj = objFromM(m, name);
  const B: SplitBed = { widthMm: bed, depthMm: bed, heightMm: bed };
  const t0 = performance.now();
  const base: Row = { name, bed, opts: optsLabel, pieces: 0, planned: 0, joints: 0, connectorPct: 0, gluePct: 0, lapPct: 0, lapNoClear: 0, markBothPct: 0, markOutside: 0, fitFail: 0, multiBody: 0, unpaired: 0, volErrPct: 0, interferenceMm3: 0, strips: 0, minDimMm: 0, minBedMargin: 0, secs: 0, warnings: [] };
  try {
    const plan = await planBedSplit(obj, B, { maxPieces: 'auto', ...planOpts });
    const res = await executeBedSplitGeometry(obj, plan, { labels: 'engraved', ...execOpts });
    const placed: Manifold[] = [];
    let multi = 0, unp = 0, fit = 0, strips = 0, minDim = 1e9;
    for (const p of res.parts) {
      const pm = meshDataToManifold(w, p.mesh);
      const comps = pm.decompose();
      if (comps.length !== 1) multi++;
      comps.forEach((c) => c.delete());
      unp += countUnpairedEdges(p.mesh);
      const size = [0, 1, 2].map((a) => p.bounds.max[a] - p.bounds.min[a]).sort((x, y) => x - y);
      if (size.some((s) => s > bed - 2 + 1e-6)) fit++;
      if (size[0] < 8) strips++;
      minDim = Math.min(minDim, size[0]);
      placed.push(pm.translate(p.assembly.position));
      pm.delete();
    }
    let inter = 0;
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
      const A = res.parts[i].bounds, Bb = res.parts[j].bounds;
      if ([0, 1, 2].some((a) => A.max[a] < Bb.min[a] - 1e-3 || Bb.max[a] < A.min[a] - 1e-3)) continue;
      const x = placed[i].intersect(placed[j]);
      const bb = x.boundingBox();
      const thin = x.isEmpty() || Math.min(...[0, 1, 2].map((a) => bb.max[a] - bb.min[a])) < 1e-3;
      if (!thin) inter += x.volume();
      x.delete();
    }
    placed.forEach((p) => p.delete());
    const sum = res.parts.reduce((s, p) => s + p.volumeMm3, 0);
    const exp = res.sourceVolumeMm3 - res.clearanceVolumeMm3 - res.engravedVolumeMm3;
    const J = res.joints.length || 1;
    const pct = (n: number) => Math.round((1000 * n) / J) / 10;
    Object.assign(base, {
      pieces: res.parts.length, planned: plan.pieces.length, joints: res.joints.length,
      connectorPct: pct(res.joints.filter((j) => j.kind === 'connector').length),
      gluePct: pct(res.joints.filter((j) => j.kind === 'glue').length),
      lapPct: pct(res.joints.filter((j) => j.kind === 'lap').length),
      lapNoClear: res.joints.filter((j) => j.kind === 'lap' && !((j.lap?.clearanceMm ?? 0) > 0)).length,
      markBothPct: pct(res.joints.filter((j) => j.labelEngraved).length),
      markOutside: res.joints.filter((j) => j.labelPlacement === 'outside').length,
      fitFail: fit, multiBody: multi, unpaired: unp, volErrPct: Math.round((1e4 * Math.abs(sum - exp)) / res.sourceVolumeMm3) / 100,
      interferenceMm3: Math.round(inter * 100) / 100, strips, minDimMm: Math.round(minDim * 10) / 10,
      minBedMargin: Math.round(Math.min(...plan.pieces.map((p) => p.bedMarginMm)) * 100) / 100,
      secs: Math.round((performance.now() - t0) / 100) / 10, warnings: [...new Set([...(plan.warnings ?? []), ...res.warnings].map((x) => x.code))],
    });
    return { row: base, res, plan, obj };
  } catch (e) {
    base.err = String((e as Error).message ?? e).slice(0, 160);
    base.secs = Math.round((performance.now() - t0) / 100) / 10;
    return { row: base, res: undefined, plan: undefined, obj };
  }
}
