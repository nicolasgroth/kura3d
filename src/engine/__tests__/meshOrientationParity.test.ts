/**
 * @file src/engine/__tests__/meshOrientationParity.test.ts
 * @description `orientationState` optimizado (tabla hash numérica y aristas dirigidas en CSR, sin
 * claves string ni Map) da exactamente lo mismo que la versión anterior en mallas variadas: cerradas,
 * abiertas, invertidas, mezcladas, varias cáscaras, sopas sin soldar, degenerados y no manifold.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { orientationState, type OrientableMesh, type OrientationState } from '../meshOrientation';

/** Versión anterior, copiada tal cual como referencia. */
function referenceState(mesh: OrientableMesh): OrientationState {
  const p = mesh.positions;
  const idx = mesh.indices;
  const vertCount = Math.floor(p.length / 3);
  const weld = new Uint32Array(vertCount);
  const keys = new Map<string, number>();
  const inv = 1e5;
  for (let i = 0; i < vertCount; i++) {
    const key = `${Math.round(p[i * 3] * inv)},${Math.round(p[i * 3 + 1] * inv)},${Math.round(p[i * 3 + 2] * inv)}`;
    let id = keys.get(key);
    if (id === undefined) {
      id = keys.size;
      keys.set(key, id);
    }
    weld[i] = id;
  }
  const n = keys.size;
  const directed = new Map<number, number>();
  for (let t = 0; t + 2 < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const u = weld[idx[t + e]];
      const v = weld[idx[t + ((e + 1) % 3)]];
      if (u === v) continue;
      const k = u * n + v;
      const count = (directed.get(k) ?? 0) + 1;
      if (count > 1) return 'inconsistent';
      directed.set(k, count);
    }
  }
  for (const k of directed.keys()) {
    const u = Math.floor(k / n);
    const v = k - u * n;
    if (!directed.has(v * n + u)) return 'open';
  }
  return 'consistent';
}

/** Malla de una esfera UV (cerrada) desplazada; `rings` × `segments`. */
function sphere(rings: number, segments: number, offset = [0, 0, 0], r = 10): { positions: number[]; indices: number[] } {
  const positions: number[] = [];
  const indices: number[] = [];
  positions.push(offset[0], offset[1] + r, offset[2]);
  for (let i = 1; i < rings; i++) {
    const phi = (Math.PI * i) / rings;
    for (let j = 0; j < segments; j++) {
      const th = (2 * Math.PI * j) / segments;
      positions.push(offset[0] + r * Math.sin(phi) * Math.cos(th), offset[1] + r * Math.cos(phi), offset[2] + r * Math.sin(phi) * Math.sin(th));
    }
  }
  positions.push(offset[0], offset[1] - r, offset[2]);
  const bottom = positions.length / 3 - 1;
  const at = (i: number, j: number) => 1 + (i - 1) * segments + (j % segments);
  for (let j = 0; j < segments; j++) indices.push(0, at(1, j + 1), at(1, j));
  for (let i = 1; i < rings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      indices.push(at(i, j), at(i, j + 1), at(i + 1, j));
      indices.push(at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
    }
  }
  for (let j = 0; j < segments; j++) indices.push(at(rings - 1, j), at(rings - 1, j + 1), bottom);
  return { positions, indices };
}

const toMesh = (m: { positions: number[]; indices: number[] }): OrientableMesh => ({
  positions: new Float32Array(m.positions),
  indices: new Uint32Array(m.indices),
});

/** Sopa sin soldar (cada triángulo con sus tres vértices), como un STL sin índices compartidos. */
function unweld(m: { positions: number[]; indices: number[] }) {
  const positions: number[] = [];
  for (const i of m.indices) positions.push(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]);
  return { positions, indices: positions.map((_, i) => i).filter((i) => i < positions.length / 3) };
}

function merge(...meshes: Array<{ positions: number[]; indices: number[] }>) {
  const out = { positions: [] as number[], indices: [] as number[] };
  for (const m of meshes) {
    const base = out.positions.length / 3;
    out.positions.push(...m.positions);
    out.indices.push(...m.indices.map((i) => i + base));
  }
  return out;
}

const flipAll = (m: { positions: number[]; indices: number[] }) => {
  const indices = [...m.indices];
  for (let t = 0; t < indices.length; t += 3) [indices[t + 1], indices[t + 2]] = [indices[t + 2], indices[t + 1]];
  return { positions: m.positions, indices };
};

const flipOne = (m: { positions: number[]; indices: number[] }, t: number) => {
  const indices = [...m.indices];
  [indices[t * 3 + 1], indices[t * 3 + 2]] = [indices[t * 3 + 2], indices[t * 3 + 1]];
  return { positions: m.positions, indices };
};

const dropOne = (m: { positions: number[]; indices: number[] }, t: number) => ({
  positions: m.positions,
  indices: [...m.indices.slice(0, t * 3), ...m.indices.slice(t * 3 + 3)],
});

describe('orientationState: igual que la versión anterior', () => {
  const ball = sphere(12, 16);
  const other = sphere(8, 10, [40, 0, 0], 5);
  const cases: Record<string, { positions: number[]; indices: number[] }> = {
    cerrada: ball,
    abierta: dropOne(ball, 7),
    invertida: flipAll(ball),
    mezclada: flipOne(ball, 20),
    'varias cáscaras': merge(ball, flipAll(other)),
    'cáscaras, una abierta': merge(ball, dropOne(other, 3)),
    'sopa sin soldar cerrada': unweld(ball),
    'sopa sin soldar abierta': unweld(dropOne(ball, 0)),
    'sopa mezclada': unweld(flipOne(ball, 5)),
    // Triángulo degenerado (dos esquinas en el mismo punto) y arista no manifold (tres caras).
    degenerado: { positions: [...ball.positions, 0, 10, 0], indices: [...ball.indices, 0, ball.positions.length / 3, 1] },
    'no manifold': merge(ball, { positions: [ball.positions[0], ball.positions[1], ball.positions[2], ball.positions[3], ball.positions[4], ball.positions[5], 99, 99, 99], indices: [0, 1, 2] }),
    vacía: { positions: [], indices: [] },
    'un triángulo': { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] },
    // Coordenadas casi iguales bajo la tolerancia de 1e-5 mm, y -0.
    'casi iguales': merge(ball, { positions: ball.positions.map((v) => (v === 0 ? -0 : v + 3e-6)), indices: flipAll(ball).indices }),
  };

  for (const [name, mesh] of Object.entries(cases)) {
    it(name, () => {
      expect(orientationState(toMesh(mesh))).toBe(referenceState(toMesh(mesh)));
    });
  }

  it('mallas aleatorias (sopas con repetidos)', () => {
    let seed = 7;
    const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
    for (let k = 0; k < 40; k++) {
      const vertices = 3 + Math.floor(rand() * 30);
      const positions = Array.from({ length: vertices * 3 }, () => Math.floor(rand() * 4));
      const indices = Array.from({ length: (1 + Math.floor(rand() * 40)) * 3 }, () => Math.floor(rand() * vertices));
      const mesh = toMesh({ positions, indices });
      expect(orientationState(mesh)).toBe(referenceState(mesh));
    }
  });
});
