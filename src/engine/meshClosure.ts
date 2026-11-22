/**
 * @file src/engine/meshClosure.ts
 * @description Comprobación topológica síncrona y lineal de cierre de malla: una malla es un sólido
 * cerrado (2-manifold orientable sin bordes) si, soldando vértices por posición exacta, cada arista
 * dirigida aparece una sola vez y su opuesta también. Sirve a operaciones síncronas (separar por
 * color) que no pueden esperar al WASM de Manifold para avisar de piezas abiertas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../types/kura';

/** Indica si la malla es cerrada y orientada de forma consistente (cada arista con su gemela opuesta). */
export function isClosedMesh(mesh: MeshData): boolean {
  const { positions, indices } = mesh;
  if (indices.length === 0 || indices.length % 3 !== 0) return false;
  // Soldadura por posición exacta: los cortes por color reindexan pero conservan coordenadas.
  const weld = new Map<string, number>();
  const canon = new Uint32Array(positions.length / 3);
  for (let v = 0; v < canon.length; v++) {
    const key = `${positions[v * 3]},${positions[v * 3 + 1]},${positions[v * 3 + 2]}`;
    let id = weld.get(key);
    if (id === undefined) {
      id = weld.size;
      weld.set(key, id);
    }
    canon[v] = id;
  }
  const directed = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let c = 0; c < 3; c++) {
      const a = canon[indices[t + c]];
      const b = canon[indices[t + ((c + 1) % 3)]];
      if (a === b) return false;
      const key = `${a}:${b}`;
      const n = (directed.get(key) ?? 0) + 1;
      if (n > 1) return false;
      directed.set(key, n);
    }
  }
  for (const key of directed.keys()) {
    const [a, b] = key.split(':');
    if (!directed.has(`${b}:${a}`)) return false;
  }
  return true;
}
