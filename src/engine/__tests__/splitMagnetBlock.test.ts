/**
 * @file src/engine/__tests__/splitMagnetBlock.test.ts
 * @description Imanes cuadrados y rectangulares como unión del corte, con el motor real: pares enfrentados y coaxiales
 * con la misma orientación en las dos piezas, volumen quitado = huecos ±1 %, piezas cerradas de un cuerpo, el largo
 * del rectángulo a lo largo de la dirección larga de la sección (también oblicua), sección chica → para pegar con
 * aviso, y la marca de pareja sin solaparse con ningún alojamiento. Los huecos se miden en el armado:
 * (sólido original ∩ lado de la pieza) − pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { SceneObject, Vec3 } from '../../types/kura';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { applyTransformToMesh } from '../primitives';
import { executeBedSplitGeometry, planBedSplit, type BedSplitResult, type SplitJoint } from '../split';
import { magnetConnector } from '../split/splitMagnet';
import { MAGNET_DEFAULTS, pocketDims, pocketSectionArea, type MagnetParams } from '../../core/addons/magnetPocket';
import { objFromM } from './splitModelHarness';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const SQUARE: MagnetParams = { ...MAGNET_DEFAULTS, shape: 'square', sizeMm: 5, heightMm: 2 };
const RECT: MagnetParams = { ...MAGNET_DEFAULTS, shape: 'rect', sizeMm: 10, widthMm: 5, heightMm: 2 };
const AX = { x: 0, y: 1, z: 2 } as const;
const BED = { widthMm: 200, depthMm: 200, heightMm: 50 };

function partWorld(res: BedSplitResult, i: number): Manifold {
  const p = res.parts[i];
  return meshDataToManifold(w, applyTransformToMesh(p.mesh, p.assembly.position, p.assembly.rotation, [1, 1, 1]));
}
const sourceOf = (obj: SceneObject) => meshDataToManifold(w, applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale));

/** Huella del hueco de la pieza `part` junto al centro `c` en el plano (sección del vacío a media profundidad). */
function pocketSection(source: Manifold, res: BedSplitResult, part: number, j: SplitJoint, sign: 1 | -1, c: Vec3, depthMm: number) {
  const a = AX[j.axis];
  const reach = 12;
  const lo: Vec3 = [c[0] - reach, c[1] - reach, c[2] - reach];
  const size: Vec3 = [2 * reach, 2 * reach, 2 * reach];
  lo[a] = sign > 0 ? j.position + 1e-3 : j.position - depthMm + 1e-3;
  size[a] = depthMm - 2e-3;
  const box = w.Manifold.cube(size, false).translate(lo);
  const pw = partWorld(res, part);
  const v = source.intersect(box).subtract(pw);
  const bb = v.boundingBox();
  const volume = v.volume();
  // Ancho del vacío medido en las diagonales de la cara: distingue el rectángulo girado del alineado.
  [box, pw, v].forEach((m) => m.delete());
  return { volume, lo: bb.min as Vec3, hi: bb.max as Vec3 };
}

/** Comprueba que cada centro tiene dos huecos enfrentados con la misma huella (coaxiales y con la misma orientación). */
function checkBlockPairs(obj: SceneObject, res: BedSplitResult, j: SplitJoint, m: MagnetParams) {
  const dims = pocketDims(m);
  const source = sourceOf(obj);
  const a = AX[j.axis];
  const out: Array<{ lo: Vec3; hi: Vec3 }> = [];
  for (const c of j.connectorCenters) {
    const low = pocketSection(source, res, j.a.part, j, -1, c, dims.depthMm);
    const high = pocketSection(source, res, j.b.part, j, 1, c, dims.depthMm);
    const expected = pocketSectionArea(dims) * (dims.depthMm - 2e-3);
    expect(Math.abs(low.volume - expected) / expected, `hueco bajo en ${c}`).toBeLessThan(0.01);
    expect(Math.abs(high.volume - expected) / expected, `hueco alto en ${c}`).toBeLessThan(0.01);
    // Misma huella en el plano (mismo centro y misma caja envolvente → misma orientación) en las dos piezas.
    for (let k = 0; k < 3; k++) {
      if (k === a) continue;
      expect(Math.abs(low.lo[k] - high.lo[k])).toBeLessThan(0.01);
      expect(Math.abs(low.hi[k] - high.hi[k])).toBeLessThan(0.01);
      expect(Math.abs((low.lo[k] + low.hi[k]) / 2 - c[k])).toBeLessThan(0.01);
    }
    out.push(high);
  }
  source.delete();
  return out;
}

const removedVolume = (res: BedSplitResult) => res.sourceVolumeMm3 - res.parts.reduce((s, p) => s + p.volumeMm3, 0);

describe('imanes cuadrados y rectangulares en la unión', () => {
  it('cuadrado 5 × 5 × 2 en un bloque 60 × 60 × 30: pares enfrentados, volumen = n × 5,2² × 2,2 ±1 %, piezas cerradas', async () => {
    const obj = objFromM(w.Manifold.cube([60, 60, 30], true), 'bloque');
    const plan = await planBedSplit(obj, BED, { connector: magnetConnector(SQUARE, 'auto'), axes: ['y'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan);
    expect(res.parts).toHaveLength(2);
    const j = res.joints[0];
    console.info(`cuadrado: ${j.connectorCenters.length} pares, ${j.strength?.level}, avisos ${res.warnings.map((x) => x.code).join(',')}`);
    expect(j.kind).toBe('connector');
    expect(j.connectorCenters.length).toBeGreaterThanOrEqual(2);
    expect(res.warnings.map((x) => x.code)).not.toContain('SPLIT_MAGNET_NO_ROOM');
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
    for (const p of res.parts) expect(meshDataToManifold(w, p.mesh).decompose().length).toBe(1);
    const dims = pocketDims(SQUARE);
    const pockets = 2 * j.connectorCenters.length * 5.2 * 5.2 * 2.2;
    expect(pocketSectionArea(dims) * dims.depthMm * 2 * j.connectorCenters.length).toBeCloseTo(pockets, 6);
    expect(Math.abs(removedVolume(res) - pockets) / pockets).toBeLessThan(0.01);
    checkBlockPairs(obj, res, j, SQUARE);
    expect(j.magnets?.magnet).toMatchObject({ shape: 'square', sizeMm: 5 });
    // Fuerza con el área real (25 mm² por imán), no la de un círculo.
    expect(j.strength!.areaRatio).toBeCloseTo((j.connectorCenters.length * 25) / 1800, 4);
  }, 90_000);

  it('rectangular 10 × 5 × 2 en una barra 300 × 40 × 40: largo a lo largo de la sección y piezas cerradas', async () => {
    const obj = objFromM(w.Manifold.cube([300, 40, 40], true), 'barra');
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 50 }, { connector: magnetConnector(RECT, 'auto'), axes: ['x'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan);
    expect(res.parts.length).toBeGreaterThanOrEqual(2);
    for (const j of res.joints) {
      console.info(`rect barra: unión ${j.label} ${j.connectorCenters.length} pares, ${j.strength?.level}`);
      expect(j.kind).toBe('connector');
      expect(j.connectorCenters.length).toBeGreaterThanOrEqual(2);
      const found = checkBlockPairs(obj, res, j, RECT);
      const dims = pocketDims(RECT);
      // Sección cuadrada: el rectángulo alineado con los ejes de la sección (10,2 en un sentido y 5,2 en el otro).
      for (const f of found) {
        const spans = [1, 2].map((k) => f.hi[k] - f.lo[k]).sort((p, q) => p - q);
        expect(spans[0]).toBeCloseTo(dims.crossMm, 1);
        expect(spans[1]).toBeCloseTo(dims.widthMm, 1);
      }
    }
    const pairs = res.joints.reduce((s, j) => s + j.connectorCenters.length, 0);
    const pockets = 2 * pairs * 10.2 * 5.2 * 2.2;
    expect(Math.abs(removedVolume(res) - pockets) / pockets).toBeLessThan(0.01);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
  }, 120_000);

  it('rectangular en una sección oblicua (caja 24 × 100 × 80 girada 30°): el largo sigue la dirección larga de la sección', async () => {
    const raw = w.Manifold.cube([24, 100, 80], true);
    const obj = objFromM(raw.rotate([0, 30, 0]), 'girada');
    raw.delete();
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 60 }, { connector: magnetConnector(RECT, 'auto'), axes: ['y'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan);
    const j = res.joints[0];
    console.info(`rect oblicua: ${j.connectorCenters.length} pares, ${j.strength?.level}, avisos ${res.warnings.map((x) => x.code).join(',')}`);
    expect(j.kind).toBe('connector');
    expect(j.connectorCenters.length).toBeGreaterThanOrEqual(2);
    checkBlockPairs(obj, res, j, RECT);
    // El largo a 30° (dirección larga de la sección): la caja envolvente del hueco en X-Z es la del rectángulo girado.
    const dims = pocketDims(RECT);
    const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
    const spanA = dims.widthMm * s + dims.crossMm * c;
    const spanB = dims.widthMm * c + dims.crossMm * s;
    const source = sourceOf(obj);
    const f = pocketSection(source, res, j.b.part, j, 1, j.connectorCenters[0], dims.depthMm);
    source.delete();
    const spans = [f.hi[0] - f.lo[0], f.hi[2] - f.lo[2]].sort((p, q) => p - q);
    expect(spans[0]).toBeCloseTo(Math.min(spanA, spanB), 1);
    expect(spans[1]).toBeCloseTo(Math.max(spanA, spanB), 1);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
  }, 90_000);

  it('sección demasiado chica para el rectángulo (barra 9 × 9): queda para pegar con aviso', async () => {
    const obj = objFromM(w.Manifold.cube([9, 80, 9], true), 'barra');
    const plan = await planBedSplit(obj, BED, { connector: magnetConnector(RECT, 'auto'), axes: ['y'], allowRotation: false, minFragmentMm3: 0 });
    const res = await executeBedSplitGeometry(obj, plan, { minFragmentMm3: 0 });
    expect(res.joints[0].kind).toBe('glue');
    const warn = res.warnings.find((x) => x.code === 'SPLIT_MAGNET_NO_ROOM_BLOCK');
    expect(warn?.params).toMatchObject({ label: '1', length: 10, width: 5, height: 2 });
    expect(res.warnings.map((x) => x.code)).not.toContain('SPLIT_MAGNET_SQUARE');
  }, 60_000);

  it('la marca de pareja grabada no se solapa con ningún alojamiento rectangular', async () => {
    const obj = objFromM(w.Manifold.cube([60, 60, 30], true), 'bloque');
    const plan = await planBedSplit(obj, BED, { connector: magnetConnector(RECT, 'auto'), axes: ['y'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan, { labels: 'engraved', labelPlacement: 'joint', labelDepthMm: 0.4 });
    const j = res.joints[0];
    expect(j.kind).toBe('connector');
    expect(j.labelPlacement).toBe('joint');
    const dims = pocketDims(RECT);
    const pockets = 2 * j.connectorCenters.length * pocketSectionArea(dims) * dims.depthMm;
    const expected = pockets + res.engravedVolumeMm3;
    expect(Math.abs(removedVolume(res) - expected) / expected).toBeLessThan(0.005);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
  }, 90_000);
});
