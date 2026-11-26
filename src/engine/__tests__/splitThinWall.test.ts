/**
 * @file src/engine/__tests__/splitThinWall.test.ts
 * @description Pruebas medidas de "dividir para imprimir" en pared delgada (tuberías en L y en T de
 * 1 m, tubo Ø1000), uniones sin contacto real (dos columnas), cuerpos sueltos (estatua con brazo
 * fino), errores con el parámetro culpable y tope de piezas automático. Criterio: por defecto toda
 * unión de pared delgada queda para pegar (con aviso) y con `lap` lleva solape; siempre marca en
 * ambas piezas, piezas de un cuerpo, 0 aristas sueltas, sin interferencia y volumen conservado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../manifoldKernel';
import {
  executeBedSplitGeometry,
  planBedSplit,
  type BedSplitResult,
  type SplitBed,
  type SplitConnectorOptions,
  type SplitJointKind,
} from '../split';
import { bigTube, checkAllParts, lPipe, objFrom, tPipe, twoColumns } from './splitPipeShapes';

type Wasm = Awaited<ReturnType<typeof initManifoldEngine>>;
let wasm: Wasm;
const BED: SplitBed = { widthMm: 250, depthMm: 250, heightMm: 250 };

beforeAll(async () => {
  wasm = await initManifoldEngine();
});

/** Toda unión del tipo esperado, con su aviso si es para pegar, y marca grabada en ambas piezas. */
function checkJoints(res: BedSplitResult, kind: SplitJointKind) {
  expect(res.joints.filter((j) => j.kind !== kind).map((j) => `${j.label}:${j.kind}`)).toEqual([]);
  expect(res.joints.filter((j) => !j.labelEngraved).map((j) => j.label)).toEqual([]);
  if (kind === 'glue') {
    const warned = new Set(res.warnings.filter((w) => w.code === 'SPLIT_JOINT_GLUE_ONLY').map((w) => w.params.label));
    expect(res.joints.every((j) => warned.has(j.label))).toBe(true);
    expect(res.glueJoints).toBe(res.joints.length);
    expect(res.warnings.some((w) => w.code === 'SPLIT_GLUE_SUMMARY')).toBe(true);
  }
  if (kind === 'lap') {
    for (const j of res.joints) {
      expect(j.lap!.heightMm).toBeCloseTo(6, 6);
      expect(j.lap!.clearanceMm).toBeGreaterThan(0);
    }
    expect(res.clearanceVolumeMm3).toBeGreaterThan(0);
  }
}

const LAP: SplitConnectorOptions = { type: 'lap', size: 4, depth: 6, tolerance: 0.2, count: 1, lapHeightMm: 6 };

async function run(m: Manifold, name: string, connector?: SplitConnectorOptions) {
  const obj = objFrom(m, name);
  const plan = await planBedSplit(obj, BED, { maxPieces: 'auto', ...(connector ? { connector } : {}) });
  const res = await executeBedSplitGeometry(obj, plan, { labels: 'engraved' });
  const outside = res.joints.filter((j) => j.labelPlacement === 'outside').length;
  console.info(
    `[split] ${name}${connector ? ' (solape)' : ''}: plan ${plan.elapsedMs.toFixed(0)} ms, ejecución ${res.elapsedMs.toFixed(0)} ms, ` +
      `${res.parts.length} piezas, ${res.joints.length} uniones (${res.glueJoints} para pegar), ${outside} marcas por fuera`,
  );
  return { obj, plan, res };
}

describe('dividir tuberías de pared delgada', () => {
  it('tubería en L de 1 m, Ø150, pared 5: por defecto uniones para pegar con marca; con lap, solape en todas', async () => {
    const { plan, res } = await run(lPipe(wasm, 150, 5), 'L');
    expect(plan.counts.z).toBe(1);
    expect(res.joints.length).toBeGreaterThan(0);
    checkJoints(res, 'glue');
    checkAllParts(wasm, res);
    const lap = await run(lPipe(wasm, 150, 5), 'L', LAP);
    checkJoints(lap.res, 'lap');
    checkAllParts(wasm, lap.res);
  }, 120_000);

  it('tubería en T de 1 m, Ø150, pared 4: los planos no parten el tubo vertical a lo largo', async () => {
    const { plan, res } = await run(tPipe(wasm, 150, 4), 'T');
    // Ningún plano X cae dentro del tubo vertical (|x| < 75 + margen) pudiendo quedarse fuera
    for (const p of plan.planes.filter((q) => q.axis === 'x')) expect(Math.abs(p.position)).toBeGreaterThan(85);
    expect(plan.planes.every((p) => p.strips === 0)).toBe(true);
    checkJoints(res, 'glue');
    checkAllParts(wasm, res);
    const lap = await run(tPipe(wasm, 150, 4), 'T', LAP);
    checkJoints(lap.res, 'lap');
    checkAllParts(wasm, lap.res);
  }, 180_000);

  it('tubo Ø1000 × 1000, pared 4: tope automático, unión clasificada y marca en todas', async () => {
    const { plan, res } = await run(bigTube(wasm, 1000, 1000, 4), 'tubo1000');
    expect(plan.pieces.length).toBeGreaterThan(64);
    checkJoints(res, 'glue');
    checkAllParts(wasm, res);
    const lap = await run(bigTube(wasm, 1000, 1000, 4), 'tubo1000', LAP);
    checkJoints(lap.res, 'lap');
    checkAllParts(wasm, lap.res);
  }, 400_000);
});

describe('uniones reales y cuerpos sueltos', () => {
  it('dos columnas separadas: ninguna unión entre piezas que no se tocan', async () => {
    const obj = objFrom(twoColumns(wasm), 'columnas');
    const plan = await planBedSplit(obj, { widthMm: 150, depthMm: 250, heightMm: 250 }, { axes: ['x', 'y'], planePositions: { x: [-15] } });
    const res = await executeBedSplitGeometry(obj, plan, { labels: 'engraved' });
    // El plano X cae en el hueco: las columnas no se tocan, solo hay uniones en Y
    expect(res.joints.filter((j) => j.axis === 'x')).toEqual([]);
    checkAllParts(wasm, res, 240);
  }, 60_000);

  it('una celda con dos cuerpos se separa en piezas propias y el fragmento diminuto se fusiona', async () => {
    // Bloque con un brazo fino que cruza el plano y vuelve: la celda alta tiene el cuerpo y un trozo
    const block = wasm.Manifold.cube([150, 400, 150], false).translate([-75, 0, -75]);
    // Brazo separado 10 mm del bloque, unido a él solo por un puente abajo
    const bridge = wasm.Manifold.cube([12, 10, 10], false).translate([74, 0, 0]);
    const arm = wasm.Manifold.cube([10, 230, 10], false).translate([85, 0, 0]);
    const tip = wasm.Manifold.cube([30, 10, 10], false).translate([85, 220, 0]);
    const statue = wasm.Manifold.union([block, bridge, arm, tip]);
    for (const h of [block, bridge, arm, tip]) h.delete();
    const obj = objFrom(statue, 'estatua');
    const plan = await planBedSplit(obj, BED, { axes: ['y'], planePositions: { y: [210] } });
    const res = await executeBedSplitGeometry(obj, plan, { labels: 'none', minFragmentMm3: 5000 });
    // La punta del brazo (sobre el plano, 30×10×10 + 10×… ) es un fragmento diminuto: se fusiona con
    // el brazo del lado bajo, que es la pieza con la que comparte cara.
    expect(res.parts.length).toBe(2);
    checkAllParts(wasm, res);
    // Sin fusión (umbral 0): el fragmento queda como pieza propia con código derivado
    const split = await executeBedSplitGeometry(obj, plan, { labels: 'none', minFragmentMm3: 0 });
    expect(split.parts.map((p) => p.code).sort()).toEqual(['A1', 'A2·1', 'A2·2']);
    checkAllParts(wasm, split);
  }, 60_000);
});

describe('errores y tope', () => {
  it('cama inválida nombra el parámetro culpable', async () => {
    const obj = objFrom(wasm.Manifold.cube([300, 100, 100], true), 'cubo');
    for (const bad of [0, -5, Number.NaN]) {
      await expect(planBedSplit(obj, { ...BED, widthMm: bad })).rejects.toMatchObject({ params: { name: 'bedWidthMm' } });
    }
    await expect(planBedSplit(obj, { ...BED, depthMm: 8 })).rejects.toMatchObject({ params: { name: 'marginMm' } });
  });

  it('supera el tope: el error dice cuántas piezas hacen falta; "auto" lo sube', async () => {
    const obj = objFrom(bigTube(wasm, 1000, 1000, 4, 64), 'tubo');
    const err = await planBedSplit(obj, BED).catch((e) => e);
    expect(err.code).toBe('SPLIT_TOO_MANY_PIECES');
    expect(err.params.needed).toBeGreaterThan(64);
    const plan = await planBedSplit(obj, BED, { maxPieces: 'auto' });
    expect(plan.pieces.length).toBe(err.params.needed);
  });

  it('ninguna pieza usa la cama al milímetro y el plan informa el margen real por pieza', async () => {
    const obj = objFrom(wasm.Manifold.cube([250, 600, 100], true), 'losa');
    const plan = await planBedSplit(obj, BED, { marginMm: 0 });
    for (const p of plan.pieces) expect(p.bedMarginMm).toBeGreaterThanOrEqual(1 - 1e-6);
    expect(plan.counts.x).toBe(2);
    const def = await planBedSplit(obj, BED);
    for (const p of def.pieces) expect(p.bedMarginMm).toBeGreaterThanOrEqual(5 - 1e-6);
  });

  it('allowDiagonal apoya en diagonal una pieza que así cabe sin cortar', async () => {
    const obj = objFrom(wasm.Manifold.cube([300, 50, 30], true), 'regla');
    const bed = { widthMm: 250, depthMm: 250, heightMm: 100 };
    const cut = await planBedSplit(obj, bed, { allowRotation: false });
    expect(cut.planes.length).toBeGreaterThan(0);
    const plan = await planBedSplit(obj, bed, { allowRotation: false, allowDiagonal: true });
    expect(plan.planes).toHaveLength(0);
    expect(plan.pieces[0].diagonal).toBe(true);
    expect(plan.pieces[0].bedMarginMm).toBeGreaterThan(0);
  });
});
