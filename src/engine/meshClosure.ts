/**
 * @file src/engine/meshClosure.ts
 * @description Comprobación topológica síncrona y lineal de cierre de malla: una malla es un sólido
 * cerrado (2-manifold orientable sin bordes) según la definición única (`isMeshClosed`). Sirve a operaciones síncronas (separar por
 * color) que no pueden esperar al WASM de Manifold para avisar de piezas abiertas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../types/kura';
import { isMeshClosed } from './repair/meshTopology';

/**
 * Indica si la malla es cerrada y orientada de forma consistente (cada arista con su gemela opuesta).
 * Delega en la definición única de `repair/meshTopology` (la misma de estadísticas y división).
 */
export function isClosedMesh(mesh: MeshData): boolean {
  return isMeshClosed(mesh.positions, mesh.indices);
}

/**
 * Cuenta las aristas no pareadas tras soldar vértices a la grilla `weldMm`: aristas dirigidas sin su
 * gemela opuesta o repetidas. Una malla cerrada e imprimible devuelve 0.
 */
export function countUnpairedEdges(mesh: MeshData, weldMm = 1e-4): number {
  const { positions, indices } = mesh;
  const weld = new Map<string, number>();
  const canon = new Uint32Array(positions.length / 3);
  const q = (x: number) => Math.round(x / weldMm);
  for (let v = 0; v < canon.length; v++) {
    const key = `${q(positions[v * 3])},${q(positions[v * 3 + 1])},${q(positions[v * 3 + 2])}`;
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
      if (a === b) continue; // triángulo degenerado tras soldar: no aporta arista
      const key = `${a}:${b}`;
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  let unpaired = 0;
  for (const [key, n] of directed) {
    const [a, b] = key.split(':');
    if (n !== 1 || (directed.get(`${b}:${a}`) ?? 0) !== 1) unpaired++;
  }
  return unpaired;
}
