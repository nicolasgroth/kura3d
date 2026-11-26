/**
 * @file src/engine/__tests__/splitPipeModels.test.ts
 * @description QA ronda 5 de "dividir para imprimir" con modelos propios (T horizontal, L con codo
 * toroidal, tubos de pared 2 y 12, cruz, cono hueco, mezcla maciza/delgada, peine de brazos finos) con
 * camas de 250 y 256. Las pruebas `it.fails` documentan brechas CONFIRMADAS (pasan mientras el defecto
 * exista; al corregirlo fallarán y hay que quitarles `.fails`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../manifoldKernel';
import { executeBedSplitGeometry, planBedSplit } from '../split';
import * as H from './splitModelHarness';

let w: Awaited<ReturnType<typeof initManifoldEngine>>;
beforeAll(async () => {
  w = await initManifoldEngine();
});
const dowel = { type: 'dowel' as const, size: 4, depth: 10, tolerance: 0.2, count: 2 };
const lap = { type: 'lap' as const, size: 4, depth: 6, tolerance: 0.2, count: 1, lapHeightMm: 6 };

/** Invariantes de toda división (sin tocar uniones ni aristas). */
function core(r: H.Row) {
  expect(r.err).toBeUndefined();
  expect(r.fitFail, 'piezas que no caben').toBe(0);
  expect(r.multiBody, 'piezas con más de un cuerpo').toBe(0);
  expect(r.volErrPct, 'volumen no conservado (%)').toBeLessThan(0.01);
  expect(r.interferenceMm3, 'interferencia al rearmar').toBeLessThan(0.1);
  expect(r.strips, 'tiras < 8 mm').toBe(0);
  expect(r.markBothPct).toBe(100);
}

describe('dividir: tuberías de pared delgada con conector por defecto (glue)', () => {
  const cases: Array<[string, () => import('manifold-3d').Manifold]> = [
    ['T horizontal pared 4', () => H.modelT(w, 4)],
    ['L con codo toroidal pared 3', () => H.modelL(w, 3)],
    ['tubo recto pared 2', () => H.modelStraight(w, 2)],
    ['cruz pared 3', () => H.modelCross(w, 3)],
    ['cono hueco pared 3', () => H.modelCone(w)],
  ];
  for (const bed of [250, 256]) {
    for (const [name, mk] of cases) {
      it(`${name}, cama ${bed}: uniones para pegar con marca en ambas piezas`, async () => {
        const { row } = await H.measure(w, mk(), name, bed, { connector: dowel }, {}, 'glue');
        core(row);
        expect(row.gluePct).toBe(100);
        expect(row.unpaired).toBe(0);
        expect(row.warnings).toContain('SPLIT_JOINT_GLUE_ONLY');
      }, 120_000);
    }
    it(`tubo recto pared 12, cama ${bed}: todas las uniones con conector`, async () => {
      const { row } = await H.measure(w, H.modelStraight(w, 12), 'tubo12', bed, { connector: dowel }, {}, 'dowel');
      core(row);
      expect(row.connectorPct).toBe(100);
      expect(row.unpaired).toBe(0);
    }, 120_000);
  }
  it('margen 0 deja al menos 1 mm por lado y allowDiagonal informa el margen real', async () => {
    const obj = H.objFromM(H.modelStraight(w, 12), 'tubo12');
    const plan = await planBedSplit(obj, { widthMm: 250, depthMm: 250, heightMm: 250 }, { marginMm: 0, connector: dowel });
    expect(plan.usableMm.every((u) => u <= 248 + 1e-9)).toBe(true);
    const bar = H.objFromM(w.Manifold.cube([300, 20, 20], false), 'barra');
    const diag = await planBedSplit(bar, { widthMm: 250, depthMm: 250, heightMm: 250 }, { allowDiagonal: true, connector: dowel });
    expect(diag.pieces.length).toBe(1);
    expect(diag.pieces[0].diagonal).toBe(true);
    expect(diag.pieces[0].bedMarginMm).toBeGreaterThan(5);
  });
});

describe('dividir: mezcla maciza/delgada y brazos finos', () => {
  const mixedOpts = { connector: dowel, planePositions: { x: [-200, 0, 200] } };
  it('anillo delgado + varilla maciza en la misma sección: la unión es connector y la marca existe', async () => {
    const { row, res } = await H.measure(w, H.modelMixed(w, -110), 'mixta', 250, mixedOpts, {}, 'mixta');
    core(row);
    const mixed = res!.joints.find((j) => j.a.code === 'A1' && j.b.code === 'B1')!;
    expect(mixed.kind).toBe('connector');
    expect(mixed.labelEngraved).toBe(true);
  }, 60_000);
  // Antes la isla delgada de una unión 'connector' quedaba pegada sin avisar: ahora aviso parcial por unión.
  it('una unión mixta con isla delgada sin conector avisa que esa parte es solo para pegar', async () => {
    const { res } = await H.measure(w, H.modelMixed(w, -110), 'mixta', 250, mixedOpts, {}, 'mixta');
    const j = res!.joints.find((q) => q.a.code === 'A1' && q.b.code === 'B1')!;
    expect(res!.warnings.some((x) => x.code === 'SPLIT_JOINT_PARTIAL_GLUE' && x.params.label === j.label)).toBe(true);
  }, 60_000);
  it('peine de brazos de 4 mm con cama 100: sin aristas sueltas, un cuerpo, y las marcas omitidas se avisan', async () => {
    const { row } = await H.measure(w, H.modelComb(w), 'peine', 100, { connector: dowel }, {}, 'peine');
    expect(row.unpaired).toBe(0);
    expect(row.multiBody).toBe(0);
    expect(row.volErrPct).toBeLessThan(0.01);
    if (row.markBothPct < 100) expect(row.warnings).toContain('SPLIT_LABEL_SKIPPED');
  }, 60_000);
  // La marca de pareja va SIEMPRE: en brazos de 4 mm, donde no cabe texto, va la marca mínima de puntos.
  it('peine de brazos de 4 mm con cama 100: todas las uniones con marca en ambas piezas', async () => {
    const { row } = await H.measure(w, H.modelComb(w), 'peine', 100, { connector: dowel }, {}, 'peine');
    expect(row.markBothPct).toBe(100);
  }, 60_000);
});

describe('dividir: solape de borde (lap)', () => {
  it('T horizontal con lap: solape en todas, sin interferencia, holgura > 0, 0 aristas sueltas', async () => {
    const { row } = await H.measure(w, H.modelT(w, 4), 'T', 250, { connector: lap }, {}, 'lap');
    core(row);
    expect(row.lapPct).toBe(100);
    expect(row.lapNoClear).toBe(0);
    expect(row.unpaired).toBe(0);
  }, 60_000);
  it('lengüeta imprimible (>= 0,8 mm) en pared de 3 mm', async () => {
    const { res } = await H.measure(w, H.modelStraight(w, 3), 'tubo3', 250, { connector: lap }, {}, 'lap');
    for (const j of res!.joints) expect(j.lap!.tongueMm).toBeGreaterThanOrEqual(0.8);
  }, 60_000);
  // Con pared de 2 mm la lengüeta mediría 0,67 mm y la pared de la ranura 0,47 mm (< 0,8 mm): cae a pegar con aviso.
  it('lengüeta imprimible (>= 0,8 mm) en pared de 2 mm (o caer a pegar)', async () => {
    const { res } = await H.measure(w, H.modelStraight(w, 2), 'tubo2', 250, { connector: lap }, {}, 'lap');
    for (const j of res!.joints) if (j.kind === 'lap') expect(j.lap!.tongueMm).toBeGreaterThanOrEqual(0.8);
    expect(res!.joints.every((j) => j.kind === 'glue')).toBe(true);
    expect(res!.warnings.some((x) => x.code === 'SPLIT_LAP_NOT_PRINTABLE')).toBe(true);
  }, 60_000);
  // Antes: el codo toroidal con lap dejaba 4 aristas dobles por pieza (corona del tubo, y = 75).
  it('L con codo toroidal y lap: 0 aristas no pareadas', async () => {
    const { row } = await H.measure(w, H.modelL(w, 3), 'L', 250, { connector: lap }, { labels: 'none' }, 'lap');
    expect(row.unpaired).toBe(0);
  }, 60_000);
  // Antes: el cono hueco con lap dejaba ~84-92 aristas no pareadas por pieza (triángulos degenerados).
  it('cono hueco con lap: 0 aristas no pareadas', async () => {
    const { row } = await H.measure(w, H.modelCone(w), 'cono', 250, { connector: lap }, {}, 'lap');
    expect(row.unpaired).toBe(0);
  }, 60_000);
});

describe('dividir: marca por fuera', () => {
  it('la marca grabada (0,4 mm) en pared de 2 mm es superficial', async () => {
    const obj = H.objFromM(H.modelStraight(w, 2), 'tubo2');
    const plan = await planBedSplit(obj, { widthMm: 250, depthMm: 250, heightMm: 250 }, { connector: dowel });
    const lab = await executeBedSplitGeometry(obj, plan, { labels: 'engraved' });
    expect(lab.engravedVolumeMm3).toBeGreaterThan(0);
    // Volumen grabado por marca: muy por debajo del que quitaría atravesar la pared
    expect(lab.engravedVolumeMm3 / lab.joints.length / 2).toBeLessThan(30);
  }, 60_000);
  // Con profundidad 3 (dentro del rango permitido) en pared de 2 mm la marca se limita a 0,4 · 2 = 0,8 mm
  // y se avisa (SPLIT_LABEL_DEPTH_CLAMPED).
  it('profundidad de marca mayor que la pared: avisa o se recorta', async () => {
    const obj = H.objFromM(H.modelStraight(w, 2), 'tubo2');
    const plan = await planBedSplit(obj, { widthMm: 250, depthMm: 250, heightMm: 250 }, { connector: dowel });
    const a = await executeBedSplitGeometry(obj, plan, { labels: 'engraved', labelDepthMm: 1.5 });
    const b = await executeBedSplitGeometry(obj, plan, { labels: 'engraved', labelDepthMm: 3 });
    const extra = b.warnings.filter((x) => x.code.startsWith('SPLIT_LABEL')).length;
    expect(extra > 0 || b.engravedVolumeMm3 <= a.engravedVolumeMm3 * 1.1).toBe(true);
    expect(b.warnings.some((x) => x.code === 'SPLIT_LABEL_DEPTH_CLAMPED' && Number(x.params.depth) <= 0.8 + 1e-6)).toBe(true);
  }, 60_000);
});
