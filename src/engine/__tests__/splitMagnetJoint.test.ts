/**
 * @file src/engine/__tests__/splitMagnetJoint.test.ts
 * @description Unión con imanes en "dividir para imprimir" con el motor real: cada imán abre dos alojamientos
 * enfrentados (uno en cada pieza, coaxiales y con la boca en la cara del corte), piezas cerradas, volumen quitado
 * igual a los huecos, barra angosta sin imán (y con imán chico sí), un par por isla, corte en pieza girada y
 * varias uniones. Los huecos se miden en el armado: (sólido original ∩ lado de la pieza) − pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { SceneObject, Vec3 } from '../../types/kura';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { applyTransformToMesh } from '../primitives';
import { executeBedSplitGeometry, planBedSplit, type BedSplitResult, type SplitJoint } from '../split';
import { magnetConnector, MAGNET_POLARITY_NOTE } from '../split/splitMagnet';
import { MAGNET_DEFAULTS, pocketDims, pocketSectionArea } from '../../core/addons/magnetPocket';
import { BUILTIN_MAGNET_PRESETS } from '../../core/addons/magnetPresets';
import { objFromM } from './splitModelHarness';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const M5 = magnetConnector(MAGNET_DEFAULTS, 'auto');
const DIMS5 = pocketDims(MAGNET_DEFAULTS);
const AX = { x: 0, y: 1, z: 2 } as const;

/** Sólido mundial de una pieza en su posición de armado. */
function partWorld(res: BedSplitResult, i: number): Manifold {
  const p = res.parts[i];
  return meshDataToManifold(w, applyTransformToMesh(p.mesh, p.assembly.position, p.assembly.rotation, [1, 1, 1]));
}

/** Semiespacio del lado `sign` del plano de una unión (caja enorme). */
function half(j: SplitJoint, sign: 1 | -1): Manifold {
  const a = AX[j.axis];
  const lo: Vec3 = [-1e4, -1e4, -1e4];
  const size: Vec3 = [2e4, 2e4, 2e4];
  lo[a] = sign > 0 ? j.position : j.position - 1e4;
  size[a] = 1e4;
  return w.Manifold.cube(size, false).translate(lo);
}

interface Pocket { lo: Vec3; hi: Vec3; center: Vec3 }

/**
 * Huecos de la pieza `part` junto al plano de `j`: (original ∩ lado) − pieza, recortado a una caja alrededor de
 * cada centro (lado = hueco + 2 mm, más chica que hueco + pared: deja fuera las láminas numéricas de la superficie y
 * las piezas vecinas más allá del fondo).
 */
function pocketsNear(source: Manifold, res: BedSplitResult, part: number, j: SplitJoint, sign: 1 | -1, widthMm: number, depthMm: number): Pocket[] {
  const a = AX[j.axis];
  const side = half(j, sign);
  const region = source.intersect(side);
  const pw = partWorld(res, part);
  const voids = region.subtract(pw);
  const out: Pocket[] = [];
  for (const c of j.connectorCenters) {
    const halfSide = widthMm / 2 + 1;
    const lo: Vec3 = [c[0] - halfSide, c[1] - halfSide, c[2] - halfSide];
    const size: Vec3 = [2 * halfSide, 2 * halfSide, 2 * halfSide];
    // A lo largo del eje: 1 mm más que la profundidad esperada (un hueco más hondo se vería en la medida). Empieza
    // a 0,001 mm del plano: la cara de la pieza puede quedar a 1e-15 del plano y dejar una lámina de volumen nulo.
    lo[a] = sign > 0 ? j.position + 1e-3 : j.position - depthMm - 1;
    size[a] = depthMm + 1 - 1e-3;
    const box = w.Manifold.cube(size, false).translate(lo);
    const v = voids.intersect(box);
    if (v.volume() > 1) {
      const bb = v.boundingBox();
      const l = [...bb.min] as Vec3;
      const h = [...bb.max] as Vec3;
      out.push({ lo: l, hi: h, center: [(l[0] + h[0]) / 2, (l[1] + h[1]) / 2, (l[2] + h[2]) / 2] });
    }
    [box, v].forEach((m) => m.delete());
  }
  [side, region, pw, voids].forEach((m) => m.delete());
  return out;
}

/** Comprueba los pares enfrentados de una unión con imanes y devuelve cuántos pares encontró. */
function checkPairs(source: Manifold, res: BedSplitResult, j: SplitJoint, depthMm: number, widthMm: number): number {
  const a = AX[j.axis];
  const low = pocketsNear(source, res, j.a.part, j, -1, widthMm, depthMm);
  const high = pocketsNear(source, res, j.b.part, j, 1, widthMm, depthMm);
  expect(low).toHaveLength(j.connectorCenters.length);
  expect(high).toHaveLength(j.connectorCenters.length);
  for (const c of j.connectorCenters) {
    const near = (p: Pocket) => [0, 1, 2].every((k) => k === a || Math.abs(p.center[k] - c[k]) < 0.01);
    const l = low.find(near);
    const h = high.find(near);
    expect(l, `hueco bajo en ${c}`).toBeDefined();
    expect(h, `hueco alto en ${c}`).toBeDefined();
    // Coaxiales (±0,01 mm) y bocas que se tocan en el plano
    for (let k = 0; k < 3; k++) if (k !== a) expect(Math.abs(l!.center[k] - h!.center[k])).toBeLessThan(0.01);
    expect(Math.abs(l!.hi[a] - j.position)).toBeLessThan(0.01);
    expect(Math.abs(h!.lo[a] - j.position)).toBeLessThan(0.01);
    // Profundidad = alto + holgura en cada lado; diámetro ≥ imán + holgura
    expect(l!.hi[a] - l!.lo[a]).toBeCloseTo(depthMm, 2);
    expect(h!.hi[a] - h!.lo[a]).toBeCloseTo(depthMm, 2);
    for (let k = 0; k < 3; k++) {
      if (k === a) continue;
      expect(h!.hi[k] - h!.lo[k]).toBeGreaterThanOrEqual(widthMm - 1e-3);
      expect(h!.hi[k] - h!.lo[k]).toBeLessThan(widthMm + 0.05);
    }
  }
  return j.connectorCenters.length;
}

const sourceOf = (obj: SceneObject) => meshDataToManifold(w, applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale));

describe('unión con imanes', () => {
  it('bloque en dos: 2 pares coaxiales, piezas cerradas, volumen quitado = 4 huecos ±1 % y metadatos del imán', async () => {
    const obj = objFromM(w.Manifold.cube([40, 60, 30], true), 'bloque');
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 50 }, { connector: M5, axes: ['y'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan);
    expect(res.parts).toHaveLength(2);
    expect(res.joints).toHaveLength(1);
    const j = res.joints[0];
    expect(j.kind).toBe('connector');
    expect(j.connector?.type).toBe('magnet');
    expect(j.connectorCenters).toHaveLength(2);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
    const pocket = pocketSectionArea(DIMS5) * DIMS5.depthMm;
    const removed = res.sourceVolumeMm3 - res.parts.reduce((s, p) => s + p.volumeMm3, 0);
    expect(Math.abs(removed - 4 * pocket) / (4 * pocket)).toBeLessThan(0.01);
    expect(res.looseDowels).toEqual([]);
    // Metadatos: imán, cantidad, posiciones y polaridad
    expect(j.magnets).toMatchObject({ count: 2, polarity: 'opposite', pocketDepthMm: DIMS5.depthMm, pocketDiameterMm: DIMS5.widthMm });
    expect(j.magnets!.magnet).toMatchObject({ shape: 'round', sizeMm: 5, heightMm: 2 });
    expect(MAGNET_POLARITY_NOTE).toBe('splitMagnet.polarity');
    // Fuerza: 2 imanes de Ø5 en 1200 mm² ≈ 3,3 % → firme por la regla de imanes
    expect(j.strength).toMatchObject({ level: 'firm', basis: 'magnet', count: 2 });
    const source = sourceOf(obj);
    expect(checkPairs(source, res, j, DIMS5.depthMm, DIMS5.widthMm)).toBe(2);
    source.delete();
    // El armado no traba ni choca, y no restringe la dirección de entrada
    expect(res.assembly!.blocked).toEqual([]);
    expect(res.assembly!.clashes).toEqual([]);
  }, 60_000);

  it('barra 6 × 6: el 5 × 2 no cabe con su pared (sin imán y con aviso); el 3 × 1 incluido sí', async () => {
    const obj = objFromM(w.Manifold.cube([6, 80, 6], true), 'barra');
    const bed = { widthMm: 200, depthMm: 200, heightMm: 50 };
    // Piezas chicas (< 2000 mm³): sin fundir fragmentos para que haya uniones
    const plan = await planBedSplit(obj, bed, { connector: M5, axes: ['y'], allowRotation: false, minFragmentMm3: 0 });
    const res = await executeBedSplitGeometry(obj, plan, { minFragmentMm3: 0 });
    expect(res.joints[0].kind).toBe('glue');
    expect(res.warnings.some((x) => x.code === 'SPLIT_MAGNET_NO_ROOM' && x.params.label === '1')).toBe(true);
    const small = BUILTIN_MAGNET_PRESETS.find((p) => p.id === 'round-3x1')!;
    expect(small).toBeDefined();
    const c3 = magnetConnector(small.values, 'auto');
    const plan3 = await planBedSplit(obj, bed, { connector: c3, axes: ['y'], allowRotation: false, minFragmentMm3: 0 });
    const res3 = await executeBedSplitGeometry(obj, plan3, { minFragmentMm3: 0 });
    const j = res3.joints[0];
    expect(j.kind).toBe('connector');
    expect(j.connectorCenters).toHaveLength(1);
    for (const p of res3.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
    const d3 = pocketDims(small.values);
    const source = sourceOf(obj);
    checkPairs(source, res3, j, d3.depthMm, d3.widthMm);
    source.delete();
    // Un solo imán en la sección: no es firme (no resiste el giro)
    expect(j.strength!.level).not.toBe('firm');
    expect(j.strength!.reasons).toContain('single-connector');
  }, 60_000);

  it('sección con dos islas: un par por isla', async () => {
    // H: base, dos patas de 16 × 16 y techo; el corte pasa por las patas
    const base = w.Manifold.cube([60, 10, 16], false).translate([-30, 0, -8]);
    const top = w.Manifold.cube([60, 10, 16], false).translate([-30, 50, -8]);
    const l1 = w.Manifold.cube([16, 42, 16], false).translate([-30, 9, -8]);
    const l2 = w.Manifold.cube([16, 42, 16], false).translate([14, 9, -8]);
    const h = w.Manifold.union([base, top, l1, l2]);
    [base, top, l1, l2].forEach((m) => m.delete());
    const obj = objFromM(h, 'H');
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 50 }, { connector: M5, axes: ['y'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan);
    expect(res.joints).toHaveLength(1);
    const j = res.joints[0];
    expect(j.islands).toHaveLength(2);
    expect(j.connectorCenters).toHaveLength(2);
    // Una por pata: x a ambos lados del centro
    const xs = j.connectorCenters.map((c) => c[0]).sort((p, q) => p - q);
    expect(xs[0]).toBeLessThan(-14);
    expect(xs[1]).toBeGreaterThan(14);
    expect(j.islands.every((i) => i.kind === 'connector')).toBe(true);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
    const source = sourceOf(obj);
    checkPairs(source, res, j, DIMS5.depthMm, DIMS5.widthMm);
    source.delete();
  }, 60_000);

  it('pieza girada (caras inclinadas en el corte): los ejes son perpendiculares a la cara del corte', async () => {
    const raw = w.Manifold.cube([30, 70, 30], true);
    const tilted = raw.rotate([25, 0, 20]);
    raw.delete();
    const obj = objFromM(tilted, 'inclinada');
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 45 }, { connector: M5, axes: ['y'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan);
    const j = res.joints[0];
    expect(j.kind).toBe('connector');
    expect(j.connectorCenters.length).toBeGreaterThanOrEqual(2);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
    // checkPairs mide cada hueco a lo largo del eje de la unión (la normal del plano): ancho lateral = diámetro,
    // largo axial = profundidad; un eje inclinado daría una caja más ancha o más larga
    const source = sourceOf(obj);
    checkPairs(source, res, j, DIMS5.depthMm, DIMS5.widthMm);
    source.delete();
  }, 60_000);

  it('más de dos piezas: cada unión lleva sus pares, sin cruzarse entre uniones', async () => {
    const obj = objFromM(w.Manifold.cube([40, 100, 30], true), 'torre');
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 40 }, { connector: M5, axes: ['y'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan);
    expect(res.parts.length).toBeGreaterThanOrEqual(3);
    expect(res.joints.length).toBe(res.parts.length - 1);
    const source = sourceOf(obj);
    for (const j of res.joints) {
      expect(j.kind).toBe('connector');
      expect(checkPairs(source, res, j, DIMS5.depthMm, DIMS5.widthMm)).toBe(2);
    }
    source.delete();
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
    const pocket = pocketSectionArea(DIMS5) * DIMS5.depthMm;
    const removed = res.sourceVolumeMm3 - res.parts.reduce((s, p) => s + p.volumeMm3, 0);
    expect(Math.abs(removed - 4 * res.joints.length * pocket) / (4 * res.joints.length * pocket)).toBeLessThan(0.01);
  }, 90_000);

  it('cantidad fija: respeta el número pedido si cabe; un solo imán en sección grande queda débil con motivo', async () => {
    const obj = objFromM(w.Manifold.cube([60, 60, 60], true), 'cubo');
    const bed = { widthMm: 200, depthMm: 200, heightMm: 40 };
    const four = magnetConnector(MAGNET_DEFAULTS, 4);
    const res4 = await executeBedSplitGeometry(obj, await planBedSplit(obj, bed, { connector: four, axes: ['y'], allowRotation: false }));
    expect(res4.joints[0].connectorCenters).toHaveLength(4);
    const one = magnetConnector(MAGNET_DEFAULTS, 1);
    const res1 = await executeBedSplitGeometry(obj, await planBedSplit(obj, bed, { connector: one, axes: ['y'], allowRotation: false }));
    const s = res1.joints[0].strength!;
    expect(s.level).toBe('weak');
    expect(s.reasons).toContain('single-magnet');
  }, 60_000);
});
