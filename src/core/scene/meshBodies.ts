/**
 * @file src/core/scene/meshBodies.ts
 * @description Cuenta los cuerpos sueltos (componentes conexos por vértices compartidos) de una malla
 * indexada, con unión-búsqueda en arreglos tipados. Sirve para avisar al importar que un archivo trae
 * varios cuerpos separados en una sola pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';

/** Tope de triángulos para contar en el hilo principal sin trabar la interfaz (más: no se cuenta). */
export const MAX_BODY_COUNT_TRIANGLES = 3_000_000;

/**
 * Número de cuerpos sueltos de la malla (≥ 1 si tiene triángulos), o null si es demasiado grande para
 * contarlo aquí. Dos triángulos pertenecen al mismo cuerpo si comparten algún vértice.
 */
export function countMeshBodies(mesh: Pick<MeshData, 'positions' | 'indices'>): number | null {
  const tris = Math.floor(mesh.indices.length / 3);
  if (tris === 0) return 0;
  if (tris > MAX_BODY_COUNT_TRIANGLES) return null;
  const vertexCount = Math.floor(mesh.positions.length / 3);
  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;
  const find = (a: number): number => {
    let root = a;
    while (parent[root] !== root) root = parent[root];
    while (parent[a] !== root) {
      const next = parent[a];
      parent[a] = root;
      a = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const idx = mesh.indices;
  const used = new Uint8Array(vertexCount);
  for (let t = 0; t < tris * 3; t += 3) {
    const a = idx[t];
    const b = idx[t + 1];
    const c = idx[t + 2];
    used[a] = 1;
    used[b] = 1;
    used[c] = 1;
    union(a, b);
    union(b, c);
  }
  let bodies = 0;
  for (let i = 0; i < vertexCount; i++) if (used[i] && find(i) === i) bodies++;
  return bodies;
}

const bodyCountCache = new WeakMap<object, number | null>();

/** `countMeshBodies` recordado por malla (las mallas son inmutables: cada edición crea otra). */
export function cachedMeshBodies(mesh: Pick<MeshData, 'positions' | 'indices'>): number | null {
  if (bodyCountCache.has(mesh)) return bodyCountCache.get(mesh) ?? null;
  const count = countMeshBodies(mesh);
  bodyCountCache.set(mesh, count);
  return count;
}
