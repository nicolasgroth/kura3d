/**
 * @file src/engine/__tests__/splitForBed.test.ts
 * @description Pruebas medidas de "dividir para imprimir": plan (tramos, planos desplazados, errores
 * tipados), ejecución (piezas cerradas que caben, volumen conservado salvo holguras, interferencia 0
 * entre vecinas), marcas grabadas dentro de la unión y vista explosionada. Reporta tiempos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneObject } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { normalizeMeshToBed } from '../primitives';
import {
  executeBedSplitGeometry,
  explodedTransforms,
  layoutSplitParts,
  planBedSplit,
  type BedSplitResult,
  type SplitBed,
} from '../split';
import { makeObject } from './geometryTestUtils';

type Wasm = Awaited<ReturnType<typeof initManifoldEngine>>;
let wasm: Wasm;
const BED: SplitBed = { widthMm: 250, depthMm: 250, heightMm: 250 };

beforeAll(async () => {
  wasm = await initManifoldEngine();
});

/** Objeto de escena desde un manifold en mundo (malla local + posición centro-base). */
function objFrom(m: Manifold, name: string): SceneObject {
  const mesh = manifoldToMeshData(m);
  const bb = m.boundingBox();
  const obj = makeObject(name, normalizeMeshToBed(mesh), {
    position: [(bb.min[0] + bb.max[0]) / 2, bb.min[1], (bb.min[2] + bb.max[2]) / 2],
  });
  m.delete();
  return obj;
}

/** Cilindro vertical (eje Y) de alto `h` y radio `r`, hueco si `inner` > 0. */
function verticalTube(h: number, r: number, inner = 0, segments = 64): Manifold {
  const outer = wasm.Manifold.cylinder(h, r, r, segments);
  let solid = outer;
  if (inner > 0) {
    const hole = wasm.Manifold.cylinder(h + 2, inner, inner, segments).translate([0, 0, -1]);
    solid = outer.subtract(hole);
    outer.delete();
    hole.delete();
  }
  const up = solid.rotate([-90, 0, 0]);
  solid.delete();
  return up;
}

/** Comprueba piezas cerradas, que caben y sin interferencia entre las de cada unión. */
function checkParts(res: BedSplitResult, usable = 240) {
  for (const p of res.parts) {
    const m = meshDataToManifold(wasm, p.mesh);
    expect(m.status()).toBe('NoError');
    m.delete();
    const size = [0, 1, 2].map((a) => p.bounds.max[a] - p.bounds.min[a]).sort((a, b) => a - b);
    expect(size[2]).toBeLessThanOrEqual(usable + 1e-6);
  }
  const placed = res.parts.map((p) => {
    const m = meshDataToManifold(wasm, p.mesh);
    const t = m.translate(p.assembly.position);
    m.delete();
    return t;
  });
  try {
    for (const j of res.joints) {
      const inter = placed[j.a.part].intersect(placed[j.b.part]);
      // Las caras de la unión son coplanares: el redondeo a Float32 de la malla deja una lámina de
      // espesor ~1e-6 mm. Interferencia real = volumen apreciable o espesor ≥ 1 µm en el eje de la unión.
      const a = { x: 0, y: 1, z: 2 }[j.axis];
      const bb = inter.boundingBox();
      const thickness = inter.isEmpty() ? 0 : bb.max[a] - bb.min[a];
      expect(inter.volume() < 1e-3 || thickness < 1e-3).toBe(true);
      inter.delete();
    }
  } finally {
    for (const m of placed) m.delete();
  }
}

function checkVolume(res: BedSplitResult) {
  const sum = res.parts.reduce((s, p) => s + p.volumeMm3, 0);
  const expected = res.sourceVolumeMm3 - res.clearanceVolumeMm3 - res.engravedVolumeMm3;
  expect(Math.abs(sum - expected) / res.sourceVolumeMm3).toBeLessThan(1e-4);
}

describe('planBedSplit', () => {
  it('(1) cilindro de 1000 × Ø120 mm en cama de 250: 4 o 5 tramos en Y, con conectores', async () => {
    const obj = objFrom(verticalTube(1000, 60), 'cil');
    const plan = await planBedSplit(obj, BED);
    console.info(`[split] plan cilindro: ${plan.elapsedMs.toFixed(0)} ms`);
    expect(plan.counts.x).toBe(1);
    expect(plan.counts.z).toBe(1);
    expect([4, 5]).toContain(plan.counts.y);
    expect(plan.planes.every((p) => p.axis === 'y' && p.islands === 1 && p.admitsConnectors)).toBe(true);
    for (const piece of plan.pieces) expect(Math.max(...piece.sizeMm)).toBeLessThanOrEqual(240 + 1e-6);
    expect(plan.pieces.map((p) => p.code)).toEqual(Array.from({ length: plan.counts.y }, (_, j) => `A${j + 1}`));
  });

  it('(4) pieza que ya cabe: plan sin cortes', async () => {
    const obj = objFrom(wasm.Manifold.cube([100, 80, 60], true), 'cubo');
    const plan = await planBedSplit(obj, BED);
    expect(plan.fitsWithoutCuts).toBe(true);
    expect(plan.planes).toHaveLength(0);
    expect(plan.pieces).toHaveLength(1);
  });

  it('acuesta una pieza larga en vez de cortarla si así cabe', async () => {
    const obj = objFrom(wasm.Manifold.cube([30, 300, 30], true), 'barra');
    const plan = await planBedSplit(obj, { widthMm: 350, depthMm: 350, heightMm: 100 });
    expect(plan.planes).toHaveLength(0);
    expect(plan.pieces[0].rotated).toBe(true);
  });

  it('(5) cama demasiado chica: error tipado por exceso de piezas', async () => {
    const obj = objFrom(verticalTube(1000, 60), 'cil');
    await expect(planBedSplit(obj, { widthMm: 30, depthMm: 30, heightMm: 30 })).rejects.toMatchObject({
      code: 'SPLIT_TOO_MANY_PIECES',
    });
    await expect(planBedSplit(obj, BED, { axes: ['x'] })).rejects.toBeInstanceOf(EngineError);
  });

  it('desplaza el plano lejos de un detalle fino (evita la isla diminuta)', async () => {
    // Columna de 540 mm: base hasta y=340, vástago fino de Ø6 hasta y=500 y remate. El segundo
    // plano uniforme (y=360) cortaría el vástago; el desplazado debe caer en la base maciza.
    const base = wasm.Manifold.cube([120, 340, 120], false).translate([-60, 0, -60]);
    const rod = wasm.Manifold.cylinder(180, 3, 3, 24).rotate([-90, 0, 0]).translate([40, 330, 40]);
    const top = wasm.Manifold.cube([120, 40, 120], false).translate([-60, 500, -60]);
    const body = wasm.Manifold.union([base, rod, top]);
    base.delete();
    rod.delete();
    top.delete();
    const plan = await planBedSplit(objFrom(body, 'col'), BED, { axes: ['y'] });
    expect(plan.counts.y).toBe(3);
    const cut = plan.planes[1];
    expect(cut.islands).toBe(1);
    expect(cut.smallestIslandMm2).toBeGreaterThan(1000);
    expect(cut.position).toBeLessThan(cut.uniformPosition);
  });

  it('planifica unos 200 mil triángulos en tiempo acotado', async () => {
    const sphere = wasm.Manifold.sphere(300, 640).scale([1, 1.6, 1]);
    const obj = objFrom(sphere, 'esfera');
    const tris = obj.mesh.indices.length / 3;
    const plan = await planBedSplit(obj, BED);
    console.info(`[split] plan ${tris} triángulos: ${plan.elapsedMs.toFixed(0)} ms, ${plan.pieces.length} piezas`);
    expect(tris).toBeGreaterThan(180_000);
    // Objetivo: < 1 s en solitario (≈0,7 s medido). El umbral es holgado porque la suite completa corre en paralelo.
    expect(plan.elapsedMs).toBeLessThan(5000);
  });
});

describe('executeBedSplitGeometry', () => {
  it('(1) cilindro: tramos cerrados que caben, con conectores, volumen conservado', async () => {
    const obj = objFrom(verticalTube(1000, 60), 'cil');
    const plan = await planBedSplit(obj, BED);
    const progress: number[] = [];
    const res = await executeBedSplitGeometry(obj, plan, { onProgress: (d) => progress.push(d) });
    console.info(`[split] ejecución cilindro: ${res.elapsedMs.toFixed(0)} ms, ${res.parts.length} piezas`);
    expect(res.parts).toHaveLength(plan.counts.y);
    expect(progress).toHaveLength(plan.planes.length);
    expect(res.joints).toHaveLength(plan.counts.y - 1);
    expect(res.joints.every((j) => j.connector && j.connectorCenters.length >= 1)).toBe(true);
    expect(res.joints.map((j) => j.label)).toEqual(res.joints.map((_, i) => String(i + 1)));
    expect(res.joints[0]).toMatchObject({ a: { code: 'A1', face: '+y' }, b: { code: 'A2', face: '-y' } });
    expect(res.clearanceVolumeMm3).toBeGreaterThan(0);
    checkVolume(res);
    checkParts(res);
  });

  it('(2) tubo hueco de 1000 mm con pared de 5 mm: conectores por isla o aviso', async () => {
    const obj = objFrom(verticalTube(1000, 60, 55), 'tubo');
    const plan = await planBedSplit(obj, BED);
    const res = await executeBedSplitGeometry(obj, plan);
    expect(res.parts.length).toBe(plan.counts.y);
    for (const j of res.joints) {
      const warned = res.warnings.some((w) => w.code === 'SPLIT_JOINT_NO_CONNECTOR' && w.params.label === j.label);
      expect(j.connector !== null || warned).toBe(true);
      if (j.connector) expect(j.connector.size).toBeLessThanOrEqual(4);
    }
    checkVolume(res);
    checkParts(res);
  });

  it('(3) estatua sintética no convexa ~600 × 900 × 400: rejilla en 3 ejes, todo cabe, sin islas diminutas', async () => {
    const parts = [
      wasm.Manifold.sphere(200, 48).scale([1.5, 1, 1]).translate([0, 300, 0]),
      wasm.Manifold.sphere(110, 40).translate([0, 640, 0]),
      wasm.Manifold.cylinder(300, 70, 60, 40).rotate([-90, 0, 0]).translate([-140, 0, 0]),
      wasm.Manifold.cylinder(300, 70, 60, 40).rotate([-90, 0, 0]).translate([140, 0, 0]),
    ];
    // Toro (anillo) sobre la cabeza: revolución de un círculo
    const ring = wasm.CrossSection.circle(30, 32).translate([140, 0]);
    const torus = wasm.Manifold.revolve(ring, 48).rotate([90, 0, 0]).translate([0, 760, 0]);
    ring.delete();
    const statue = wasm.Manifold.union([...parts, torus]);
    for (const p of [...parts, torus]) p.delete();
    const obj = objFrom(statue, 'estatua');
    const plan = await planBedSplit(obj, BED);
    const t = await executeBedSplitGeometry(obj, plan);
    console.info(
      `[split] estatua ${obj.mesh.indices.length / 3} tri: plan ${plan.elapsedMs.toFixed(0)} ms, ` +
        `ejecución ${t.elapsedMs.toFixed(0)} ms, rejilla ${plan.counts.x}×${plan.counts.y}×${plan.counts.z}, ${t.parts.length} piezas, ${t.joints.length} uniones`,
    );
    expect(plan.counts.x).toBeGreaterThan(1);
    expect(plan.counts.y).toBeGreaterThan(1);
    expect(plan.counts.z).toBeGreaterThan(1);
    expect(plan.planes.every((p) => p.islands === 0 || p.smallestIslandMm2 > 100)).toBe(true);
    for (const p of t.parts) expect(p.volumeMm3).toBeGreaterThan(1000);
    checkVolume(t);
    checkParts(t);
  }, 120_000);

  it('(6) etiquetas grabadas: volumen grabado > 0, dentro de la unión y lejos de los conectores', async () => {
    const obj = objFrom(verticalTube(500, 60), 'cil');
    const plan = await planBedSplit(obj, BED);
    const res = await executeBedSplitGeometry(obj, plan, { labels: 'engraved' });
    expect(res.engravedVolumeMm3).toBeGreaterThan(0);
    for (const j of res.joints) {
      expect(j.labelEngraved).toBe(true);
      expect(j.labelHeightMm).toBeGreaterThanOrEqual(4);
    }
    // Sin etiquetas el volumen es mayor exactamente en lo grabado
    const plain = await executeBedSplitGeometry(obj, plan);
    const sum = (r: BedSplitResult) => r.parts.reduce((s, p) => s + p.volumeMm3, 0);
    expect(sum(plain) - sum(res)).toBeCloseTo(res.engravedVolumeMm3, 1);
    checkVolume(res);
    checkParts(res);
  });

  it('(6b) sin espacio para una marca legible: se omite con aviso', async () => {
    const obj = objFrom(verticalTube(400, 6), 'varilla');
    const plan = await planBedSplit(obj, BED, { connector: null });
    const res = await executeBedSplitGeometry(obj, plan, { labels: 'engraved', labelMinHeightMm: 10 });
    expect(res.joints.length).toBeGreaterThan(0);
    expect(res.joints.every((j) => !j.labelEngraved)).toBe(true);
    expect(res.warnings.some((w) => w.code === 'SPLIT_LABEL_SKIPPED')).toBe(true);
    checkVolume(res);
  });
});

describe('disposición y armado', () => {
  it('(7) explodedTransforms en 0 reproduce el armado exacto y en 1 separa las piezas', async () => {
    const obj = objFrom(verticalTube(600, 60), 'cil');
    const plan = await planBedSplit(obj, BED);
    const res = await executeBedSplitGeometry(obj, plan);
    const at0 = explodedTransforms(res.parts, 0);
    at0.forEach((t, i) => {
      expect(t.position).toEqual(res.parts[i].assembly.position);
      expect(t.rotation).toEqual(res.parts[i].assembly.rotation);
    });
    const at1 = explodedTransforms(res.parts, 1);
    const ys = at1.map((t) => t.position[1]);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThan(res.parts[i].assembly.position[1] - res.parts[i - 1].assembly.position[1]);
  });

  it('layoutSplitParts: cara de corte abajo, dentro de la cama y en placas', async () => {
    const obj = objFrom(verticalTube(1000, 60), 'cil');
    const plan = await planBedSplit(obj, BED);
    const res = await executeBedSplitGeometry(obj, plan);
    // Cama de 260: 250 útiles, caben 2 × 2 discos de Ø120 con 5 mm de separación
    const lay = layoutSplitParts(res.parts, { widthMm: 260, depthMm: 260, heightMm: 250 });
    expect(lay.oversized).toEqual([]);
    expect(lay.placements).toHaveLength(res.parts.length);
    for (const p of lay.placements) expect(['-y', '+y']).toContain(p.downFace);
    expect(lay.plateCount).toBe(Math.ceil(res.parts.length / 4));
  });
});
