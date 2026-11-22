/**
 * @file src/engine/__tests__/splitForBed.perf.test.ts
 * @description Tiempo de planificar "dividir para imprimir" en unos 200 mil triángulos (objetivo
 * < 1 s en solitario). Tiene un umbral en milisegundos, así que corre solo con `npm run test:perf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { normalizeMeshToBed } from '../primitives';
import { planBedSplit, type SplitBed } from '../split';
import { makeObject } from './geometryTestUtils';

const BED: SplitBed = { widthMm: 250, depthMm: 250, heightMm: 250 };

describe('rendimiento de dividir para imprimir', () => {
  it('planifica unos 200 mil triángulos en tiempo acotado', async () => {
    const wasm = await initManifoldEngine();
    const sphere = wasm.Manifold.sphere(300, 640).scale([1, 1.6, 1]);
    const mesh = manifoldToMeshData(sphere);
    const bb = sphere.boundingBox();
    const obj = makeObject('esfera', normalizeMeshToBed(mesh), {
      position: [(bb.min[0] + bb.max[0]) / 2, bb.min[1], (bb.min[2] + bb.max[2]) / 2],
    });
    sphere.delete();
    const tris = obj.mesh.indices.length / 3;
    const plan = await planBedSplit(obj, BED);
    console.info(`[split] plan ${tris} triángulos: ${plan.elapsedMs.toFixed(0)} ms, ${plan.pieces.length} piezas`);
    expect(tris).toBeGreaterThan(180_000);
    // Objetivo: < 1 s en solitario (≈0,7 s medido); el umbral solo detecta una regresión grave.
    expect(plan.elapsedMs).toBeLessThan(20000);
  }, 60_000);
});
