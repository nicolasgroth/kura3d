/**
 * @file src/engine/__tests__/splitNatural.perf.test.ts
 * @description Tiempo de «Por las partes de la figura» con ~500 mil triángulos: el perfil de
 * secciones de los tres ejes y los candidatos, y el análisis completo dentro del plan (perfil,
 * medición de candidatos y elección), que se suma al plan de rejilla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { normalizeMeshToBed } from '../primitives';
import { planBedSplit } from '../split';
import { naturalCutCandidates } from '../split/naturalCandidates';
import { makeObject } from './geometryTestUtils';

describe('Por las partes de la figura: rendimiento', () => {
  it('500 mil triángulos: candidatos < 1,5 s y análisis del plan < 4 s', { timeout: 120_000 }, async () => {
    const w = await initManifoldEngine();
    const parts = [
      w.Manifold.sphere(60, 840).translate([0, 60, 0]),
      w.Manifold.cylinder(25, 8, 8, 64).rotate([-90, 0, 0]).translate([0, 115, 0]),
      w.Manifold.sphere(25, 600).translate([0, 160, 0]),
    ];
    const m = w.Manifold.union(parts);
    parts.forEach((p) => p.delete());
    const mesh = manifoldToMeshData(m);
    const bb = m.boundingBox();
    m.delete();
    const tris = mesh.indices.length / 3;
    expect(tris).toBeGreaterThan(400_000);

    const t0 = performance.now();
    const { candidates } = naturalCutCandidates(mesh.positions, mesh.indices);
    const candMs = performance.now() - t0;

    const obj = makeObject('pesa', normalizeMeshToBed(mesh), { position: [0, bb.min[1], 0] });
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 160 }, { allowRotation: false, axes: ['y'], strategy: 'natural', countOccupancy: false });
    console.info(`natural ${tris} tri: candidatos ${candMs.toFixed(0)} ms (${candidates.length}); análisis del plan ${plan.natural?.analysisMs.toFixed(0)} ms, plan ${plan.elapsedMs.toFixed(0)} ms`);
    expect(plan.natural?.naturalCuts).toBe(1);
    expect(candMs).toBeLessThan(1500);
    expect(plan.natural!.analysisMs).toBeLessThan(4000);
  });
});
