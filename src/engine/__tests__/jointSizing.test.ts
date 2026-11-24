/**
 * @file src/engine/__tests__/jointSizing.test.ts
 * @description Uniones firmes con geometría conocida y motor real: placa gruesa, barra de 6 × 6,
 * lámina de 2 mm, sección de dos islas, tubo hueco y barra inclinada. Cada caso arma las dos mitades
 * con el plan (`planJointConnectors` + `applyJointPlan`) y mide sobre el resultado de la resta: pared
 * alrededor de cada alojamiento ≥ mínima, mitades cerradas, interferencia cero entre machos y hembras
 * y holgura radial igual a la configurada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { SegmentDistanceIndex, type Vec2 } from '../cutConnectorPolygonIndex';
import { buildConnectorSolid } from '../cutConnectorSolid';
import { measureCrossSection } from '../jointSection';
import { applyJointPlan, planJointConnectors, type JointPlan, type JointRequest } from '../jointSizing';
import { JOINT_RULES, jointLevel, maxConnectorSize } from '../jointRules';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';

type Wasm = Awaited<ReturnType<typeof initManifoldEngine>>;
let wasm: Wasm;

beforeAll(async () => {
  wasm = await initManifoldEngine();
});

const REQ: JointRequest = { type: 'dowel', size: 4, depth: 6, tolerance: 0.25, count: 2 };
const W = JOINT_RULES.minWallMm;

/** Pared mínima medida en la mitad perforada a varias alturas: de cada contorno del alojamiento al resto. */
function measuredWalls(high: Manifold, plan: JointPlan): number[] {
  const walls: number[] = [];
  const reach = plan.depthMm + REQ.tolerance;
  for (const k of [0.2, 0.5, 0.85]) {
    const cs = high.slice(plan.coord + reach * k);
    const polys = cs.toPolygons() as Vec2[][];
    cs.delete();
    for (const c of plan.connectors) {
      const uv: Vec2 = [c.center[0], c.center[1]];
      // Contorno del alojamiento: el polígono cuyo centroide cae en el centro del conector
      const hole = polys.findIndex((p) => {
        const cx = p.reduce((s, q) => s + q[0], 0) / p.length;
        const cy = p.reduce((s, q) => s + q[1], 0) / p.length;
        return Math.hypot(cx - uv[0], cy - uv[1]) < 0.3;
      });
      expect(hole, `alojamiento visible a ${k} de la profundidad`).toBeGreaterThanOrEqual(0);
      const others = new SegmentDistanceIndex(polys.filter((_, i) => i !== hole));
      walls.push(Math.min(...polys[hole].map((v) => others.distance(v))));
    }
  }
  return walls;
}

/** Arma las mitades y comprueba cierre, pared, interferencia y holgura. Devuelve las paredes medidas. */
function checkHalves(m: Manifold, plan: JointPlan): number[] {
  const { low, high } = applyJointPlan(wasm, m, plan);
  try {
    for (const half of [low, high]) {
      expect(half.status()).toBe('NoError');
      expect(countUnpairedEdges(manifoldToMeshData(half))).toBe(0);
      expect(half.volume()).toBeGreaterThan(0);
    }
    // Interferencia cero al juntar las mitades
    const inter = low.intersect(high);
    expect(inter.volume()).toBeLessThan(1e-3);
    inter.delete();
    // Holgura: el macho crecido casi toda la holgura todavía no toca la hembra
    for (const c of plan.connectors) {
      const grown = buildConnectorSolid(wasm, plan.type, plan.axis, c.center, c.sizeMm, plan.depthMm, REQ.tolerance - 0.03);
      const touch = grown.intersect(high);
      expect(touch.volume()).toBeLessThan(1e-3);
      touch.delete();
      grown.delete();
    }
    // Volumen: la mitad baja ganó los machos; la alta perdió las hembras
    const walls = plan.connectors.length > 0 ? measuredWalls(high, plan) : [];
    for (const w of walls) expect(w).toBeGreaterThanOrEqual(W - 0.03);
    return walls;
  } finally {
    low.delete();
    high.delete();
  }
}

describe('reglas de tamaño', () => {
  it('diámetro máximo = ancho local − 2·pared − 2·holgura; bajo el mínimo útil no hay conector', () => {
    // Ancho local 6 mm (distancia al borde 3): radio máx 3 − 1,2 − 0,25 − 0,02 = 1,53 → 1,5 (paso 0,05)
    expect(maxConnectorSize('dowel', 3, 0.25, W)).toBeCloseTo(1.5, 6);
    expect(maxConnectorSize('dowel', 1, 0.25, W)).toBeLessThan(JOINT_RULES.minUsefulRadiusMm);
    expect(maxConnectorSize('dowel', 30, 0.25, W)).toBeCloseTo(28.5, 6);
  });

  it('nivel: firme con ≥ 2 conectores y área suficiente; débil con área baja; pegada sin conectores', () => {
    expect(jointLevel({ count: 2, areaRatio: 0.02, islands: 1, islandsCovered: 1, depthMm: 6 }).level).toBe('firm');
    expect(jointLevel({ count: 1, areaRatio: 0.02, islands: 1, islandsCovered: 1, depthMm: 6 }).level).toBe('fair');
    expect(jointLevel({ count: 2, areaRatio: 0.001, islands: 1, islandsCovered: 1, depthMm: 6 }).level).toBe('weak');
    expect(jointLevel({ count: 0, areaRatio: 0, islands: 1, islandsCovered: 0, depthMm: 0 }).level).toBe('glue');
  });
});

describe('medida de la sección', () => {
  it('placa 100 × 60: área 6000, una isla, círculo inscrito de radio 30', () => {
    const cs = wasm.CrossSection.square([100, 60], true);
    const s = measureCrossSection(cs);
    cs.delete();
    expect(s.areaMm2).toBeCloseTo(6000, 3);
    expect(s.islands.length).toBe(1);
    expect(s.islands[0].inscribedRadiusMm).toBeGreaterThan(29.9);
    expect(s.islands[0].inscribedRadiusMm).toBeLessThanOrEqual(30 + 1e-6);
  });

  it('anillo de radios 12 y 20: una isla con un agujero y círculo inscrito de radio 4', () => {
    const outer = wasm.CrossSection.circle(20, 96);
    const inner = wasm.CrossSection.circle(12, 96);
    const ring = outer.subtract(inner);
    const s = measureCrossSection(ring);
    [outer, inner, ring].forEach((c) => c.delete());
    expect(s.islands.length).toBe(1);
    expect(s.islands[0].holes).toBe(1);
    expect(s.islands[0].inscribedRadiusMm).toBeGreaterThan(3.9);
    expect(s.islands[0].inscribedRadiusMm).toBeLessThan(4.05);
  });
});

describe('plan de unión sobre geometría conocida', () => {
  it('placa gruesa 100 × 60 × 20: varios conectores a tamaño completo, firme', () => {
    const m = wasm.Manifold.cube([100, 60, 20], true);
    const plan = planJointConnectors(m, 'z', 0, REQ);
    expect(plan.connectors.length).toBeGreaterThanOrEqual(2);
    expect(plan.connectors.every((c) => c.sizeMm === 4 && c.shrunk.length === 0)).toBe(true);
    expect(plan.level).toBe('firm');
    const walls = checkHalves(m, plan);
    console.info(`[uniones] placa: ${plan.connectors.length} × r${plan.connectors[0].sizeMm}, pared mín ${Math.min(...walls).toFixed(2)} mm`);
    m.delete();
  });

  it('barra 6 × 6 × 40: un conector reducido al máximo que deja la pared', () => {
    const m = wasm.Manifold.cube([6, 6, 40], true);
    const plan = planJointConnectors(m, 'z', 0, REQ);
    expect(plan.connectors.length).toBe(1);
    const c = plan.connectors[0];
    expect(c.sizeMm).toBeLessThan(REQ.size);
    expect(c.sizeMm).toBeGreaterThanOrEqual(JOINT_RULES.minUsefulRadiusMm);
    expect(c.shrunk.map((s) => s.reason)).toContain('section-width');
    const walls = checkHalves(m, plan);
    console.info(`[uniones] barra 6×6: r${c.sizeMm}, pared mín ${Math.min(...walls).toFixed(2)} mm, nivel ${plan.level}`);
    m.delete();
  });

  it('lámina de 2 mm: sin conector, aviso de unión solo pegada', () => {
    const m = wasm.Manifold.cube([80, 2, 40], true);
    const plan = planJointConnectors(m, 'z', 0, REQ);
    expect(plan.connectors.length).toBe(0);
    expect(plan.level).toBe('glue');
    expect(plan.discarded[0]).toMatchObject({ island: 0, reason: 'section-narrow' });
    expect(plan.warnings.map((w) => w.code)).toEqual(['JOINT_GLUE_ONLY']);
    checkHalves(m, plan);
    m.delete();
  });

  it('sección de dos islas: al menos un conector en cada una', () => {
    const a = wasm.Manifold.cube([20, 20, 30], true).translate([-30, 0, 0]);
    const b = wasm.Manifold.cube([20, 20, 30], true).translate([30, 0, 0]);
    const m = a.add(b);
    const plan = planJointConnectors(m, 'z', 0, { ...REQ, count: 1 });
    const islands = new Set(plan.connectors.map((c) => c.island));
    expect(islands.size).toBe(2);
    expect(plan.islandsCovered).toBe(2);
    checkHalves(m, plan);
    [a, b, m].forEach((x) => x.delete());
  });

  it('tubo hueco (radios 12 y 20): conectores en la pared, nunca en el hueco', () => {
    const outer = wasm.Manifold.cylinder(40, 20, 20, 96, true);
    const inner = wasm.Manifold.cylinder(42, 12, 12, 96, true);
    const m = outer.subtract(inner);
    const plan = planJointConnectors(m, 'z', 0, REQ);
    expect(plan.connectors.length).toBeGreaterThanOrEqual(2);
    for (const c of plan.connectors) {
      const r = Math.hypot(c.center[0], c.center[1]);
      expect(r - c.sizeMm - REQ.tolerance).toBeGreaterThanOrEqual(12 + W - 0.05);
      expect(r + c.sizeMm + REQ.tolerance).toBeLessThanOrEqual(20 - W + 0.05);
    }
    checkHalves(m, plan);
    [outer, inner, m].forEach((x) => x.delete());
  });

  it('barra inclinada 45°: la profundidad respeta la pared medida con rayos en ambas mitades', () => {
    const bar = wasm.Manifold.cube([24, 24, 60], true);
    const m = bar.rotate([45, 0, 0]);
    const plan = planJointConnectors(m, 'z', 0, REQ);
    expect(plan.connectors.length).toBeGreaterThanOrEqual(1);
    for (const c of plan.connectors) {
      expect(c.highDepthAvailableMm).toBeGreaterThanOrEqual(plan.depthMm + REQ.tolerance + W - 1e-6);
      expect(c.lowDepthAvailableMm).toBeGreaterThanOrEqual(W);
    }
    checkHalves(m, plan);
    [bar, m].forEach((x) => x.delete());
  });

  it('pieza corta: la profundidad se reduce por los rayos y queda el motivo', () => {
    // Sobre el plano solo hay 5 mm de material: 6 + 0,25 + 1,2 no cabe → 3,55 mm
    const m = wasm.Manifold.cube([60, 60, 25], true).translate([0, 0, -7.5]);
    const plan = planJointConnectors(m, 'z', 0, REQ);
    expect(plan.connectors.length).toBeGreaterThanOrEqual(2);
    expect(plan.depthMm).toBeCloseTo(5 - REQ.tolerance - W, 1);
    expect(plan.connectors[0].shrunk.map((s) => s.reason)).toContain('depth');
    checkHalves(m, plan);
    m.delete();
  });
});
