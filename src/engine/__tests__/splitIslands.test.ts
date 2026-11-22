/**
 * @file src/engine/__tests__/splitIslands.test.ts
 * @description "Dividir para imprimir": informe por islas de cada unión y aviso parcial de pegado,
 * marca mínima de puntos (codificación y que toda unión quede identificable), unión que no cierra →
 * corte liso con aviso, aviso de firmeza activa con tope relativo a la sección y cola de milano solo
 * como sugerencia salvo que el usuario la pida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { initManifoldEngine } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { executeBedSplitGeometry, planBedSplit, type SplitConnectorOptions } from '../split';
import { dotCodeGroups } from '../split/splitDotCode';
import { reinforcementCap } from '../split/assemblyConnectors';
import { ASSEMBLY_LIMITS } from '../operationLimits';
import * as H from './splitModelHarness';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});
const dowel: SplitConnectorOptions = { type: 'dowel', size: 4, depth: 10, tolerance: 0.2, count: 2 };

describe('informe por islas', () => {
  it('unión mixta (anillo delgado + varilla): islas con su tipo y aviso parcial de pegado', async () => {
    const { res } = await H.measure(w, H.modelMixed(w, -110), 'mixta', 250, { connector: dowel, planePositions: { x: [-200, 0, 200] } }, {}, 'mixta');
    const j = res!.joints.find((q) => q.a.code === 'A1' && q.b.code === 'B1')!;
    expect(j.kind).toBe('connector');
    const kinds = new Set(j.islands.map((i) => i.kind));
    expect(kinds.has('connector')).toBe(true);
    expect(kinds.has('glue')).toBe(true);
    const ring = j.islands.find((i) => i.kind === 'glue')!;
    expect(ring.minWidthMm).toBeGreaterThan(2);
    expect(ring.minWidthMm).toBeLessThan(4);
    expect(ring.areaMm2).toBeGreaterThan(0);
    const warn = res!.warnings.find((x) => x.code === 'SPLIT_JOINT_PARTIAL_GLUE' && x.params.label === j.label);
    expect(warn).toBeDefined();
    expect(Number(warn!.params.glued)).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it('tubo de pared 2: todas las islas para pegar, sin aviso parcial', async () => {
    const { res } = await H.measure(w, H.modelStraight(w, 2), 'tubo2', 250, { connector: dowel }, {}, 'glue');
    for (const j of res!.joints) {
      expect(j.islands.length).toBeGreaterThan(0);
      expect(j.islands.every((i) => i.kind === 'glue' && i.minWidthMm < 3)).toBe(true);
    }
    expect(res!.warnings.some((x) => x.code === 'SPLIT_JOINT_PARTIAL_GLUE')).toBe(false);
  }, 60_000);
});

describe('marca mínima de puntos', () => {
  it('codifica cada dígito como un grupo de puntos y el 0 como raya', () => {
    expect(dotCodeGroups('1')).toEqual([1]);
    expect(dotCodeGroups('12')).toEqual([1, 2]);
    expect(dotCodeGroups('305')).toEqual([3, 0, 5]);
    expect(() => dotCodeGroups('A')).toThrow();
  });

  it('peine de brazos de 4 mm: las uniones sin espacio para texto llevan la marca de puntos', async () => {
    const { row, res } = await H.measure(w, H.modelComb(w), 'peine', 100, { connector: dowel }, {}, 'peine');
    expect(row.markBothPct).toBe(100);
    expect(res!.joints.some((j) => j.labelPlacement === 'dots')).toBe(true);
    expect(row.unpaired).toBe(0);
  }, 60_000);
});

describe('firmeza activa', () => {
  it('al agrandar el conector avisa con lo pedido y lo aplicado', async () => {
    const obj = H.objFromM(w.Manifold.cylinder(300, 40, 40, 64).rotate([-90, 0, 0]), 'cil');
    const small: SplitConnectorOptions = { type: 'dowel', size: 1.5, depth: 6, tolerance: 0.2, count: 1 };
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 160 }, { connector: small, axes: ['y'], allowRotation: false });
    const res = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: true });
    const warn = res.warnings.find((x) => x.code === 'SPLIT_CONNECTOR_REINFORCED');
    expect(warn).toBeDefined();
    expect(Number(warn!.params.requested)).toBeCloseTo(1.5, 6);
    expect(Number(warn!.params.size)).toBeGreaterThan(1.5);
    // Sin la opción: apagado (OPERATION_DEFAULTS.split.reinforceWeakJoints), el conector queda como se pidió
    const dflt = await executeBedSplitGeometry(obj, plan);
    expect(dflt.warnings.some((x) => x.code === 'SPLIT_CONNECTOR_REINFORCED')).toBe(false);
    expect(dflt.joints[0].connector!.size).toBeCloseTo(1.5, 6);
    const off = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: false });
    expect(off.warnings.some((x) => x.code === 'SPLIT_CONNECTOR_REINFORCED')).toBe(false);
  }, 60_000);

  it('tope relativo: nunca más que la fracción del ancho de la sección ni menos que lo pedido', () => {
    const f = ASSEMBLY_LIMITS.maxReinforceWidthFraction;
    expect(reinforcementCap(3, 12)).toBeCloseTo(Math.max(3, f * 12), 9);
    expect(reinforcementCap(1.5, 12)).toBeCloseTo(f * 12, 9);
    expect(reinforcementCap(3, 400)).toBeLessThanOrEqual(ASSEMBLY_LIMITS.maxRecommendedRadiusMm);
    // Crecer a lo más al doble y nunca más ancho que hondo
    expect(reinforcementCap(3, 400)).toBeCloseTo(ASSEMBLY_LIMITS.maxReinforceGrowth * 3, 9);
    expect(reinforcementCap(3, 400, 4)).toBeCloseTo(4, 9);
    expect(reinforcementCap(10, 400, 4)).toBe(10);
  });

  it('caja de 300 con tarugo suelto de 3 mm: no salta al máximo de 8 mm', async () => {
    const obj = H.objFromM(w.Manifold.cube([300, 300, 300], true), 'caja');
    const c: SplitConnectorOptions = { type: 'loose-dowel', size: 3, depth: 6, tolerance: 0.25, count: 1 };
    const plan = await planBedSplit(obj, { widthMm: 400, depthMm: 400, heightMm: 200 }, { connector: c });
    const res = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: true });
    const j = res.joints[0];
    expect(j.kind).toBe('connector');
    expect(j.connector!.size).toBeGreaterThan(3);
    expect(j.connector!.size).toBeLessThanOrEqual(6 + 1e-9);
    expect(res.warnings.some((x) => x.code === 'SPLIT_CONNECTOR_REINFORCED')).toBe(true);
    // El aviso corresponde al estado final: solo uniones que terminaron con conector
    const ended = new Map(res.joints.map((x) => [x.label, x.kind]));
    for (const w2 of res.warnings.filter((x) => x.code === 'SPLIT_CONNECTOR_REINFORCED' || x.code === 'SPLIT_CONNECTOR_REDUCED')) {
      expect(ended.get(String(w2.params.label))).toBe('connector');
    }
  }, 60_000);

  it('tubo de 1 m pared 12 con conector chico: el radio aplicado respeta el tope de la pared', async () => {
    const small: SplitConnectorOptions = { type: 'dowel', size: 1.5, depth: 6, tolerance: 0.2, count: 1 };
    const { res } = await H.measure(w, H.modelStraight(w, 12), 'tubo12', 250, { connector: small }, {}, 'dowel');
    for (const j of res!.joints) {
      if (j.kind !== 'connector') continue;
      expect(j.connector!.size).toBeGreaterThanOrEqual(1.5);
      expect(j.connector!.size).toBeLessThanOrEqual(ASSEMBLY_LIMITS.maxReinforceWidthFraction * 12 + 1e-6);
    }
  }, 120_000);
});

describe('cambio de tipo que deforma la superficie', () => {
  it('cubo 2×2×2: la cola de milano pasante queda como sugerencia salvo que se pida', async () => {
    const obj = H.objFromM(w.Manifold.cube([100, 100, 100], true), 'cubo');
    const c: SplitConnectorOptions = { type: 'dowel', size: 4, depth: 5, tolerance: 0.2, count: 1 };
    const plan = await planBedSplit(obj, { widthMm: 70, depthMm: 70, heightMm: 70 }, { connector: c });
    const res = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: false });
    expect(res.joints.some((j) => j.connector?.type === 'dovetail')).toBe(false);
    expect(res.warnings.some((x) => x.code === 'ASSEMBLY_JOINT_TYPE_CHANGED')).toBe(false);
    expect(res.assembly!.blocked).toEqual([]);
    expect(res.assembly!.suggestions.some((s) => s.options.includes('change-type:dovetail'))).toBe(true);
    const opt = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: false, assemblyAllowSurfaceChange: true });
    expect(opt.joints.some((j) => j.connector?.type === 'dovetail')).toBe(true);
    for (const p of opt.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
  }, 120_000);
});
