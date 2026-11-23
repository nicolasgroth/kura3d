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
import { countUnpairedDirectedEdges, isMeshClosed, weldGrid } from './repair/meshTopology';

/**
 * Indica si la malla es cerrada y orientada de forma consistente (cada arista con su gemela opuesta).
 * Delega en la definición única de `repair/meshTopology` (la misma de estadísticas y división).
 */
export function isClosedMesh(mesh: MeshData): boolean {
  return isMeshClosed(mesh.positions, mesh.indices);
}

/**
 * Cuenta las aristas no pareadas tras soldar vértices a la grilla `weldMm`: aristas dirigidas sin su
 * gemela opuesta o repetidas. Una malla cerrada e imprimible devuelve 0. Lineal y sin claves string
 * (`weldGrid` + `countUnpairedDirectedEdges` de `repair/meshTopology`).
 */
export function countUnpairedEdges(mesh: MeshData, weldMm = 1e-4): number {
  const { canon } = weldGrid(mesh.positions, weldMm, true);
  const idx = mesh.indices;
  const tris = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) tris[i] = canon[idx[i]];
  return countUnpairedDirectedEdges(tris);
}
