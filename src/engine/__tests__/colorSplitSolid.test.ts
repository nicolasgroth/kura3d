/**
 * @file src/engine/__tests__/colorSplitSolid.test.ts
 * @description Separar por colores entrega sólidos cerrados que particionan el original: cada pieza
 * es manifold con volumen > 0, la suma de volúmenes es la del original (±0,1 %) y no se solapan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

// Booleanas pesadas: el tope por defecto (5 s) no alcanza con la máquina cargada.
vi.setConfig({ testTimeout: 60_000 });
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { splitMeshByColorSolid, type SolidColorPart } from '../colorSplitSolid';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';
import { paintMeshFacesInSphere } from '../paint/brush';
import { applyTransformToMesh, computeMeshStats, createPrimitiveMesh } from '../primitives';

const WHITE = '#ffffff';
const RED = '#ff0000';
const BLUE = '#0000ff';

function obj(mesh: MeshData, position: Vec3 = [0, 0, 0]): SceneObject {
  return {
    id: 'o', name: 'o', source: 'primitive', position, rotation: [0, 0, 0], scale: [1, 1, 1],
    color: WHITE, role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
  };
}

/** Pinta los triángulos cuyo centroide y normal cumplen `pick`. */
function paintWhere(mesh: MeshData, pick: (c: Vec3, n: Vec3) => string | null): MeshData {
  const P = mesh.positions, I = mesh.indices;
  const colors: string[] = [];
  for (let t = 0; t < I.length / 3; t++) {
    const v = [0, 1, 2].map((k) => [P[I[t * 3 + k] * 3], P[I[t * 3 + k] * 3 + 1], P[I[t * 3 + k] * 3 + 2]]);
    const c: Vec3 = [0, 1, 2].map((a) => (v[0][a] + v[1][a] + v[2][a]) / 3) as Vec3;
    const e1 = v[1].map((x, a) => x - v[0][a]), e2 = v[2].map((x, a) => x - v[0][a]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    colors.push(pick(c, n.map((x) => x / l) as Vec3) ?? WHITE);
  }
  return { ...mesh, faceColors: colors };
}

/** Comprueba la partición: cerradas, volumen > 0, suma = original, sin solapes. */
async function expectPartition(source: SceneObject, parts: SolidColorPart[]) {
  const wasm = await initManifoldEngine();
  const original = computeMeshStats(applyTransformToMesh(source.mesh, source.position, source.rotation, source.scale)).volumeMm3;
  let sum = 0;
  const solids = parts.map((p) => {
    const stats = computeMeshStats(p.mesh);
    expect(stats.isManifold, `pieza ${p.color} cerrada`).toBe(true);
    expect(stats.volumeMm3).toBeGreaterThan(0);
    expect(stats.volumeMm3).toBeCloseTo(p.volumeMm3, 0);
    sum += stats.volumeMm3;
    return meshDataToManifold(wasm, applyTransformToMesh(p.mesh, p.position, [0, 0, 0], [1, 1, 1]));
  });
  expect(Math.abs(sum - original) / original).toBeLessThan(0.001);
  const union = solids.length > 1 ? wasm.Manifold.union(solids) : solids[0];
  expect(Math.abs(union.volume() - sum) / sum, 'sin solapes').toBeLessThan(0.001);
  for (const s of solids) s.delete();
}

describe('splitMeshByColorSolid', () => {
  beforeAll(async () => { await initManifoldEngine(); });

  it('caja con dos parches: tres sólidos cerrados que suman el volumen original', async () => {
    const box = await createPrimitiveMesh('box', { width: 40, height: 20, depth: 40 });
    const o = obj(paintWhere(box, (_c, n) => (n[1] > 0.9 ? RED : n[0] > 0.9 ? BLUE : null)));
    const { parts, warnings } = await splitMeshByColorSolid(o, { depthMm: 1 });
    expect(warnings).toEqual([]);
    expect(parts.map((p) => p.color)).toEqual([WHITE, BLUE, RED]);
    await expectPartition(o, parts);
    const vol = Object.fromEntries(parts.map((p) => [p.color, p.volumeMm3]));
    // Cada capa es un tronco de pirámide de 1 mm (las aristas se biselan a 45°): las dos capas
    // comparten la pared diagonal de la arista común y no se pisan.
    const frustum = (a: number, b: number, h: number) => (h * (a * b + (a - 2 * h) * (b - 2 * h) + Math.sqrt(a * b * (a - 2 * h) * (b - 2 * h)))) / 3;
    expect(vol[BLUE]).toBeCloseTo(frustum(40, 20, 1), 0);
    expect(vol[RED]).toBeCloseTo(frustum(40, 40, 1), 0);
    expect(vol[WHITE]).toBeCloseTo(32000 - frustum(40, 20, 1) - frustum(40, 40, 1), 0);
  });

  it('respeta la profundidad del color y la valida', async () => {
    const box = await createPrimitiveMesh('box', { width: 40, height: 20, depth: 40 });
    const o = obj(paintWhere(box, (_c, n) => (n[1] > 0.9 ? RED : null)));
    const { parts } = await splitMeshByColorSolid(o, { depthMm: 2.5 });
    expect(parts.find((p) => p.color === RED)!.volumeMm3).toBeCloseTo((2.5 * (1600 + 35 * 35 + 40 * 35)) / 3, 0);
    await expect(splitMeshByColorSolid(o, { depthMm: 0 })).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
  });

  it('esfera mitad y mitad', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 15, segments: 48 });
    const o = obj(paintWhere(sphere, (c) => (c[0] > 0 ? RED : null)), [5, 0, -3]);
    const { parts } = await splitMeshByColorSolid(o);
    expect(parts).toHaveLength(2);
    await expectPartition(o, parts);
  });

  it('cilindro con una franja vertical', async () => {
    const cyl = await createPrimitiveMesh('cylinder', { radius: 10, height: 60, segments: 48 });
    const o = obj(paintWhere(cyl, (c, n) => (Math.abs(n[1]) < 0.1 && Math.abs(Math.atan2(c[2], c[0])) < 0.6 ? RED : null)));
    const { parts } = await splitMeshByColorSolid(o);
    expect(parts).toHaveLength(2);
    await expectPartition(o, parts);
  });

  it('texto pintado con pincel sobre una placa', async () => {
    let o = obj(await createPrimitiveMesh('box', { width: 80, height: 5, depth: 40 }));
    // Trazos de una "T" y una "L" sobre la cara superior (Y = 5), con el borde subdividido.
    const strokes: Vec3[] = [];
    for (let x = -30; x <= -10; x += 2) strokes.push([x, 5, -10]);
    for (let z = -10; z <= 10; z += 2) strokes.push([-20, 5, z]);
    for (let z = -10; z <= 10; z += 2) strokes.push([10, 5, z]);
    for (let x = 10; x <= 25; x += 2) strokes.push([x, 5, 10]);
    for (const p of strokes) o = { ...o, mesh: paintMeshFacesInSphere(o, p, 1.5, RED, { refineEdge: true }) };
    expect(new Set(o.mesh.faceColors).size).toBe(2);
    const { parts } = await splitMeshByColorSolid(o, { depthMm: 0.8 });
    expect(parts.map((p) => p.color)).toEqual([WHITE, RED]);
    await expectPartition(o, parts);
  }, 30_000);

  it('un solo color devuelve una pieza: el objeto entero', async () => {
    const box = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    const o = obj(box, [3, 0, 4]);
    const { parts } = await splitMeshByColorSolid(o);
    expect(parts).toHaveLength(1);
    expect(parts[0].position).toEqual([3, 0, 4]);
    await expectPartition(o, parts);
  });

  it('caras opuestas de una placa más delgada que 2× profundidad', async () => {
    const plate = await createPrimitiveMesh('box', { width: 30, height: 1.2, depth: 30 });
    const o = obj(paintWhere(plate, (_c, n) => (n[1] > 0.9 ? RED : n[1] < -0.9 ? BLUE : null)));
    const { parts } = await splitMeshByColorSolid(o, { depthMm: 1 });
    expect(parts.length).toBeGreaterThanOrEqual(2);
    await expectPartition(o, parts);
  });

  it('cuerpos separados de un color cada uno se llevan el cuerpo entero', async () => {
    const a = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    const n = a.positions.length / 3;
    const pos = new Float32Array(a.positions.length * 2);
    pos.set(a.positions);
    for (let i = 0; i < a.positions.length; i += 3) {
      pos[a.positions.length + i] = a.positions[i] + 30;
      pos[a.positions.length + i + 1] = a.positions[i + 1];
      pos[a.positions.length + i + 2] = a.positions[i + 2];
    }
    const idx = new Uint32Array(a.indices.length * 2);
    idx.set(a.indices);
    for (let i = 0; i < a.indices.length; i++) idx[a.indices.length + i] = a.indices[i] + n;
    const tris = a.indices.length / 3;
    const o = obj({ positions: pos, indices: idx, faceColors: [...new Array(tris).fill(WHITE), ...new Array(tris).fill(RED)] });
    const { parts } = await splitMeshByColorSolid(o);
    expect(parts.map((p) => [p.color, Math.round(p.volumeMm3)])).toEqual([[WHITE, 1000], [RED, 1000]]);
  });
});
