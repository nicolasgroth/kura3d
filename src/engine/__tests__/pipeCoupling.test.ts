/**
 * @file src/engine/__tests__/pipeCoupling.test.ts
 * @description Acople de tubería: macho y hembra (roscados o a presión) son sólidos cerrados con las medidas y el
 * volumen esperados, el paso interior queda libre de punta a punta (armados), la holgura medida con Manifold calza con
 * la pedida, holgura 0 o negativa no se da por buena, y las entradas inválidas son errores tipados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../meshStats';
import { EngineError } from '../engineErrors';
import { initManifoldEngine } from '../manifoldKernel';
import {
  buildPipeCouplingSolids,
  createPipeCoupling,
  pipeCouplingFit,
} from '../pipeCoupling';
import { layoutPipeCoupling, PIPE_COUPLING_MIN_WALL_MM, resolvePipeCoupling } from '../pipeCouplingLayout';

function bbox(positions: Float32Array) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  return { min, max, size: [0, 1, 2].map((k) => max[k] - min[k]) };
}

describe('acople de tubería: validación', () => {
  it('valores por defecto: roscado, holgura 0,3; a presión, 0,15', () => {
    expect(resolvePipeCoupling({}).joint).toBe('thread');
    expect(resolvePipeCoupling({}).clearanceMm).toBeCloseTo(0.3, 9);
    expect(resolvePipeCoupling({ joint: 'press' }).clearanceMm).toBeCloseTo(0.15, 9);
  });

  it.each([
    [{ boreDiameterMm: 1 }],
    [{ wallMm: 0.5 }],
    [{ clearanceMm: -0.1 }],
    [{ pitchMm: 20 }],
    [{ starts: 1.5 }],
    [{ turns: 0 }],
    [{ tailLengthMm: Number.NaN }],
    [{ joint: 'glue' as never }],
    [{ engageMm: 200 }],
  ])('%j: error tipado INVALID_PARAMETER', (opts) => {
    try {
      resolvePipeCoupling(opts);
      throw new Error('no lanzó');
    } catch (error) {
      expect(error).toBeInstanceOf(EngineError);
      expect((error as EngineError).code).toBe('INVALID_PARAMETER');
    }
  });

  it('el mínimo imprimible de pared queda documentado como constante', () => {
    expect(PIPE_COUPLING_MIN_WALL_MM).toBe(1.2);
  });
});

describe('acople de tubería: geometría', () => {
  it.each([
    ['roscado', { joint: 'thread' as const }],
    ['a presión', { joint: 'press' as const }],
    ['roscado de dos entradas, tubo fino', { joint: 'thread' as const, boreDiameterMm: 6, wallMm: 1.2, starts: 2, turns: 2, pitchMm: 2 }],
    ['a presión, grande', { joint: 'press' as const, boreDiameterMm: 80, wallMm: 3, engageMm: 30 }],
  ])('%s: macho y hembra cerrados, apoyados y con el alto esperado', async (_label, opts) => {
    const { male, female, spec, layout } = await createPipeCoupling(opts);
    const sm = computeMeshStats(male);
    const sf = computeMeshStats(female);
    expect(sm.isManifold).toBe(true);
    expect(sf.isManifold).toBe(true);
    const bm = bbox(male.positions);
    const bf = bbox(female.positions);
    expect(bm.min[1]).toBeCloseTo(0, 4);
    expect(bf.min[1]).toBeCloseTo(0, 4);
    expect(bm.size[1]).toBeCloseTo(layout.maleHeightMm, 2);
    expect(bf.size[1]).toBeCloseTo(layout.femaleHeightMm, 2);
    // Diámetro exterior: el de la hembra y el del tramo liso del macho son iguales (el tubo sigue parejo).
    expect(bm.size[0]).toBeCloseTo(2 * layout.outerRadiusMm, 0);
    expect(bf.size[0]).toBeCloseTo(2 * layout.outerRadiusMm, 0);
    expect(layout.tailLengthMm).toBe(spec.tailLengthMm);
  });

  it('a presión: volumen del macho ≈ tramo liso + espiga cónica − paso interior (chaflán < 1 %)', async () => {
    const { male, layout } = await createPipeCoupling({ joint: 'press' });
    const L = layout;
    const frustum = (r0: number, r1: number, h: number) => (Math.PI * h * (r0 * r0 + r0 * r1 + r1 * r1)) / 3;
    const expected = Math.PI * L.outerRadiusMm ** 2 * L.tailLengthMm
      + frustum(L.spigotBaseRadiusMm, L.spigotTipRadiusMm, L.engageLengthMm)
      - Math.PI * L.boreRadiusMm ** 2 * L.maleHeightMm;
    const v = computeMeshStats(male).volumeMm3;
    // Facetas: el polígono inscrito de N lados tiene área (N/2π)·sin(2π/N) del círculo.
    const facet = (L.columns / (2 * Math.PI)) * Math.sin((2 * Math.PI) / L.columns);
    expect(v).toBeGreaterThan(expected * facet * 0.985);
    expect(v).toBeLessThan(expected * 1.005);
  });

  it.each(['thread', 'press'] as const)('%s: armados, el paso interior queda libre de punta a punta', async (joint) => {
    const wasm = await initManifoldEngine();
    const spec = resolvePipeCoupling({ joint });
    const { male, female, layout } = buildPipeCouplingSolids(wasm, spec);
    const top = layout.seatZ + layout.femaleHeightMm;
    const probe = wasm.Manifold.cylinder(top + 2, layout.boreRadiusMm - 0.02, layout.boreRadiusMm - 0.02, 64, false).translate([0, 0, -1]);
    try {
      expect(male.intersect(probe).volume()).toBeLessThan(1e-6);
      expect(female.intersect(probe).volume()).toBeLessThan(1e-6);
      // Y el paso es justo el pedido: un cilindro algo mayor sí toca las paredes.
      const wider = wasm.Manifold.cylinder(top + 2, layout.boreRadiusMm + 0.1, layout.boreRadiusMm + 0.1, 64, false).translate([0, 0, -1]);
      expect(male.intersect(wider).volume()).toBeGreaterThan(0.1);
      expect(female.intersect(wider).volume()).toBeGreaterThan(0.1);
      wider.delete();
    } finally {
      probe.delete();
      male.delete();
      female.delete();
    }
  });

  it('la pared mínima es la pedida, en las dos mitades y en los dos tipos', () => {
    for (const joint of ['thread', 'press'] as const) {
      const L = layoutPipeCoupling(resolvePipeCoupling({ joint, wallMm: 1.6 }));
      expect(L.minWallMm).toBeCloseTo(1.6, 6);
    }
  });
});

describe('acople de tubería: verificación', () => {
  it('roscado por defecto: enrosca sin interferir, holgura ≈ 0,3 mm', async () => {
    const r = await pipeCouplingFit({ joint: 'thread' });
    expect(r.status).toBe('ok');
    expect(r.joint).toBe('thread');
    expect(r.maxInterferenceMm3).toBeLessThan(1e-3);
    expect(r.minClearanceMm).toBeGreaterThan(0.22);
    expect(r.minClearanceMm).toBeLessThan(0.36);
    expect(r.thinWall).toBe(false);
  });

  it.each([0.15, 0.3, 0.5])('a presión con holgura %f mm: la medida calza con la pedida (±0,03)', async (c) => {
    const r = await pipeCouplingFit({ joint: 'press', clearanceMm: c });
    expect(r.status).toBe('ok');
    expect(r.minClearanceMm).toBeGreaterThan(c - 0.03);
    expect(r.minClearanceMm).toBeLessThan(c + 0.03);
  });

  it('holgura 0: no se da por buena (roscado y a presión)', async () => {
    expect((await pipeCouplingFit({ joint: 'thread', clearanceMm: 0 })).fits).toBe(false);
    expect((await pipeCouplingFit({ joint: 'press', clearanceMm: 0 })).fits).toBe(false);
  });

  it('holgura negativa (a presión): mide la interferencia en volumen', async () => {
    const spec = { ...resolvePipeCoupling({ joint: 'press' }), clearanceMm: -0.2 };
    const r = await pipeCouplingFit(spec, { trusted: true });
    expect(r.status).toBe('interference');
    expect(r.maxInterferenceMm3).toBeGreaterThan(1);
  });

  it('pared bajo el mínimo imprimible: la verificación lo marca', async () => {
    const r = await pipeCouplingFit({ joint: 'press', wallMm: 1 });
    expect(r.thinWall).toBe(true);
    expect(r.minWallMm).toBeCloseTo(1, 6);
  });
});
