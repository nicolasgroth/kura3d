/**
 * @file src/engine/__tests__/splitNatural.test.ts
 * @description «Por las partes de la figura» (dividir para imprimir): perfil de secciones exacto en
 * formas conocidas, elección 1D de planos, y el plan completo en formas sintéticas con estrechamiento
 * conocido (pesa con cuello, muñeco de cápsulas, caja lisa que cae en la rejilla). Ejecuta el plan
 * de la pesa y comprueba piezas cerradas, volumen conservado y que todo cabe en la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneObject } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { normalizeMeshToBed } from '../primitives';
import { executeBedSplitGeometry, naturalPlanAsExplicitPlanes, planBedSplit, type BedSplitPlan, type SplitBed } from '../split';
import { naturalCutCandidates } from '../split/naturalCandidates';
import { sectionProfile, samplePosition } from '../split/naturalProfile';
import { chooseAxisCuts } from '../split/naturalSelect';
import { fittingRotation } from '../split/splitSections';
import { makeObject } from './geometryTestUtils';

type Wasm = Awaited<ReturnType<typeof initManifoldEngine>>;
let wasm: Wasm;
beforeAll(async () => {
  wasm = await initManifoldEngine();
});

/** Objeto de escena desde un sólido (base en Y = 0, centrado en X/Z). */
function objFrom(m: Manifold, name: string): SceneObject {
  const mesh = manifoldToMeshData(m);
  const bb = m.boundingBox();
  m.delete();
  return makeObject(name, normalizeMeshToBed(mesh), { position: [(bb.min[0] + bb.max[0]) / 2, bb.min[1], (bb.min[2] + bb.max[2]) / 2] });
}

const sphere = (r: number, x: number, y: number, z = 0) => wasm.Manifold.sphere(r, 64).translate([x, y, z]);
/** Cilindro vertical (eje Y) de `y0` a `y1`. */
const cylY = (r: number, y0: number, y1: number, x = 0, z = 0) => wasm.Manifold.cylinder(y1 - y0, r, r, 48).rotate([-90, 0, 0]).translate([x, y0, z]);
/** Cápsula vertical: cilindro con media esfera en cada punta (eje de `y0` a `y1`). */
const capsuleY = (r: number, y0: number, y1: number, x = 0) => wasm.Manifold.union([cylY(r, y0, y1, x), sphere(r, x, y0), sphere(r, x, y1)]);
const union = (ms: Manifold[]) => {
  const u = wasm.Manifold.union(ms);
  ms.forEach((m) => m.delete());
  return u;
};

const yPlanes = (plan: BedSplitPlan) => plan.planes.filter((p) => p.axis === 'y').map((p) => p.position);
const fitsAll = (plan: BedSplitPlan) => plan.pieces.every((p) => fittingRotation(p.sizeMm, plan.usableMm, true) !== null);

describe('perfil de secciones', () => {
  it('da el área exacta de un cilindro y de una esfera, y resta los huecos de un tubo', () => {
    const cyl = cylY(20, 0, 100);
    const tube = cyl.subtract(cylY(10, -1, 101));
    const ball = sphere(30, 0, 0);
    for (const [m, expected] of [[cyl, Math.PI * 400], [tube, Math.PI * 300]] as const) {
      const mesh = m.getMesh();
      const p = sectionProfile(mesh.vertProperties.filter((_, i) => i % mesh.numProp < 3), mesh.triVerts, 'y', 50);
      for (let i = 5; i < 45; i++) expect(p.area[i] / expected).toBeCloseTo(1, 2);
    }
    const bm = ball.getMesh();
    const bp = sectionProfile(bm.vertProperties.filter((_, i) => i % bm.numProp < 3), bm.triVerts, 'y', 61);
    const mid = 30;
    expect(Math.abs(samplePosition(bp, mid))).toBeLessThan(1);
    expect(bp.area[mid] / (Math.PI * 900)).toBeCloseTo(1, 2);
    [cyl, tube, ball].forEach((m) => m.delete());
  });
});

describe('elección de planos por eje', () => {
  it('usa el estrechamiento que cabe y completa con rectos', () => {
    // Largo 300, tramo máximo 120: dos planos. Cuello en 100: queda 100 + 200 → un recto en 200.
    const c = chooseAxisCuts({ min: 0, max: 300, planes: 2, roomMm: 120, minSpanMm: 10, candidates: [{ position: 100, weight: 0.9 }] })!;
    expect(c.kinds).toEqual(['natural', 'straight']);
    expect(c.positions[0]).toBe(100);
    expect(c.positions[1]).toBeCloseTo(200);
  });
  it('prefiere más estrechamientos aunque pesen menos, y no usa uno que obligue a cortar de más', () => {
    const c = chooseAxisCuts({
      min: 0, max: 300, planes: 2, roomMm: 120, minSpanMm: 10,
      candidates: [{ position: 110, weight: 0.4 }, { position: 215, weight: 0.4 }, { position: 150, weight: 1.5 }, { position: 20, weight: 1.5 }],
    })!;
    expect(c.positions).toEqual([110, 215]);
    expect(c.kinds).toEqual(['natural', 'natural']);
  });
  it('sin candidatos reparte parejo; sin espacio posible devuelve null', () => {
    expect(chooseAxisCuts({ min: 0, max: 300, planes: 2, roomMm: 120, minSpanMm: 10, candidates: [] })!.positions).toEqual([100, 200]);
    expect(chooseAxisCuts({ min: 0, max: 300, planes: 1, roomMm: 120, minSpanMm: 10, candidates: [] })).toBeNull();
  });
});

describe('Por las partes de la figura', () => {
  const bedTall: SplitBed = { widthMm: 200, depthMm: 200, heightMm: 160 };

  it('pesa asimétrica: el corte cae en el cuello, no en la mitad de la esfera; piezas cerradas y volumen igual', async () => {
    // Esfera grande (Y 0–120), cuello Ø16 (Y 120–135), esfera chica (Y 135–185)
    const obj = objFrom(union([sphere(60, 0, 60), cylY(8, 115, 140), sphere(25, 0, 160)]), 'pesa');
    const grid = await planBedSplit(obj, bedTall, { connector: null, allowRotation: false, axes: ['y'] });
    const plan = await planBedSplit(obj, bedTall, { connector: null, allowRotation: false, axes: ['y'], strategy: 'natural' });
    expect(yPlanes(grid)).toHaveLength(1);
    expect(yPlanes(grid)[0]).toBeLessThan(115); // la rejilla corta la esfera grande
    expect(yPlanes(plan)).toHaveLength(1);
    expect(yPlanes(plan)[0]).toBeGreaterThan(118);
    expect(yPlanes(plan)[0]).toBeLessThan(137);
    expect(plan.strategy).toBe('natural');
    expect(plan.natural).toMatchObject({ naturalCuts: 1, straightCuts: 0 });
    expect(plan.planes[0].origin).toBe('natural');
    expect(plan.planes[0].sectionAreaMm2).toBeLessThan(Math.PI * 64 * 1.05);
    expect(fitsAll(plan)).toBe(true);
    // Adaptador a planos explícitos: mismo plano, normal +Y
    const [explicit] = naturalPlanAsExplicitPlanes(plan);
    expect(explicit).toMatchObject({ normal: [0, 1, 0], origin: 'natural' });
    expect(explicit.point[1]).toBe(plan.planes[0].position);

    const res = await executeBedSplitGeometry(obj, plan, { connector: null, validateAssembly: false });
    expect(res.parts).toHaveLength(2);
    let sum = 0;
    for (const part of res.parts) {
      const m = meshDataToManifold(wasm, part.mesh);
      expect(m.status()).toBe('NoError');
      expect(m.genus()).toBe(0);
      sum += m.volume();
      m.delete();
    }
    expect(sum / res.sourceVolumeMm3).toBeCloseTo(1, 3);
    const small = res.parts.find((p) => p.bounds.min[1] > 100)!;
    expect(small.bounds.max[1] - small.bounds.min[1]).toBeLessThan(70); // cabeza + cuello, sin trozo de la esfera grande
  });

  it('muñeco de cápsulas: corta en el cuello y en la cadera', async () => {
    // Piernas Ø24 (Y 0–92), torso Ø56 (Y 72–188), cuello Ø14, cabeza Ø50 (Y 197–247)
    const obj = objFrom(union([
      capsuleY(12, 12, 80, -14), capsuleY(12, 12, 80, 14), capsuleY(28, 100, 160), cylY(7, 180, 200), sphere(25, 0, 222),
    ]), 'muneco');
    // Cama útil 120: hacen falta 3 tramos (247 / 120) y cadera–cuello (≈115) cabe
    const bed: SplitBed = { widthMm: 200, depthMm: 200, heightMm: 130 };
    const plan = await planBedSplit(obj, bed, { connector: null, allowRotation: false, axes: ['y'], strategy: 'natural' });
    const ys = yPlanes(plan);
    expect(ys).toHaveLength(2);
    expect(plan.natural?.naturalCuts).toBe(2);
    expect(ys[0]).toBeGreaterThan(68); // cadera: donde las piernas entran al torso
    expect(ys[0]).toBeLessThan(96);
    expect(ys[1]).toBeGreaterThan(185); // cuello
    expect(ys[1]).toBeLessThan(200);
    expect(fitsAll(plan)).toBe(true);
  });

  it('caja lisa: sin estrechamientos, queda la rejilla y se dice', async () => {
    const obj = objFrom(wasm.Manifold.cube([100, 250, 100], true), 'caja');
    const grid = await planBedSplit(obj, bedTall, { connector: null });
    const plan = await planBedSplit(obj, bedTall, { connector: null, strategy: 'natural' });
    expect(plan.natural).toMatchObject({ naturalCuts: 0, straightCuts: grid.planes.length });
    expect(plan.natural?.candidates).toEqual([]);
    expect(plan.planes.map((p) => p.position)).toEqual(grid.planes.map((p) => p.position));
  });

  it('si el cuello no cae donde cabe, completa con un corte recto adicional', async () => {
    // Pesa alta: con tramos de 150 hace falta 2 planos; el cuello (Y≈127) sirve para uno, el otro es recto.
    const obj = objFrom(union([sphere(60, 0, 60), cylY(8, 115, 140), capsuleY(25, 160, 300)]), 'pesa-larga');
    const plan = await planBedSplit(obj, bedTall, { connector: null, allowRotation: false, axes: ['y'], strategy: 'natural' });
    expect(plan.natural).toMatchObject({ naturalCuts: 1, straightCuts: 1 });
    expect(plan.planes.map((p) => p.origin)).toEqual(['natural', 'straight']);
    expect(fitsAll(plan)).toBe(true);
  });

  it('los candidatos llevan posición, área y profundidad; la caja no da ninguno', () => {
    const m = union([sphere(60, 0, 60), cylY(8, 115, 140), sphere(25, 0, 160)]);
    const mesh = m.getMesh();
    const pos = mesh.vertProperties.filter((_, i) => i % mesh.numProp < 3);
    const { candidates } = naturalCutCandidates(pos, mesh.triVerts, { axes: ['y'] });
    m.delete();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].position).toBeGreaterThan(118);
    expect(candidates[0].position).toBeLessThan(137);
    expect(candidates[0].depth).toBeGreaterThan(0.8);
    const box = wasm.Manifold.cube([50, 200, 50], true);
    const bm = box.getMesh();
    expect(naturalCutCandidates(bm.vertProperties.filter((_, i) => i % bm.numProp < 3), bm.triVerts).candidates).toEqual([]);
    box.delete();
  });
});
