/**
 * @file src/engine/__tests__/splitJointStrength.test.ts
 * @description "Uniones firmes" dentro de Dividir para imprimir con el motor real: cada unión trae su
 * informe de firmeza (nivel, conectores, qué se achicó y qué quedó solo para pegar), una barra ancha
 * queda firme, una lámina de 2 mm queda pegada y un conector chico elegido a mano en una sección
 * grande se avisa como débil (`SPLIT_JOINT_WEAK`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../manifoldKernel';
import { executeBedSplitGeometry, planBedSplit, type SplitBed, type SplitConnectorOptions } from '../split';
import { objFrom } from './splitPipeShapes';

type Wasm = Awaited<ReturnType<typeof initManifoldEngine>>;
let wasm: Wasm;
const BED: SplitBed = { widthMm: 200, depthMm: 200, heightMm: 200 };

beforeAll(async () => {
  wasm = await initManifoldEngine();
});

async function split(m: Manifold, connector?: SplitConnectorOptions) {
  const obj = objFrom(m, 'pieza');
  const plan = await planBedSplit(obj, BED, { maxPieces: 'auto', ...(connector ? { connector } : {}) });
  return executeBedSplitGeometry(obj, plan, { labels: 'none' });
}

describe('uniones firmes en Dividir para imprimir', () => {
  it('barra 60 × 60 × 300: unión firme con dos conectores y su informe', async () => {
    const res = await split(wasm.Manifold.cube([60, 300, 60], true));
    expect(res.joints.length).toBe(1);
    const s = res.joints[0].strength!;
    expect(s).toBeDefined();
    expect(s.level).toBe('firm');
    expect(s.count).toBeGreaterThanOrEqual(2);
    expect(s.areaRatio).toBeGreaterThan(0.004);
    expect(s.islandsCovered).toBe(s.islands);
  }, 120_000);

  it('lámina de 2 mm: unión solo pegada, nivel glue y aviso', async () => {
    const res = await split(wasm.Manifold.cube([150, 300, 2], true));
    expect(res.joints.length).toBeGreaterThan(0);
    for (const j of res.joints) {
      expect(j.kind).toBe('glue');
      expect(j.strength?.level).toBe('glue');
    }
    expect(res.warnings.some((w) => w.code === 'SPLIT_JOINT_GLUE_ONLY')).toBe(true);
  }, 120_000);

  it('placa 190 × 300 × 12 con conector de radio 1,5 elegido a mano: débil y avisada', async () => {
    const res = await split(wasm.Manifold.cube([190, 300, 12], true), { type: 'dowel', size: 1.5, depth: 5, tolerance: 0.25, count: 1 });
    const weak = res.joints.filter((j) => j.strength?.level === 'weak');
    expect(weak.length).toBeGreaterThan(0);
    expect(weak[0].strength!.reasons).toContain('low-area');
    expect(res.warnings.some((w) => w.code === 'SPLIT_JOINT_WEAK' && w.params.label === weak[0].label)).toBe(true);
  }, 120_000);
});
