/**
 * @file src/engine/__tests__/colorSplitMeshQuality.test.ts
 * @description Calidad de la malla de cada pieza de "separar por colores", medida como la mediría un
 * lector de STL: posiciones en float32 soldadas a 1e-5 mm. Cada arista debe pertenecer a exactamente
 * 2 triángulos, sin triángulos de área ~0 ni triángulos duplicados (esfera, cilindro con franja y texto).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

// Pruebas con booleanas pesadas: el tope por defecto (5 s) no alcanza con la máquina cargada.
vi.setConfig({ testTimeout: 60_000 });
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { stlDefects } from '../colorSplitCleanup';
import { splitMeshByColorSolid } from '../colorSplitSolid';
import { initManifoldEngine } from '../manifoldKernel';
import { paintMeshFacesInSphere } from '../paint/brush';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';

const WHITE = '#ffffff';
const RED = '#ff0000';

function obj(mesh: MeshData): SceneObject {
  return {
    id: 'o', name: 'o', source: 'primitive', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: WHITE, role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
  };
}

function paintByCentroid(mesh: MeshData, pick: (c: number[], n: number[]) => boolean): MeshData {
  const P = mesh.positions, I = mesh.indices;
  const colors: string[] = [];
  for (let t = 0; t < I.length / 3; t++) {
    const v = [0, 1, 2].map((k) => [P[I[t * 3 + k] * 3], P[I[t * 3 + k] * 3 + 1], P[I[t * 3 + k] * 3 + 2]]);
    const c = [0, 1, 2].map((a) => (v[0][a] + v[1][a] + v[2][a]) / 3);
    const e1 = v[1].map((x, a) => x - v[0][a]), e2 = v[2].map((x, a) => x - v[0][a]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    colors.push(pick(c, n.map((x) => x / l)) ? RED : WHITE);
  }
  return { ...mesh, faceColors: colors };
}

function minFeature(mesh: MeshData): { area: number; edge: number } {
  const P = mesh.positions, I = mesh.indices;
  let area = Infinity, edge = Infinity;
  const pt = (i: number) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [pt(I[t]), pt(I[t + 1]), pt(I[t + 2])];
    const u = b.map((x, k) => x - a[k]), v = c.map((x, k) => x - a[k]), w = c.map((x, k) => x - b[k]);
    area = Math.min(area, 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]));
    edge = Math.min(edge, Math.hypot(...u), Math.hypot(...v), Math.hypot(...w));
  }
  return { area, edge };
}

async function expectCleanParts(o: SceneObject, depthMm: number) {
  const { parts } = await splitMeshByColorSolid(o, { depthMm });
  expect(parts.length).toBeGreaterThanOrEqual(2);
  for (const p of parts) {
    // Como un lector de STL: posiciones float32 soldadas a 1e-5 mm.
    expect({ color: p.color, ...stlDefects(p.mesh, 1e-5) }).toEqual({ color: p.color, badEdges: 0, degenerate: 0, duplicates: 0 });
    expect(computeMeshStats(p.mesh).isManifold).toBe(true);
    // Sin triángulos casi degenerados ni aristas por debajo de 1 µm en los bordes irregulares.
    expect(minFeature(p.mesh).area).toBeGreaterThan(1e-7);
    expect(minFeature(p.mesh).edge).toBeGreaterThan(1e-3);
  }
  return parts;
}

describe('malla de las piezas de separar por colores', () => {
  beforeAll(async () => { await initManifoldEngine(); });

  it('esfera mitad y mitad (1 mm)', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 25, segments: 48 });
    await expectCleanParts(obj(paintByCentroid(sphere, (c) => c[0] > 0)), 1);
  });

  it('cilindro con una franja vertical', async () => {
    const cyl = await createPrimitiveMesh('cylinder', { radius: 10, height: 60, segments: 48 });
    await expectCleanParts(obj(paintByCentroid(cyl, (c, n) => Math.abs(n[1]) < 0.1 && Math.abs(Math.atan2(c[2], c[0])) < 0.6)), 1);
  });

  it('texto pintado con pincel', async () => {
    let o = obj(await createPrimitiveMesh('box', { width: 80, height: 5, depth: 40 }));
    const strokes: Vec3[] = [];
    for (let x = -30; x <= -10; x += 2) strokes.push([x, 5, -10]);
    for (let z = -10; z <= 10; z += 2) strokes.push([-20, 5, z]);
    for (const p of strokes) o = { ...o, mesh: paintMeshFacesInSphere(o, p, 1.5, RED, { refineEdge: true }) };
    await expectCleanParts(o, 0.8);
  }, 30_000);
});
