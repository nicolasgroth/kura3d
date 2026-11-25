/**
 * @file src/engine/__tests__/splitConnectorMatrix.test.ts
 * @description QA ronda 6 de "dividir para imprimir" con modelos propios (estatua simulada de ~1 m,
 * tubo recto, L con codo, T, cono hueco, esfera hueca de pared 2, placa delgada y cubo grande) en cama
 * 250³ con cada tipo de conector y con/sin firmeza activa y cambio de superficie. Cada caso mide y
 * devuelve la lista de violaciones; las pruebas `it.fails` documentan brechas CONFIRMADAS (al corregirlas
 * fallarán: quitarles `.fails`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { normalizeMeshToBed } from '../primitives';
import { ASSEMBLY_LIMITS } from '../operationLimits';
import {
  executeBedSplitGeometry, planBedSplit,
  type BedSplitExecuteOptions, type BedSplitResult, type SplitConnectorOptions,
} from '../split';
import { makeObject } from './geometryTestUtils';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const BED = 250;
const del = (...ms: Manifold[]) => ms.forEach((m) => m.delete());
const cylY = (h: number, r: number, x: number, y0: number, z: number, seg = 48) => {
  const c = w.Manifold.cylinder(h, r, r, seg);
  const o = c.rotate([-90, 0, 0]).translate([x, y0, z]);
  c.delete();
  return o;
};
const cylX = (l: number, r: number, x0: number, y: number, z: number, seg = 48) => {
  const c = w.Manifold.cylinder(l, r, r, seg);
  const o = c.rotate([0, 90, 0]).translate([x0, y, z]);
  c.delete();
  return o;
};
const cylZ = (l: number, r: number, x: number, y: number, z0: number, seg = 48) =>
  w.Manifold.cylinder(l, r, r, seg).translate([x, y, z0]);
const ell = (rx: number, ry: number, rz: number, x: number, y: number, z: number) => {
  const s = w.Manifold.sphere(1, 48);
  const o = s.scale([rx, ry, rz]).translate([x, y, z]);
  s.delete();
  return o;
};
const union = (ms: Manifold[]) => {
  const u = w.Manifold.union(ms);
  del(...ms);
  return u;
};
const hollow = (outer: Manifold[], inner: Manifold[]) => {
  const o = union(outer);
  const i = union(inner);
  const r = o.subtract(i);
  del(o, i);
  return r;
};

/** Modelos propios (eje Y = altura del motor). */
export const MODELS: Record<string, () => Manifold> = {
  estatua: () =>
    union([
      w.Manifold.cube([300, 30, 220], true).translate([0, 15, 0]), // plinto
      cylY(420, 55, -80, 30, 0), cylY(420, 55, 80, 30, 0), // piernas
      ell(170, 220, 100, 0, 640, 0), // torso
      ell(75, 90, 75, 0, 930, 0), // cabeza
      cylY(60, 35, 0, 820, 0), // cuello
      cylY(380, 38, -215, 470, 0), cylY(380, 38, 215, 470, 0), // brazos
      cylX(200, 30, 150, 800, 0), // brazo estirado
    ]),
  'tubo recto 1 m Ø100 pared 3': () => hollow([cylX(1000, 50, 0, 50, 0)], [cylX(1002, 47, -1, 50, 0)]),
  'tubo en L 1x1 m': () =>
    hollow(
      [cylX(1000, 50, 0, 50, 0), cylZ(1000, 50, 0, 50, 0), w.Manifold.sphere(50, 48).translate([0, 50, 0])],
      [cylX(1002, 47, -1, 50, 0), cylZ(1002, 47, 0, 50, -1), w.Manifold.sphere(47, 48).translate([0, 50, 0])],
    ),
  'tubo en T': () =>
    hollow(
      [cylX(1000, 50, -500, 50, 0), cylY(500, 50, 0, 50, 0)],
      [cylX(1002, 47, -501, 50, 0), cylY(502, 47, 0, 50, 0)],
    ),
  'cono hueco': () => {
    const o = w.Manifold.cylinder(500, 140, 60, 64).rotate([-90, 0, 0]);
    const i = w.Manifold.cylinder(504, 137, 57, 64).rotate([-90, 0, 0]).translate([0, -2, 0]);
    const r = o.subtract(i);
    del(o, i);
    return r;
  },
  'esfera hueca pared 2': () => {
    const o = w.Manifold.sphere(150, 64);
    const i = w.Manifold.sphere(148, 64);
    const r = o.subtract(i);
    del(o, i);
    return r;
  },
  'placa 600x600x4': () => w.Manifold.cube([600, 4, 600], true),
  'cubo 440': () => w.Manifold.cube([440, 440, 440], true),
};

function objFromM(m: Manifold, name: string) {
  const mesh = manifoldToMeshData(m);
  const bb = m.boundingBox();
  const obj = makeObject(name, normalizeMeshToBed(mesh), { position: [(bb.min[0] + bb.max[0]) / 2, bb.min[1], (bb.min[2] + bb.max[2]) / 2] });
  m.delete();
  return obj;
}

const THIN = new Set(['tubo recto 1 m Ø100 pared 3', 'tubo en L 1x1 m', 'tubo en T', 'cono hueco', 'esfera hueca pared 2', 'placa 600x600x4']);

export interface CaseOut {
  v: string[];
  res?: BedSplitResult;
  secs: number;
}

/** Corre un caso y devuelve las violaciones de las invariantes pedidas (lista vacía = correcto). */
export async function runCase(model: string, conn: SplitConnectorOptions | null, exec: BedSplitExecuteOptions = {}): Promise<CaseOut> {
  const v: string[] = [];
  const t0 = performance.now();
  const obj = objFromM(MODELS[model](), model);
  const plan = await planBedSplit(obj, { widthMm: BED, depthMm: BED, heightMm: BED }, { maxPieces: 'auto', connector: conn });
  let res: BedSplitResult;
  try {
    res = await executeBedSplitGeometry(obj, plan, { labels: 'engraved', ...exec });
  } catch (e) {
    return { v: [`THROW ${String((e as Error).message ?? e).slice(0, 140)}`], secs: (performance.now() - t0) / 1000 };
  }
  // Los machos (dowel, peg, dovetail, lap) sobresalen a propósito; con cambio de superficie el arreglo puede pasar a cola de milano;
  // y la fusión de fragmentos menores (minFragmentMm3, por defecto 2000 mm3) cruza el plano por diseño.
  const protrudes = conn?.type === 'dowel' || conn?.type === 'peg' || conn?.type === 'dovetail' || conn?.type === 'lap'
    || exec.assemblyAllowSurfaceChange === true || exec.minFragmentMm3 !== 0;
  const placed: Manifold[] = [];
  for (const p of res.parts) {
    const pm = meshDataToManifold(w, p.mesh);
    const bodies = pm.decompose();
    if (bodies.length !== 1) v.push(`pieza ${p.code}: ${bodies.length} cuerpos`);
    bodies.forEach((b) => b.delete());
    const un = countUnpairedEdges(p.mesh);
    if (un > 0) v.push(`pieza ${p.code}: ${un} aristas sueltas`);
    const sz = [0, 1, 2].map((a) => p.bounds.max[a] - p.bounds.min[a]).sort((a, b) => a - b);
    if (sz[2] > BED + 1e-6) v.push(`pieza ${p.code}: no cabe (${sz.map((s) => s.toFixed(1)).join('x')})`);
    const cellBox = plan.pieces.find((q) => q.cell.join() === p.cell.join())?.bounds;
    if (cellBox && !protrudes) {
      for (let a = 0; a < 3; a++) {
        if (p.bounds.max[a] > cellBox.max[a] + 1e-3 || p.bounds.min[a] < cellBox.min[a] - 1e-3) {
          v.push(`pieza ${p.code}: sobresale del plano de corte en eje ${a} (+${Math.max(p.bounds.max[a] - cellBox.max[a], cellBox.min[a] - p.bounds.min[a]).toFixed(3)} mm)`);
          break;
        }
      }
    }
    placed.push(pm.translate(p.assembly.position));
    pm.delete();
  }
  placed.forEach((p) => p.delete());
  const sum = res.parts.reduce((s, p) => s + p.volumeMm3, 0);
  const expected = res.sourceVolumeMm3 - res.clearanceVolumeMm3 - res.engravedVolumeMm3;
  const errPct = (100 * Math.abs(sum - expected)) / res.sourceVolumeMm3;
  if (errPct > 0.05) v.push(`volumen: error ${errPct.toFixed(3)} % (suma ${sum.toFixed(0)} vs esperado ${expected.toFixed(0)})`);
  const skipped = new Set(res.warnings.filter((x) => x.code === 'SPLIT_LABEL_SKIPPED').map((x) => String(x.params.label)));
  for (const j of res.joints) {
    if (j.labelPlacement === null && !skipped.has(j.label)) v.push(`unión ${j.label}: sin marca ni aviso`);
    const areaSum = j.islands.reduce((s, i) => s + i.areaMm2, 0);
    if (j.islands.length && Math.abs(areaSum - j.contactAreaMm2) > 0.02 * j.contactAreaMm2 + 1)
      v.push(`ISLAS unión ${j.label}: islas suman ${areaSum.toFixed(0)} vs contacto ${j.contactAreaMm2.toFixed(0)}`);
    if (THIN.has(model) && conn && conn.type !== 'lap' && (j.kind !== 'glue' || Math.abs(j.contactAreaMm2 - areaSum) < -1)) v.push(`unión ${j.label}: pared delgada con kind ${j.kind} (esperado glue)`);
    if (j.kind === 'glue' && (j.connector !== null || j.connectorCenters.length > 0)) v.push(`unión ${j.label}: glue con conector`);
    if (j.connector && conn) {
      const wide = Math.max(0, ...j.islands.map((i) => i.minWidthMm));
      const req = conn.size;
      const cap = Math.max(req, Math.min(ASSEMBLY_LIMITS.maxRecommendedRadiusMm, ASSEMBLY_LIMITS.maxReinforceWidthFraction * wide, ASSEMBLY_LIMITS.maxReinforceGrowth * req, conn.depth));
      if (j.connector.size > cap + 1e-6) v.push(`unión ${j.label}: radio ${j.connector.size} > tope ${cap.toFixed(2)}`);
    }
  }
  if (conn?.type === 'loose-dowel') {
    // Solo las uniones que siguen con tarugo suelto (con cambio de superficie algunas pasan a cola de milano)
    const holes = res.joints.reduce((s, j) => s + (j.kind === 'connector' && j.connector?.type === 'loose-dowel' ? j.connectorCenters.length : 0), 0);
    const dowels = res.looseDowels.reduce((s, d) => s + d.count, 0);
    if (dowels !== holes) v.push(`tarugos sueltos ${dowels} vs agujeros-par ${holes}`);
    for (const d of res.looseDowels) {
      // Uniones firmes: la profundidad puede acortarse por unión (rayos), así que hay un lote por diámetro y largo
      const same = res.joints.filter((q) => q.connector && Math.abs(2 * q.connector.size - d.diameterMm) < 1e-6);
      if (same.length === 0) v.push(`tarugo Ø${d.diameterMm}: sin unión de ese diámetro`);
      else if (!same.some((j) => Math.abs(d.lengthMm - Math.max(1, 2 * j.connector!.depth - 2 * j.connector!.tolerance)) < 1e-6)) v.push(`tarugo largo ${d.lengthMm} incoherente`);
    }
  }
  if (THIN.has(model) && conn && conn.type !== 'lap') {
    if (res.clearanceVolumeMm3 > 1e-6) v.push(`pared delgada: holgura ${res.clearanceVolumeMm3} mm3 (deformación)`);
    if (!res.warnings.some((x) => x.code === 'SPLIT_JOINT_GLUE_ONLY' || x.code === 'SPLIT_GLUE_SUMMARY')) v.push('pared delgada: sin aviso de pegar');
  }
  const a = res.assembly;
  if (exec.validateAssembly !== false) {
    if (!a) v.push('sin informe de armado');
    else {
      if (!a.closure.ok) v.push(`armado: no cierra (err vol ${a.closure.volumeErrorPct}%, interf ${a.closure.interference.length}, gaps ${a.closure.gaps.length})`);
      if (a.closure.interference.length) v.push(`armado: ${a.closure.interference.length} choques de piezas`);
      if (a.blocked.length) v.push(`armado: ${a.blocked.length} piezas bloqueadas`);
      if (a.order.length !== res.parts.length) v.push(`armado: orden de ${a.order.length} de ${res.parts.length} piezas`);
      if (a.clashes.length) v.push(`armado: ${a.clashes.length} choques de conectores`);
      const ct = a.fix.changeType.filter((c) => c.type === 'dovetail');
      if (ct.length && a.fix.applied && !exec.assemblyAllowSurfaceChange && conn?.type !== 'dovetail')
        v.push(`armado: cambió a cola de milano sin assemblyAllowSurfaceChange (${ct.map((c) => c.joint)})`);
    }
    if (conn && conn.type !== 'dovetail' && !exec.assemblyAllowSurfaceChange) {
      const dt = res.joints.filter((j) => j.connector?.type === 'dovetail');
      if (dt.length) v.push(`uniones ${dt.map((j) => j.label)} quedaron en cola de milano sin permiso`);
    }
  }
  return { v, res, secs: (performance.now() - t0) / 1000 };
}

export const TYPES: Array<[string, SplitConnectorOptions]> = [
  ['dowel', { type: 'dowel', size: 4, depth: 10, tolerance: 0.2, count: 2 }],
  ['loose-dowel', { type: 'loose-dowel', size: 4, depth: 10, tolerance: 0.2, count: 2 }],
  ['dovetail', { type: 'dovetail', size: 6, depth: 10, tolerance: 0.2, count: 2 }],
  ['peg', { type: 'peg', size: 5, depth: 10, tolerance: 0.2, count: 2 }],
  ['lap', { type: 'lap', size: 4, depth: 6, tolerance: 0.2, count: 1, lapHeightMm: 6 }],
];


// Corregidas (antes `it.fails`): conectores que se pisaban o quedaban bajo la pared mínima con firmeza activa
// (estatua, cubo 440 con tarugo suelto) y montajes bloqueados (cola de milano, solape en el cubo 440). Toda la
// matriz exige 0 choques de conectores y 0 piezas bloqueadas tras dividir.

describe('dividir A: modelos x tipo de conector (cama 250)', () => {
  for (const model of Object.keys(MODELS)) {
    for (const [tname, conn] of TYPES) {
      it(`${model} / ${tname}`, async () => {
        const { v, secs } = await runCase(model, conn);
        console.log(`QA6 ${model} / ${tname}: ${secs.toFixed(1)} s ${v.length ? 'VIOL ' + v.slice(0, 6).join(' | ') : 'ok'}`);
        expect(v).toEqual([]);
        expect(secs, 'tiempo').toBeLessThan(30);
      }, 300_000);
    }
  }
});

describe('dividir A: loose-dowel sin salientes (sin fusión de fragmentos)', () => {
  for (const model of Object.keys(MODELS)) {
    it(`${model}: ninguna pieza sobresale del plano de corte`, async () => {
      const { v } = await runCase(model, TYPES[1][1], { minFragmentMm3: 0, reinforceWeakJoints: false });
      expect(v.filter((x) => x.includes('sobresale'))).toEqual([]);
    }, 120_000);
  }
});

// Medida independiente (cilindro del alojamiento menos el sólido original): en la estatua con dowel por defecto ningún
// conector atraviesa de verdad la superficie (peor caso 0,23 mm3); lo que falla es la pared mínima de 0,8 mm que exige
// el validador (corregido: la ubicación exige esa pared con el mismo modelo, ver `splitConnectorRoom.ts`).
describe('dividir A: el conector queda dentro del sólido (medida independiente)', () => {
  const outsideVolumes = async (model: string, conn: SplitConnectorOptions) => {
    const { res } = await runCase(model, conn);
    const src = MODELS[model]();
    const srcMesh = manifoldToMeshData(src);
    src.delete();
    // La escena conserva las coordenadas del modelo original (objFromM coloca el objeto en el centro de su caja).
    const moved = meshDataToManifold(w, srcMesh);
    const out: Array<{ joint: string; outsideMm3: number }> = [];
    for (const j of res!.joints) {
      if (!j.connector || j.connector.type !== 'dowel') continue;
      for (const c of j.connectorCenters) {
        const cyl0 = w.Manifold.cylinder(2 * j.connector.depth, j.connector.size + j.connector.tolerance, j.connector.size + j.connector.tolerance, 24, true);
        const rot = j.axis === 'x' ? cyl0.rotate([0, 90, 0]) : j.axis === 'y' ? cyl0.rotate([-90, 0, 0]) : cyl0.rotate([0, 0, 0]);
        const cyl = rot.translate(c);
        const o = cyl.subtract(moved);
        out.push({ joint: j.label, outsideMm3: o.volume() });
        [cyl0, rot, cyl, o].forEach((m) => m.delete());
      }
    }
    moved.delete();
    return out;
  };
  it('estatua / dowel: ningún conector asoma fuera del sólido (< 1 mm3, alojamiento con holgura)', async () => {
    const out = await outsideVolumes('estatua', TYPES[0][1]);
    expect(out.filter((x) => x.outsideMm3 > 1)).toEqual([]);
  }, 120_000);
});

// Corregida (antes `it.fails`): `islands[].areaMm2` sumaba menos que `contactAreaMm2` porque se medía la cara de
// unión recortada lejos de los otros planos (faceClipBox); ahora las islas se miden sobre el contacto real.
describe('dividir A: coherencia de islas', () => {
  it('cubo 440 / dowel: la suma de áreas de islas ~ área de contacto (±2 %)', async () => {
    const { v } = await runCase('cubo 440', TYPES[0][1]);
    expect(v.filter((x) => x.startsWith('ISLAS'))).toEqual([]);
  }, 120_000);
  it('placa 600x600x4 / dowel: la suma de áreas de islas ~ área de contacto (±2 %)', async () => {
    const { v } = await runCase('placa 600x600x4', TYPES[0][1]);
    expect(v.filter((x) => x.startsWith('ISLAS'))).toEqual([]);
  }, 120_000);
});

describe('dividir A: firmeza activa y cambio de superficie', () => {
  const models = ['estatua', 'cubo 440', 'tubo en T', 'placa 600x600x4'];
  const small = (type: SplitConnectorOptions['type']): SplitConnectorOptions => ({ type, size: 2, depth: 8, tolerance: 0.2, count: 1 });
  for (const model of models) {
    for (const type of ['dowel', 'loose-dowel', 'dovetail'] as const) {
      for (const reinforce of [true, false]) {
        for (const surf of [true, false]) {
          it(`${model} / ${type} (radio 2) / refuerzo ${reinforce} / cambio de superficie ${surf}`, async () => {
            const { v, secs, res } = await runCase(model, small(type), { reinforceWeakJoints: reinforce, assemblyAllowSurfaceChange: surf });
            console.log(`QA6 ${model} / ${type} / ref ${reinforce} / surf ${surf}: ${secs.toFixed(1)} s ${v.filter((x) => !x.startsWith('ISLAS')).slice(0, 5).join(' | ') || 'ok'} ${res ? 'reforzadas=' + res.joints.filter((j) => j.connector && j.connector.size > 2).length : ''}`);
            expect(v).toEqual([]);
            if (!reinforce && res) expect(res.joints.every((j) => !j.connector || (j.connector.size <= 2 && j.connector.count <= 1))).toBe(true);
            expect(secs).toBeLessThan(30);
          }, 300_000);
        }
      }
    }
  }
});
