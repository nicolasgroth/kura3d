/**
 * @file src/engine/__tests__/measureCapacity.test.ts
 * @description Capacidad de recipientes contra valores analíticos: vaso, cuenco semiesférico, vaso
 * inclinado, vaso con agujero en la pared, sólido macizo, caja cerrada y dos cavidades.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { measureCapacity } from '../measure/capacity';
import { computeMeshStats } from '../primitives';

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await initManifoldEngine();
});

const SEG = 128;

/** Cilindro de eje vertical (Y interno) con base en y = y0. */
function cylY(r: number, h: number, y0 = 0): Manifold {
  return wasm.Manifold.cylinder(h, r, r, SEG, false).rotate([-90, 0, 0]).translate([0, y0, 0]);
}

const toMesh = (m: Manifold): MeshData => {
  const mesh = manifoldToMeshData(m);
  m.delete();
  return mesh;
};

/** Vaso: radio exterior R, alto H, pared y fondo t. */
function cup(R: number, H: number, t: number): Manifold {
  return cylY(R, H).subtract(cylY(R - t, H, t));
}

/** Área del polígono regular de `SEG` lados inscrito en el círculo de radio r. */
const polyArea = (r: number) => (SEG / 2) * r * r * Math.sin((2 * Math.PI) / SEG);

describe('measureCapacity', () => {
  it('vaso cilíndrico: π r² h interior ±0,5 % y rebalse en el borde', async () => {
    const mesh = toMesh(cup(20, 50, 2));
    expect(computeMeshStats(mesh).isManifold).toBe(true);
    const res = await measureCapacity(mesh, { includeLiquidMesh: true });
    const analytic = Math.PI * 18 * 18 * 48;
    expect(res.basins).toHaveLength(1);
    expect(Math.abs(res.basins[0].maxCapacityMm3 - analytic) / analytic).toBeLessThan(0.005);
    expect(res.basins[0].overflowHeightMm).toBeGreaterThan(50 - 0.06);
    expect(res.basins[0].overflowHeightMm).toBeLessThanOrEqual(50);
    expect(res.sealedCavitiesMm3).toEqual([]);
    expect(res.liquid).not.toBeNull();
    const liq = computeMeshStats(res.liquid!);
    expect(liq.isManifold).toBe(true);
    expect(Math.abs(liq.volumeMm3 - res.filledMm3) / res.filledMm3).toBeLessThan(1e-3);
  });

  it('vaso a medio nivel: π r² (nivel − fondo)', async () => {
    const res = await measureCapacity(toMesh(cup(20, 50, 2)), { levelHeightMm: 26 });
    const expected = polyArea(18) * 24;
    expect(res.levelHeightMm).toBe(26);
    expect(Math.abs(res.filledMm3 - expected) / expected).toBeLessThan(1e-3);
  });

  it('el nivel se limita al rebalse', async () => {
    const res = await measureCapacity(toMesh(cup(20, 50, 2)), { levelHeightMm: 500 });
    expect(res.levelHeightMm).toBeLessThanOrEqual(50);
  });

  it('cuenco semiesférico: 2/3 π r³ ±1 %', async () => {
    const R = 25, r = 22;
    const shell = wasm.Manifold.sphere(R, SEG).subtract(wasm.Manifold.sphere(r, SEG));
    const bowl = shell.trimByPlane([0, -1, 0], 0); // mitad de abajo (y ≤ 0)
    const res = await measureCapacity(toMesh(bowl));
    const analytic = (2 / 3) * Math.PI * r ** 3;
    expect(res.basins).toHaveLength(1);
    expect(Math.abs(res.basins[0].maxCapacityMm3 - analytic) / analytic).toBeLessThan(0.01);
    expect(res.basins[0].overflowHeightMm).toBeCloseTo(R, 0);
  });

  it('vaso inclinado: rebalsa en el punto bajo del borde y cabe menos', async () => {
    const R = 20, H = 50, t = 2, r = R - t, deg = 20;
    const th = (deg * Math.PI) / 180;
    const upright = await measureCapacity(toMesh(cup(R, H, t)));
    const tilted = await measureCapacity(toMesh(cup(R, H, t).rotate([deg, 0, 0])));
    // Rotar en X: y' = y cosθ − z sinθ. Base: punto más bajo del círculo exterior del fondo.
    const baseY = -R * Math.sin(th);
    const rimLow = H * Math.cos(th) - r * Math.sin(th);
    expect(tilted.basins).toHaveLength(1);
    expect(tilted.basins[0].overflowHeightMm).toBeCloseTo(rimLow - baseY, 0);
    expect(tilted.basins[0].maxCapacityMm3).toBeLessThan(upright.basins[0].maxCapacityMm3 * 0.9);
    expect(tilted.basins[0].maxCapacityMm3).toBeGreaterThan(0);
  });

  it('vaso con agujero en la pared: rebalsa a la altura del agujero', async () => {
    const hole = wasm.Manifold.cylinder(30, 2, 2, 32, true).rotate([0, 90, 0]).translate([20, 20, 0]);
    const res = await measureCapacity(toMesh(cup(20, 50, 2).subtract(hole)));
    expect(res.basins).toHaveLength(1);
    expect(res.basins[0].overflowHeightMm).toBeGreaterThan(17.8);
    expect(res.basins[0].overflowHeightMm).toBeLessThan(18.2);
    const expected = polyArea(18) * (res.basins[0].overflowHeightMm - 2);
    expect(res.basins[0].maxCapacityMm3).toBeLessThan(expected * 1.01);
    expect(res.basins[0].maxCapacityMm3).toBeGreaterThan(expected * 0.97);
  });

  it('sólido macizo: capacidad 0', async () => {
    const res = await measureCapacity(toMesh(wasm.Manifold.cube([40, 40, 40], true)), { includeLiquidMesh: true });
    expect(res.basins).toEqual([]);
    expect(res.filledMm3).toBe(0);
    expect(res.liquid).toBeNull();
    expect(res.sealedCavitiesMm3).toEqual([]);
  });

  it('caja cerrada: la cavidad sellada se informa aparte, no como capacidad', async () => {
    const box = wasm.Manifold.cube([40, 40, 40], true).subtract(wasm.Manifold.cube([30, 30, 30], true));
    const res = await measureCapacity(toMesh(box));
    expect(res.basins).toEqual([]);
    expect(res.sealedCavitiesMm3).toHaveLength(1);
    expect(res.sealedCavitiesMm3[0]).toBeCloseTo(27000, 0);
  });

  it('dos cavidades separadas: lista cada una (mayor primero) y mide la elegida', async () => {
    const block = wasm.Manifold.cube([90, 30, 30], false).translate([-45, 0, -15]);
    const pocketA = wasm.Manifold.cube([30, 25, 20], false).translate([-40, 10, -10]); // 30×20×20 bajo el borde
    const pocketB = wasm.Manifold.cube([30, 15, 20], false).translate([5, 20, -10]); // 30×10×20
    const res = await measureCapacity(toMesh(block.subtract(pocketA).subtract(pocketB)), { basinIndex: 1 });
    expect(res.basins).toHaveLength(2);
    expect(res.basins[0].maxCapacityMm3).toBeCloseTo(12000, -2);
    expect(res.basins[1].maxCapacityMm3).toBeCloseTo(6000, -2);
    expect(res.basinIndex).toBe(1);
    expect(res.filledMm3).toBeCloseTo(6000, -2);
  });

  it('cuencas con bordes a distinta altura: cada una con su rebalse', async () => {
    const tall = cup(10, 40, 2).translate([-20, 0, 0]);
    const short = cup(10, 20, 2).translate([20, 0, 0]);
    const bar = wasm.Manifold.cube([30, 2, 4], false).translate([-15, 0, -2]);
    const res = await measureCapacity(toMesh(tall.add(short).add(bar)));
    expect(res.basins).toHaveLength(2);
    const heights = res.basins.map((b) => b.overflowHeightMm).sort((a, b) => a - b);
    expect(heights[0]).toBeCloseTo(20, 0);
    expect(heights[1]).toBeCloseTo(40, 0);
  });
});
