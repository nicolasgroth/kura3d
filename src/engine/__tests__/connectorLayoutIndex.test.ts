/**
 * @file src/engine/__tests__/connectorLayoutIndex.test.ts
 * @description Igualdad exacta (número por número) entre las funciones optimizadas de la ubicación de
 * conectores y del conteo de aristas no pareadas y sus versiones de referencia anteriores
 * (`connectorLayoutReference.ts`): distancia al borde con rejilla de segmentos, regla par-impar por
 * bandas, orden del punto más lejano incremental y conteo de aristas con hash numérico.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { farthestPointOrder } from '../cutConnectorLayout';
import { EvenOddIndex, SegmentDistanceIndex } from '../cutConnectorPolygonIndex';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import {
  countUnpairedEdgesRef, distanceToBoundaryRef, farthestPointOrderRef, insidePolygonsRef, irregularPolys, rng, type Vec2,
} from './connectorLayoutReference';

function probes(rand: () => number, n: number, span: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) out.push([(rand() * 2 - 1) * span, (rand() * 2 - 1) * span]);
  return out;
}

describe('índices de contorno de la ubicación de conectores', () => {
  it('la distancia al borde coincide exactamente con el recorrido completo', () => {
    const rand = rng(7);
    for (const n of [3, 4, 17, 300, 5000]) {
      const polys = irregularPolys(rand, n, [rand() * 10, rand() * 10]);
      const idx = new SegmentDistanceIndex(polys);
      // Puntos dentro, fuera de la rejilla y sobre vértices
      const pts = [...probes(rand, 400, 120), ...polys[0].slice(0, 50)];
      for (const p of pts) expect(idx.distance(p)).toBe(distanceToBoundaryRef(p, polys));
    }
  });

  it('la regla par-impar coincide exactamente (con agujeros, vértices y horizontales)', () => {
    const rand = rng(11);
    const square: Vec2[][] = [[[0, 0], [10, 0], [10, 10], [0, 10]], [[2, 2], [2, 8], [8, 8], [8, 2]]];
    const sq = new EvenOddIndex(square);
    for (let u = -1; u <= 11; u += 0.5) for (let v = -1; v <= 11; v += 0.5) expect(sq.contains([u, v])).toBe(insidePolygonsRef([u, v], square));
    for (const n of [5, 64, 2000]) {
      const polys = irregularPolys(rand, n);
      const idx = new EvenOddIndex(polys);
      for (const p of [...probes(rand, 1500, 70), ...polys[0].slice(0, 40)]) expect(idx.contains(p)).toBe(insidePolygonsRef(p, polys));
    }
  });

  it('el orden del punto más lejano es idéntico al de referencia', () => {
    const rand = rng(3);
    for (const [n, maxCount, sep] of [[40, 2, 5], [600, 4, 12], [3000, 7, 3], [200, 3, 500]] as const) {
      const polys = irregularPolys(rand, n);
      const candidates = [...probes(rand, 300, 30).filter((p) => insidePolygonsRef(p, polys)), ...polys[0]];
      expect(farthestPointOrder(candidates, polys, maxCount, sep)).toEqual(farthestPointOrderRef(candidates, polys, maxCount, sep));
    }
  });

  it('coincide sobre una sección real de Manifold (esfera irregular)', async () => {
    const wasm = await initManifoldEngine();
    const s = wasm.Manifold.sphere(50, 256).scale([1.3, 0.8, 1]);
    const cs = s.slice(7);
    const polys = cs.toPolygons() as Vec2[][];
    const safe = cs.offset(-6, 'Round');
    const candidates = [...(safe.toPolygons() as Vec2[][]).flat()];
    expect(polys.flat().length).toBeGreaterThan(200);
    expect(farthestPointOrder(candidates, polys, 3, 10)).toEqual(farthestPointOrderRef(candidates, polys, 3, 10));
    for (const o of [s, cs, safe]) o.delete();
  });
});

describe('conteo de aristas no pareadas con hash numérico', () => {
  const cases = async (): Promise<Array<[string, MeshData]>> => {
    const wasm = await initManifoldEngine();
    const sphere = wasm.Manifold.sphere(10, 48);
    const closed = manifoldToMeshData(sphere);
    sphere.delete();
    const open: MeshData = { ...closed, indices: closed.indices.slice(0, closed.indices.length - 30) };
    const doubled: MeshData = { ...closed, indices: new Uint32Array([...closed.indices, ...closed.indices.slice(0, 9)]) };
    const flipped = closed.indices.slice();
    for (let t = 0; t < 30; t += 3) [flipped[t + 1], flipped[t + 2]] = [flipped[t + 2], flipped[t + 1]];
    // Vértices casi coincidentes (bajo y sobre la celda de 1e-4) y un triángulo degenerado
    const near = new Float32Array([...closed.positions, closed.positions[0] + 4e-5, closed.positions[1], closed.positions[2], closed.positions[3] + 3e-4, closed.positions[4], closed.positions[5]]);
    const nv = closed.positions.length / 3;
    const nearIdx = closed.indices.slice();
    nearIdx[0] = nv;
    nearIdx[4] = nv + 1;
    const degenerate = new Uint32Array([...closed.indices, 0, 0, 1, nv, 0, 2]);
    return [
      ['cerrada', closed],
      ['abierta', open],
      ['duplicada', doubled],
      ['invertida', { ...closed, indices: flipped }],
      ['casi coincidentes', { ...closed, positions: near, indices: nearIdx }],
      ['degenerada', { ...closed, positions: near, indices: degenerate }],
      ['vacía', { positions: new Float32Array(), indices: new Uint32Array(), normals: new Float32Array() }],
    ];
  };

  it('da el mismo número que la versión con claves string', async () => {
    for (const [name, mesh] of await cases()) {
      for (const weld of [1e-4, 1e-6, 0.05]) {
        expect({ name, weld, n: countUnpairedEdges(mesh, weld) }).toEqual({ name, weld, n: countUnpairedEdgesRef(mesh, weld) });
      }
    }
  });
});
