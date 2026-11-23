/**
 * @file src/engine/__tests__/soupWeld.test.ts
 * @description Soldadura de la sopa de triángulos de un STL con menos memoria (en sitio, sin índices
 * secuenciales ni copia cuantizada, tabla que crece): el resultado es idéntico al de `weldVertices`
 * en sopas variadas (duplicados, degenerados, -0, coordenadas grandes, casi iguales bajo la tolerancia).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { weldVertices } from '../manifoldKernel';
import { weldTriangleSoup } from '../io/soupWeld';
import { readSTL } from '../io/stl';
import { cubeStlBinary } from './ioFixtures';

/** Generador determinista (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sopa con vértices tomados de una rejilla chica (muchos repetidos), con ruido bajo la tolerancia. */
function soup(seed: number, triangles: number, grid: number, scale: number): Float32Array {
  const rand = rng(seed);
  const out = new Float32Array(triangles * 9);
  for (let i = 0; i < out.length; i++) {
    const cell = Math.floor(rand() * grid) - grid / 2;
    const jitter = rand() < 0.2 ? (rand() - 0.5) * 2e-6 : 0;
    out[i] = cell * scale + jitter;
    if (rand() < 0.01) out[i] = -0;
  }
  return out;
}

function expectSameAsReference(raw: Float32Array, tolerance = 1e-5) {
  const sequential = new Uint32Array(raw.length / 3).map((_, i) => i);
  const reference = weldVertices(raw.slice(), sequential, tolerance);
  const got = weldTriangleSoup(raw.slice(), tolerance);
  expect(got.positions).toEqual(reference.positions);
  expect(got.indices).toEqual(reference.indices);
}

describe('soldadura de sopa de triángulos', () => {
  it('idéntica a weldVertices en sopas variadas', () => {
    expectSameAsReference(soup(1, 200, 4, 1)); // muy repetida: muchos degenerados
    expectSameAsReference(soup(2, 5_000, 40, 0.5));
    expectSameAsReference(soup(3, 20_000, 4000, 0.01)); // casi sin repetidos: obliga a crecer la tabla
    expectSameAsReference(soup(4, 3_000, 50, 12_345.678)); // coordenadas grandes
    expectSameAsReference(soup(5, 3_000, 50, 1e-5), 1e-4); // otra tolerancia
  });

  it('una sopa vacía o de un triángulo', () => {
    expectSameAsReference(new Float32Array(0));
    expectSameAsReference(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]));
  });

  it('el lector STL sigue dando un cubo cerrado: 8 vértices, 12 triángulos, sin aristas abiertas', () => {
    const model = readSTL(cubeStlBinary(10), 'cubo.stl');
    const part = model.parts[0];
    expect(part.mesh.positions.length / 3).toBe(8);
    expect(part.mesh.indices.length / 3).toBe(12);
    expect(part.openEdges).toBe(0);
  });
});
