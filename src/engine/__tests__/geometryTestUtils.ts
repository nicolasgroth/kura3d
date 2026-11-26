/**
 * @file src/engine/__tests__/geometryTestUtils.ts
 * @description Utilidades compartidas de las pruebas geométricas del motor: construcción de
 * objetos de escena, conteo de triángulos degenerados, volumen e interferencia booleana.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';
import { buildMeshDistanceField } from '../meshDistance';
import { applyTransformToMesh, computeMeshStats } from '../primitives';

/** Construye un `SceneObject` mínimo válido para pruebas. */
export function makeObject(id: string, mesh: MeshData, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    name: id,
    source: 'primitive',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#38bdf8',
    materialPreset: 'pla_matte',
    role: 'solid',
    visible: true,
    locked: false,
    mesh,
    stats: computeMeshStats(mesh),
    ...overrides,
  } as SceneObject;
}

/** Cuenta triángulos con área casi nula (degenerados) en una malla. */
export function countDegenerateTriangles(mesh: MeshData, minArea = 1e-7): number {
  let count = 0;
  const p = mesh.positions;
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    const a = mesh.indices[t * 3] * 3, b = mesh.indices[t * 3 + 1] * 3, c = mesh.indices[t * 3 + 2] * 3;
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
    const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
    const area = 0.5 * Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x);
    if (area < minArea) count++;
  }
  return count;
}

/** Volumen (mm³) de la intersección de dos mallas colocadas con sus transformaciones. */
export async function intersectionVolume(
  a: MeshData,
  b: MeshData,
  bTransform: { position?: Vec3; rotation?: Vec3 } = {}
): Promise<number> {
  const wasm = await initManifoldEngine();
  const bWorld = applyTransformToMesh(b, bTransform.position ?? [0, 0, 0], bTransform.rotation ?? [0, 0, 0], [1, 1, 1]);
  const ma = meshDataToManifold(wasm, a);
  const mb = meshDataToManifold(wasm, bWorld);
  const inter = ma.intersect(mb);
  try {
    return inter.volume();
  } finally {
    ma.delete();
    mb.delete();
    inter.delete();
  }
}

/**
 * Separa la superficie de una malla hueca en componentes conexos por vértices compartidos
 * (tras soldar) y mide la distancia mínima/máxima de las superficies interiores a la exterior
 * (componentes con volumen con signo positivo). Independiente del código que generó la cavidad.
 */
export function measureShellWall(mesh: MeshData): {
  surfaces: number;
  cavities: number;
  minWall: number;
  maxWall: number;
} {
  const n = mesh.positions.length / 3;
  const key = (i: number) =>
    `${Math.round(mesh.positions[i * 3] * 1e4)},${Math.round(mesh.positions[i * 3 + 1] * 1e4)},${Math.round(mesh.positions[i * 3 + 2] * 1e4)}`;
  const weld = new Map<string, number>();
  const id = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = key(i);
    let v = weld.get(k);
    if (v === undefined) {
      v = weld.size;
      weld.set(k, v);
    }
    id[i] = v;
  }
  const parent = Array.from({ length: weld.size }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const tris = mesh.indices.length / 3;
  for (let t = 0; t < tris; t++) {
    const a = find(id[mesh.indices[t * 3]]);
    const b = find(id[mesh.indices[t * 3 + 1]]);
    const c = find(id[mesh.indices[t * 3 + 2]]);
    parent[b] = a;
    parent[find(c)] = a;
  }
  const groups = new Map<number, number[]>();
  for (let t = 0; t < tris; t++) {
    const r = find(id[mesh.indices[t * 3]]);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(t);
  }
  // Volumen con signo por componente: positivo = superficie exterior, negativo = cavidad
  const comps = [...groups.values()].map((list) => {
    const idx = new Uint32Array(list.length * 3);
    let vol6 = 0;
    list.forEach((t, k) => {
      const v = [0, 1, 2].map((c) => mesh.indices[t * 3 + c]);
      v.forEach((vi, c) => (idx[k * 3 + c] = vi));
      const P = (i: number, a: number) => mesh.positions[v[i] * 3 + a];
      vol6 +=
        P(0, 0) * (P(1, 1) * P(2, 2) - P(1, 2) * P(2, 1)) +
        P(0, 1) * (P(1, 2) * P(2, 0) - P(1, 0) * P(2, 2)) +
        P(0, 2) * (P(1, 0) * P(2, 1) - P(1, 1) * P(2, 0));
    });
    return { idx, outer: vol6 > 0 };
  });
  const outerIdx = comps.filter((c) => c.outer).flatMap((c) => Array.from(c.idx));
  const outerField = buildMeshDistanceField({ positions: mesh.positions, indices: outerIdx });
  let minWall = Infinity;
  let maxWall = 0;
  for (const comp of comps.filter((c) => !c.outer)) {
    for (const v of comp.idx) {
      const d = outerField.unsignedDistance(mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]);
      minWall = Math.min(minWall, d);
      maxWall = Math.max(maxWall, d);
    }
  }
  return { surfaces: comps.length, cavities: comps.filter((c) => !c.outer).length, minWall, maxWall };
}

/** Cantidad de cuerpos (componentes conexos) de una malla. */
export async function shellCount(mesh: MeshData): Promise<number> {
  const wasm = await initManifoldEngine();
  const m = meshDataToManifold(wasm, mesh);
  const parts = m.decompose();
  const n = parts.length;
  for (const p of parts) p.delete();
  m.delete();
  return n;
}
