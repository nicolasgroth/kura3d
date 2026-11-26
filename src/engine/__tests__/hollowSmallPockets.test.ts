/**
 * @file src/engine/__tests__/hollowSmallPockets.test.ts
 * @description Ahuecar una pieza cuya cavidad interior se parte en una grande y bolsas diminutas (como
 * las de una malla autointersecada de terceros): las bolsas bajo el umbral quedan macizas, el resultado
 * informa cuántas se descartaron y el drenaje solo perfora la cavidad real.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { computeMeshStats } from '../index';
import { hollowMeshDetailed } from '../hollow';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { countMeshBodies } from '../io/meshBodies';
import { OPERATION_DEFAULTS } from '../operationLimits';
import { makeObject } from './geometryTestUtils';

const BIG = 40;
const SMALL = 7;
const WALL = 2;

let mesh: MeshData;

beforeAll(async () => {
  const wasm = await initManifoldEngine();
  const { Manifold } = wasm;
  // Caja grande y una caja chica unida por una varilla más delgada que dos paredes: la cavidad de la
  // chica (3 mm de lado, 27 mm³) queda separada de la grande (36 mm de lado, 46 656 mm³).
  const big = Manifold.cube([BIG, BIG, BIG], false);
  const rod = Manifold.cube([6, 2, 2], false).translate([BIG, 19, 19]);
  const small = Manifold.cube([SMALL, SMALL, SMALL], false).translate([BIG + 6, 20 - SMALL / 2, 20 - SMALL / 2]);
  const all = Manifold.union([big, rod, small]);
  mesh = manifoldToMeshData(all);
  for (const m of [big, rod, small, all]) m.delete();
});

describe('ahuecar: bolsas diminutas', () => {
  it('el umbral es una constante de OPERATION_DEFAULTS', () => {
    expect(OPERATION_DEFAULTS.hollow.minCavityFraction).toBeGreaterThan(0);
    expect(OPERATION_DEFAULTS.hollow.minCavityNozzleMm).toBeGreaterThan(0);
  });

  it('la bolsa chica queda maciza, se informa y el resultado es cerrado', async () => {
    const res = await hollowMeshDetailed(makeObject('bolsas', mesh), { enabled: true, wallThickness: WALL } as never);
    expect(res.cavityCount).toBe(1);
    expect(res.discardedCavities).toBe(1);
    expect(res.warnings.map((w) => w.code)).toContain('HOLLOW_POCKETS_FILLED');
    const stats = computeMeshStats(res.mesh);
    expect(stats.isManifold).toBe(true);
    // Exterior + cavidad grande: dos cáscaras (la bolsa no deja cáscara propia).
    expect(countMeshBodies(res.mesh)).toBe(2);
    const solid = BIG ** 3 + 6 * 2 * 2 + SMALL ** 3;
    const cavity = (BIG - 2 * WALL) ** 3;
    // La cavidad sale del campo de distancia en rejilla: ±1 % del cubo interior.
    expect(Math.abs(res.cavityVolumeMm3 - cavity) / cavity).toBeLessThan(0.01);
    // Volumen = sólido − cavidad grande (la bolsa de 27 mm³ no se restó).
    expect(Math.abs(stats.volumeMm3 - (solid - res.cavityVolumeMm3))).toBeLessThan(2);
    expect(stats.dimensionsMm[0]).toBeCloseTo(BIG + 6 + SMALL, 1);
  });

  it('con drenaje, solo la cavidad real recibe su orificio', async () => {
    const res = await hollowMeshDetailed(makeObject('bolsas', mesh), { enabled: true, wallThickness: WALL, drainHole: true, drainHoleRadius: 1.5 } as never);
    expect(res.cavityCount).toBe(1);
    const stats = computeMeshStats(res.mesh);
    expect(stats.isManifold).toBe(true);
    // El drenaje une la cavidad con el exterior: queda una sola cáscara.
    expect(countMeshBodies(res.mesh)).toBe(1);
    const solid = BIG ** 3 + 6 * 2 * 2 + SMALL ** 3;
    // Lo que se quitó además de la cavidad es un solo orificio por la pared del fondo (~π·r²·t, 14 mm³),
    // no dos: la caja chica no se perforó.
    const extra = solid - res.cavityVolumeMm3 - stats.volumeMm3;
    const oneDrain = Math.PI * 1.5 ** 2 * WALL;
    expect(extra).toBeGreaterThan(oneDrain * 0.6);
    expect(extra).toBeLessThan(oneDrain * 1.6);
    expect(stats.dimensionsMm[0]).toBeCloseTo(BIG + 6 + SMALL, 1);
  });
});
