/**
 * @file src/engine/meshOrientation.ts
 * @description Orientación de mallas triangulares: volumen con signo, consistencia del orden de
 * los triángulos entre vecinos (por posición soldada, sirve para STL sin índices compartidos) e
 * inversión del orden de todos los triángulos. Base del aviso de normales invertidas al importar
 * y del informe de imprimibilidad.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData } from '../types/kura';
import { quantizedHash, tableCapacity } from './positionHash';

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

/** Suelda por posición cuantizada (1e-5 mm): id de cada vértice y cantidad de posiciones distintas. */
function weldByPosition(p: ArrayLike<number>, vertCount: number): { weld: Uint32Array; count: number } {
  const inv = 1e5;
  const weld = new Uint32Array(vertCount);
  // Vértice representante de cada id: se compara su posición cuantizada (sin claves string).
  const rep = new Uint32Array(vertCount);
  const capacity = tableCapacity(vertCount);
  const mask = capacity - 1;
  const table = new Int32Array(capacity);
  let count = 0;
  for (let i = 0; i < vertCount; i++) {
    const qx = Math.round(p[i * 3] * inv);
    const qy = Math.round(p[i * 3 + 1] * inv);
    const qz = Math.round(p[i * 3 + 2] * inv);
    let slot = quantizedHash(qx, qy, qz) & mask;
    let id = -1;
    while (table[slot] !== 0) {
      const candidate = table[slot] - 1;
      const r = rep[candidate] * 3;
      if (Math.round(p[r] * inv) === qx && Math.round(p[r + 1] * inv) === qy && Math.round(p[r + 2] * inv) === qz) {
        id = candidate;
        break;
      }
      slot = (slot + 1) & mask;
    }
    if (id < 0) {
      id = count++;
      table[slot] = id + 1;
      rep[id] = i;
    }
    weld[i] = id;
  }
  return { weld, count };
}

/** true si `target` está en `sorted[from..to)` (búsqueda binaria). */
function contains(sorted: Uint32Array, from: number, to: number, target: number): boolean {
  let lo = from;
  let hi = to - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const value = sorted[mid];
    if (value === target) return true;
    if (value < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/**
 * Revisa la consistencia de orientación soldando vértices por posición (tolerancia 1e-5 mm). Aristas
 * dirigidas agrupadas por su origen (CSR, O(n)) en arreglos tipados: sin claves string ni `Map`.
 * Una arista repetida en cualquier parte da `inconsistent` aunque también haya bordes abiertos.
 */
export function orientationState(mesh: OrientableMesh): OrientationState {
  const p = mesh.positions;
  const idx = mesh.indices;
  const vertCount = Math.floor(p.length / 3);
  const { weld, count: n } = weldByPosition(p, vertCount);
  const triCount = Math.floor(idx.length / 3);

  const offsets = new Uint32Array(n + 1);
  for (let t = 0; t < triCount * 3; t += 3) {
    for (let e = 0; e < 3; e++) {
      const u = weld[idx[t + e]];
      if (u !== weld[idx[t + ((e + 1) % 3)]]) offsets[u + 1]++;
    }
  }
  for (let v = 0; v < n; v++) offsets[v + 1] += offsets[v];
  const fill = offsets.slice(0, n);
  const targets = new Uint32Array(offsets[n]);
  for (let t = 0; t < triCount * 3; t += 3) {
    for (let e = 0; e < 3; e++) {
      const u = weld[idx[t + e]];
      const v = weld[idx[t + ((e + 1) % 3)]];
      if (u !== v) targets[fill[u]++] = v;
    }
  }

  // Arista dirigida repetida = mismo destino dos veces en el grupo de su origen.
  for (let u = 0; u < n; u++) {
    const from = offsets[u];
    const to = offsets[u + 1];
    if (to - from > 1) targets.subarray(from, to).sort();
    for (let i = from + 1; i < to; i++) if (targets[i] === targets[i - 1]) return 'inconsistent';
  }
  // Borde abierto = arista u→v sin su inversa v→u.
  for (let u = 0; u < n; u++) {
    for (let i = offsets[u]; i < offsets[u + 1]; i++) {
      const v = targets[i];
      if (!contains(targets, offsets[v], offsets[v + 1], u)) return 'open';
    }
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
