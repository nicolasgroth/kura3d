/**
 * @file src/engine/__tests__/thinWallReport.test.ts
 * @description QA ronda 5: pared delgada del informe de imprimibilidad con mallas distintas de las del
 * desarrollo (cono, cápsula, cilindro de 8 y de 256 lados, pieza ahuecada, texto, placa con nervio de
 * 0,5 mm, STL con normales invertidas). La malla de 200 mil triángulos con tope de tiempo está en
 * `thinWallLargeMesh.perf.test.ts` (`npm run test:perf`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PRINTER_PROFILES, type MeshData } from '../../types/kura';
import { parseModelFile } from '../io/modelImport';
import { createPrimitiveMesh } from '../index';
import { hollowMeshDetailed } from '../hollow';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { analyzePrintability } from '../printability';
import { normalizeMeshToBed } from '../primitives';
import { makeObject } from './geometryTestUtils';

const bed = DEFAULT_PRINTER_PROFILES.find((p) => p.id === 'bambu-a1-mini')!;
type Wasm = Awaited<ReturnType<typeof initManifoldEngine>>;
let w: Wasm;
beforeAll(async () => { w = await initManifoldEngine(); });
const rep = (mesh: MeshData, minWall?: number) => analyzePrintability(makeObject('o', mesh), bed, 'pla_matte', 20, 45, minWall);
const thin = (r: { issues: { code: string }[] }) => r.issues.some((i) => i.code === 'THIN_WALL');
const fromM = (m: Manifold) => { const x = normalizeMeshToBed(manifoldToMeshData(m)); m.delete(); return x; };
const out: string[] = [];

describe('pared delgada: sólidos macizos (no deben avisar)', () => {
  it('cono macizo r30 h60', async () => {
    const r = rep(await createPrimitiveMesh('cone', { radius: 30, height: 60, segments: 64 }));
    out.push(`cono: thin=${thin(r)} pct=${r.thinWallAreaPercent.toFixed(2)} min=${r.minWallThicknessMm}`);
    expect(thin(r)).toBe(false);
  });
  it('cápsula r20 largo 100', () => {
    const cyl = w.Manifold.cylinder(60, 20, 20, 64).rotate([-90, 0, 0]).translate([0, 20, 0]);
    const s1 = w.Manifold.sphere(20, 64).translate([0, 20, 0]);
    const s2 = w.Manifold.sphere(20, 64).translate([0, 80, 0]);
    const cap = w.Manifold.union([cyl, s1, s2]);
    [cyl, s1, s2].forEach((x) => x.delete());
    const r = rep(fromM(cap));
    out.push(`capsula: thin=${thin(r)} pct=${r.thinWallAreaPercent.toFixed(2)} min=${r.minWallThicknessMm}`);
    expect(thin(r)).toBe(false);
  });
  for (const seg of [8, 256]) {
    it(`cilindro macizo r20 h40 con ${seg} lados`, async () => {
      const r = rep(await createPrimitiveMesh('cylinder', { radius: 20, height: 40, segments: seg }));
      out.push(`cil${seg}: thin=${thin(r)} pct=${r.thinWallAreaPercent.toFixed(2)} min=${r.minWallThicknessMm}`);
      expect(thin(r)).toBe(false);
    });
  }
  it('cilindro fino macizo r2 h40 con 256 lados (diámetro 4 mm: no es pared delgada, es pieza fina)', async () => {
    const r = rep(await createPrimitiveMesh('cylinder', { radius: 2, height: 40, segments: 256 }));
    out.push(`cilfino: thin=${thin(r)} pct=${r.thinWallAreaPercent.toFixed(2)} min=${r.minWallThicknessMm}`);
    expect(thin(r)).toBe(false);
  });
});

describe('pared delgada: paredes realmente delgadas (deben medirse)', () => {
  it('pieza ahuecada con el motor, pared 1,2: mide ≈1,2 y avisa solo con mínimo 2', async () => {
    const solid = makeObject('s', await createPrimitiveMesh('box', { width: 60, height: 40, depth: 40 }));
    const h = await hollowMeshDetailed(solid, { enabled: true, wallThickness: 1.2 });
    const r1 = rep(h.mesh);
    const r2 = rep(h.mesh, 2);
    out.push(`ahuecada1.2: min=${r1.minWallThicknessMm} thin(0.8)=${thin(r1)} thin(2)=${thin(r2)} pct2=${r2.thinWallAreaPercent.toFixed(1)}`);
    expect(r1.minWallThicknessMm!).toBeGreaterThan(1.0);
    expect(r1.minWallThicknessMm!).toBeLessThan(1.4);
    expect(thin(r1)).toBe(false);
    expect(thin(r2)).toBe(true);
  });
  it('pieza ahuecada curva (esfera r30 con pared 1,2)', async () => {
    const solid = makeObject('s', await createPrimitiveMesh('sphere', { radius: 30, segments: 96 }));
    const h = await hollowMeshDetailed(solid, { enabled: true, wallThickness: 1.2 });
    const r2 = rep(h.mesh, 2);
    out.push(`esfera-hueca1.2: min=${r2.minWallThicknessMm} thin(2)=${thin(r2)}`);
    expect(thin(r2)).toBe(true);
  });
  it('texto 3D fino (fuente 10 mm): sin aviso con 0,8 mínimo (trazos ~1,5 mm) y aviso con 3', async () => {
    const m = await createPrimitiveMesh('text', { text: 'Ilíl', fontSize: 10, depth: 2 });
    const r1 = rep(m);
    const r3 = rep(m, 3);
    out.push(`texto: min=${r1.minWallThicknessMm} thin(0.8)=${thin(r1)} thin(3)=${thin(r3)}`);
    expect(thin(r3)).toBe(true);
  });
  it('placa 100×100×3 con un nervio de 0,5 mm y 30 de alto: avisa', () => {
    const plate = w.Manifold.cube([100, 3, 100], false).translate([-50, 0, -50]);
    const rib = w.Manifold.cube([100, 30, 0.5], false).translate([-50, 3, -0.25]);
    const u = w.Manifold.union([plate, rib]);
    [plate, rib].forEach((x) => x.delete());
    const r = rep(fromM(u));
    out.push(`nervio0.5: min=${r.minWallThicknessMm} thin=${thin(r)} pct=${r.thinWallAreaPercent.toFixed(2)}`);
    expect(thin(r)).toBe(true);
    expect(r.minWallThicknessMm!).toBeLessThan(0.7);
  });
  it('lámina de 0,3 mm de 100×100: avisa', () => {
    const r = rep(fromM(w.Manifold.cube([100, 0.3, 100], false)));
    out.push(`lamina0.3: min=${r.minWallThicknessMm} thin=${thin(r)}`);
    expect(thin(r)).toBe(true);
  });
});

function binaryStl(mesh: MeshData, invert: boolean): ArrayBuffer {
  const n = mesh.indices.length / 3;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50;
    const ids = [mesh.indices[t * 3], mesh.indices[t * 3 + 1], mesh.indices[t * 3 + 2]];
    if (invert) ids.reverse();
    for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) dv.setFloat32(o + 12 + k * 12 + c * 4, mesh.positions[ids[k] * 3 + c], true);
  }
  return buf;
}

describe('STL con normales invertidas y malla enorme', () => {
  it('STL de una caja hueca (pared 2) con triángulos al revés: avisa de normales y no confunde la pared', async () => {
    const solid = makeObject('s', await createPrimitiveMesh('box', { width: 50, height: 30, depth: 30 }));
    const h = await hollowMeshDetailed(solid, { enabled: true, wallThickness: 2 });
    const model = parseModelFile('invertida.stl', binaryStl(h.mesh, true));
    const mesh = model.parts[0].mesh;
    const r = rep(mesh, 3);
    const ok = rep(h.mesh, 3);
    out.push(`invertida: normalsInverted=${r.normalsInverted} min=${r.minWallThicknessMm} thin(3)=${thin(r)} | ok: min=${ok.minWallThicknessMm} thin=${thin(ok)}`);
    expect(r.minWallThicknessMm! > 0).toBe(true);
    expect(r.minWallThicknessMm!).toBeGreaterThan(1.7);
    expect(r.minWallThicknessMm!).toBeLessThan(2.3);
    expect(thin(r)).toBe(true);
  });
  it('malla hueca con triángulos al revés SIN pasar por el importador: avisa de normales y mide ≈2', async () => {
    const solid = makeObject('s', await createPrimitiveMesh('box', { width: 50, height: 30, depth: 30 }));
    const h = await hollowMeshDetailed(solid, { enabled: true, wallThickness: 2 });
    const inv = { ...h.mesh, indices: Uint32Array.from(h.mesh.indices) };
    for (let t = 0; t < inv.indices.length; t += 3) { const a = inv.indices[t + 1]; inv.indices[t + 1] = inv.indices[t + 2]; inv.indices[t + 2] = a; }
    const r = rep(inv, 3);
    out.push(`invertida-directa: normalsInverted=${r.normalsInverted} min=${r.minWallThicknessMm} thin(3)=${thin(r)}`);
    expect(r.normalsInverted).toBe(true);
    expect(r.minWallThicknessMm!).toBeGreaterThan(1.7);
    expect(r.minWallThicknessMm!).toBeLessThan(2.3);
    expect(thin(r)).toBe(true);
  });
  it('STL macizo invertido (esfera): sin aviso de pared delgada', async () => {
    const m = await createPrimitiveMesh('sphere', { radius: 25, segments: 64 });
    const model = parseModelFile('esfera-inv.stl', binaryStl(m, true));
    const r = rep(model.parts[0].mesh);
    out.push(`esfera-inv: inv=${r.normalsInverted} thin=${thin(r)} min=${r.minWallThicknessMm}`);
    expect(thin(r)).toBe(false);
  });
  // La malla de ~200 mil triángulos con tope de 15 s vive en thinWallLargeMesh.perf.test.ts.
  it('resumen', () => { console.info('QA5-PRINT\n' + out.join('\n')); });
});
