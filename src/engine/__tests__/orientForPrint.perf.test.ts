/**
 * @file src/engine/__tests__/orientForPrint.perf.test.ts
 * @description Tiempo de «Orientar para imprimir» con mallas densas (solo con `npm run test:perf`):
 * esfera densa fundida con una losa (caras planas + superficie curva fina) de ~50 mil y ~250 mil
 * triángulos. Umbrales holgados, en ms; el tiempo por fase se imprime para el documento de diseño.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { analyzeOrientations } from '../orient';
import { prepareOrientWorld } from '../orient/orientWorld';

async function sphereOnSlab(segments: number) {
  const wasm = await initManifoldEngine();
  const sphere = wasm.Manifold.sphere(20, segments);
  const slab = wasm.Manifold.cube([36, 8, 36], true);
  const moved = slab.translate([0, -20, 0]);
  const u = sphere.add(moved);
  const mesh = manifoldToMeshData(u);
  [sphere, slab, moved, u].forEach((m) => m.delete());
  return mesh;
}

describe('Orientar para imprimir: rendimiento', () => {
  for (const [label, segments, limitMs] of [['~50k', 333, 4_000], ['~250k', 745, 15_000]] as const) {
    it(`${label} triángulos dentro de umbral`, async () => {
      const mesh = await sphereOnSlab(segments);
      const input = { mesh, position: [0, 24, 0] as [number, number, number], rotation: [Math.PI / 2, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };
      const t0 = performance.now();
      prepareOrientWorld(input);
      const prepMs = performance.now() - t0;
      const t1 = performance.now();
      const a = analyzeOrientations(input, { bed: { widthMm: 256, depthMm: 256, heightMm: 256, marginMm: 5 } });
      const ms = performance.now() - t1;
      console.log(`[orient.perf] ${a.triangleCount} triángulos: ${Math.round(ms)} ms total (preparación ${Math.round(prepMs)} ms), ${a.candidates.length} candidatos, celda ${a.supportCellMm.toFixed(2)} mm`);
      const best = a.candidates[0];
      // La losa abajo: el apoyo plano gana y la esfera sobre la losa casi no pide soporte.
      expect(best.measures.contactAreaMm2).toBeGreaterThan(36 * 36 * 0.95);
      expect(best.measures.supportVolumeMm3).toBeLessThan(a.candidates.find((c) => c.id === a.currentId)!.measures.supportVolumeMm3);
      expect(ms).toBeLessThan(limitMs);
    }, 120_000);
  }
});
