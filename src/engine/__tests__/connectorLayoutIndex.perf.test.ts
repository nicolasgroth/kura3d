/**
 * @file src/engine/__tests__/connectorLayoutIndex.perf.test.ts
 * @description Rendimiento de las funciones optimizadas de "dividir para imprimir" contra su versión de
 * referencia anterior, con el mismo resultado: conteo de aristas no pareadas en una esfera irregular de
 * ~400 mil triángulos y orden del punto más lejano en un contorno denso de 20 mil vértices. Tiene
 * umbrales de tiempo, así que corre solo con `npm run test:perf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { farthestPointOrder } from '../cutConnectorLayout';
import { EvenOddIndex } from '../cutConnectorPolygonIndex';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { countUnpairedEdgesRef, farthestPointOrderRef, insidePolygonsRef, irregularPolys, rng, type Vec2 } from './connectorLayoutReference';

function timed<T>(f: () => T): { value: T; ms: number } {
  const t0 = performance.now();
  const value = f();
  return { value, ms: performance.now() - t0 };
}

describe('rendimiento de la ubicación de conectores y del cierre de malla', () => {
  it('cuenta aristas no pareadas en ~400 mil triángulos mucho más rápido y con el mismo número', async () => {
    const wasm = await initManifoldEngine();
    const sphere = wasm.Manifold.sphere(80, 896);
    const bumpy = sphere.warp((v) => {
      const k = 1 + 0.08 * Math.sin(5 * v[0] / 20) * Math.cos(3 * v[1] / 20) + 0.03 * Math.sin(11 * v[2] / 20);
      v[0] *= 1.3 * k;
      v[1] *= 0.9 * k;
      v[2] *= k;
    });
    const mesh = manifoldToMeshData(bumpy);
    sphere.delete();
    bumpy.delete();
    expect(mesh.indices.length / 3).toBeGreaterThan(380_000);
    const open = { ...mesh, indices: mesh.indices.slice(0, mesh.indices.length - 300) };
    for (const m of [mesh, open]) {
      const ref = timed(() => countUnpairedEdgesRef(m));
      const now = timed(() => countUnpairedEdges(m));
      console.info(`[cierre] ${m.indices.length / 3} triángulos: referencia ${ref.ms.toFixed(0)} ms, nueva ${now.ms.toFixed(0)} ms`);
      expect(now.value).toBe(ref.value);
      expect(now.ms * 4).toBeLessThan(ref.ms);
    }
  }, 120_000);

  it('ordena por punto más lejano en un contorno denso mucho más rápido y con el mismo orden', () => {
    const rand = rng(5);
    const polys = irregularPolys(rand, 20_000);
    const grid: Vec2[] = [];
    for (let u = -60; u <= 60; u += 3) for (let v = -60; v <= 60; v += 3) grid.push([u, v]);
    const inside = new EvenOddIndex(polys);
    const sample = timed(() => grid.filter((p) => inside.contains(p)));
    const sampleRef = timed(() => grid.filter((p) => insidePolygonsRef(p, polys)));
    expect(sample.value).toEqual(sampleRef.value);
    const candidates = [...sample.value, ...polys.flat()];
    const ref = timed(() => farthestPointOrderRef(candidates, polys, 6, 8));
    const now = timed(() => farthestPointOrder(candidates, polys, 6, 8));
    console.info(`[conectores] ${candidates.length} candidatos × ${polys.flat().length} aristas: referencia ${ref.ms.toFixed(0)} ms, nueva ${now.ms.toFixed(0)} ms`);
    expect(now.value).toEqual(ref.value);
    expect(now.ms * 20).toBeLessThan(ref.ms);
  }, 120_000);
});
