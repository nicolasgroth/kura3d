/**
 * @file src/engine/__tests__/splitAssembly.test.ts
 * @description Validación de armado dentro de "dividir para imprimir": cilindro en 5 tramos con espigas
 * (orden lineal, paso y dirección en cada pieza, cierre por volumen) y cubo 2×2×2 con espigas (el
 * arreglo pasa a "para pegar" el mínimo de uniones y las piezas quedan cerradas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { initManifoldEngine } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { executeBedSplitGeometry, planBedSplit, type SplitConnectorOptions } from '../split';
import { objFromM } from './qa5SplitHarness';

const DOWEL: SplitConnectorOptions = { type: 'dowel', size: 3, depth: 5, tolerance: 0.2, count: 1 };
let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

describe('split_for_bed + validación de armado', () => {
  it('cilindro Ø60 × 500 en 5 tramos: orden lineal de abajo hacia arriba y paso en cada pieza', async () => {
    const obj = objFromM(w.Manifold.cylinder(500, 30, 30, 48).rotate([-90, 0, 0]), 'cil');
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 115 }, { connector: DOWEL, axes: ['y'], allowRotation: false });
    expect(plan.counts.y).toBe(5);
    const res = await executeBedSplitGeometry(obj, plan);
    const a = res.assembly!;
    expect(a.blocked).toEqual([]);
    expect(a.fix.glueJoints).toEqual([]);
    expect(a.order.map((s) => s.code)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
    expect(a.order.slice(1).every((s) => s.direction === '-y')).toBe(true);
    expect(res.parts.map((p) => p.assemblyStep)).toEqual([1, 2, 3, 4, 5]);
    expect(a.closure.interference).toEqual([]);
    expect(a.closure.gaps).toEqual([]);
    expect(Math.abs(a.closure.volumeErrorPct!)).toBeLessThan(0.5);
    expect(a.clashes).toEqual([]);
  }, 60_000);

  it('cubo 100 en 2×2×2 con espigas: autoFix deja 5 uniones para pegar y las piezas cierran', async () => {
    const obj = objFromM(w.Manifold.cube([100, 100, 100], true), 'cubo');
    const plan = await planBedSplit(obj, { widthMm: 70, depthMm: 70, heightMm: 70 }, { connector: { ...DOWEL, size: 4 } });
    expect(plan.counts).toEqual({ x: 2, y: 2, z: 2 });
    const res = await executeBedSplitGeometry(obj, plan, { assemblyAllowTypeChange: false });
    const a = res.assembly!;
    expect(a.blocked).toEqual([]);
    expect(a.order).toHaveLength(8);
    expect(a.fix.applied).toBe(true);
    expect(a.fix.glueJoints).toHaveLength(5);
    expect(res.joints.filter((j) => j.kind === 'glue')).toHaveLength(5);
    expect(res.warnings.filter((x) => x.code === 'ASSEMBLY_JOINT_GLUED_FOR_ORDER')).toHaveLength(5);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
    expect(Math.abs(a.closure.volumeErrorPct!)).toBeLessThan(0.5);
    // Sin arreglo: el informe muestra las piezas trabadas
    const raw = await executeBedSplitGeometry(obj, plan, { assemblyAutoFix: false, assemblyAllowTypeChange: false });
    expect(raw.assembly!.blocked.length).toBeGreaterThan(0);
    expect(raw.assembly!.fix.glueJoints).toHaveLength(5);
  }, 60_000);
});
