/**
 * @file src/engine/meshOrientation.ts
 * @description Orientación de mallas triangulares: volumen con signo, consistencia del orden de
 * los triángulos entre vecinos (por posición soldada, sirve para STL sin índices compartidos) e
 * inversión del orden de todos los triángulos. Base del aviso de normales invertidas al importar
 * y del informe de imprimibilidad.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../types/kura';

/** Mínimo de malla que necesitan estas funciones. */
export interface OrientableMesh {
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
}

/** Volumen con signo en mm³ (teorema de divergencia); negativo si las normales apuntan hacia dentro. */
export function signedVolumeMm3(mesh: OrientableMesh): number {
  const p = mesh.positions;
  const idx = mesh.indices;
  let v6 = 0;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const cx = p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1];
    const cy = p[b + 2] * p[c] - p[b] * p[c + 2];
    const cz = p[b] * p[c + 1] - p[b + 1] * p[c];
    v6 += p[a] * cx + p[a + 1] * cy + p[a + 2] * cz;
  }
  return v6 / 6;
}

/**
 * `consistent`: cada arista dirigida aparece una vez y su inversa también (cerrada y orientable).
 * `inconsistent`: alguna arista dirigida se repite (triángulos vecinos con orden opuesto).
 * `open`: hay aristas de borde (sin vecino) pero ninguna repetida.
 */
export type OrientationState = 'consistent' | 'inconsistent' | 'open';

/** Revisa la consistencia de orientación soldando vértices por posición (tolerancia 1e-5 mm). */
export function orientationState(mesh: OrientableMesh): OrientationState {
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

/** Devuelve una copia con el orden de cada triángulo invertido (y sus normales por vértice negadas). */
export function flipTriangleWinding(mesh: MeshData): MeshData {
  const indices = new Uint32Array(mesh.indices.length);
  for (let t = 0; t + 2 < mesh.indices.length; t += 3) {
    indices[t] = mesh.indices[t];
    indices[t + 1] = mesh.indices[t + 2];
    indices[t + 2] = mesh.indices[t + 1];
  }
  const out: MeshData = { ...mesh, indices };
  if (mesh.normals) {
    const normals = new Float32Array(mesh.normals.length);
    for (let i = 0; i < normals.length; i++) normals[i] = -mesh.normals[i];
    out.normals = normals;
  }
  return out;
}
