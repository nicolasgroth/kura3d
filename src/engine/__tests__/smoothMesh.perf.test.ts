/**
 * @file src/engine/__tests__/smoothMesh.perf.test.ts
 * @description Rendimiento de «Suavizar malla» (10 iteraciones de Taubin + detección de daño con BVH)
 * en esferas con ruido de ~50 mil y ~250 mil triángulos regulares (esfera de Manifold), con el
 * desglose por fase (grafo, Taubin, daño). Tiene umbrales de tiempo, así que corre solo con
 * `npm run test:perf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { smoothMesh } from '../smooth';
import { detectSmoothDamage } from '../smooth/smoothDamage';
import { buildSmoothGraph } from '../smooth/smoothGraph';
import { resolveSmoothOptions } from '../smooth/smoothOptions';
import { taubinSmooth } from '../smooth/taubin';
import { withRadialNoise } from './smoothFixtures';

function timed<T>(f: () => T): { value: T; ms: number } {
  const t0 = performance.now();
  const value = f();
  return { value, ms: performance.now() - t0 };
}

async function denseSphere(radius: number, segments: number): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const s = wasm.Manifold.sphere(radius, segments);
  try {
    return manifoldToMeshData(s);
  } finally {
    s.delete();
  }
}

describe('rendimiento de Suavizar', () => {
  it.each([
    ['~50 mil', 316, 3_000],
    ['~250 mil', 708, 15_000],
  ])('%s triángulos', async (_label, segments, maxMs) => {
    const clean = await denseSphere(40, segments);
    const tris = clean.indices.length / 3;
    // Ruido de ±10 % de la arista media.
    const edge = Math.sqrt((4 * Math.PI * 40 * 40) / tris / 0.433);
    const mesh = withRadialNoise(clean, 0.1 * edge);
    const opts = resolveSmoothOptions();
    const graph = timed(() => buildSmoothGraph({ ...mesh, indices: mesh.indices.slice() }, opts));
    const taubin = timed(() => taubinSmooth(mesh.positions, graph.value, 1, 10));
    const moved = new Uint8Array(mesh.positions.length / 3).fill(1);
    const damage = timed(() => detectSmoothDamage(mesh.positions, taubin.value, mesh.indices, graph.value.weld, moved));
    const total = timed(() => smoothMesh(mesh));
    console.info(
      `[suavizar perf] ${tris} tri: total ${total.ms.toFixed(0)} ms (grafo ${graph.ms.toFixed(0)}, ` +
        `Taubin×10 ${taubin.ms.toFixed(0)}, daño ${damage.ms.toFixed(0)}), volumen ${total.value.report.volumeChangePct.toFixed(3)} %` +
        ` intentos ${JSON.stringify(total.value.report.attempts)}`,
    );
    expect(tris).toBeGreaterThan(segments === 316 ? 45_000 : 240_000);
    expect(total.value.report.attempts).toHaveLength(1);
    expect(Math.abs(total.value.report.volumeChangePct)).toBeLessThan(1);
    expect(total.ms).toBeLessThan(maxMs);
  });
});
