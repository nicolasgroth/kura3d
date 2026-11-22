/**
 * @file src/engine/split/splitMeshClean.ts
 * @description Malla cerrada de cada pieza de "dividir para imprimir". Los booleanos del solape de
 * borde contra paredes curvas o inclinadas (codo toroidal, reducción cónica) dejan aristas de largo
 * casi nulo y triángulos degenerados que, al soldar la malla (como hace un lector de STL), quedan
 * como aristas no pareadas. Se reutiliza la limpieza de la proyección (`collapseShortEdges`): colapso
 * por distancia y, si no basta, reconstrucción con Manifold y nuevo colapso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '../../types/kura';
import { manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { collapseShortEdges } from '../projectionCleanup';

/**
 * Devuelve `mesh` sin aristas no pareadas si se puede (`closed: true`); si no, la malla original con
 * `closed: false` para que el llamador avise. No modifica `mesh`.
 */
export function closeSplitMesh(wasm: ManifoldToplevel, mesh: MeshData): { mesh: MeshData; closed: boolean } {
  if (countUnpairedEdges(mesh) === 0) return { mesh, closed: true };
  const collapsed = collapseShortEdges(mesh);
  if (countUnpairedEdges(collapsed) === 0) return { mesh: collapsed, closed: true };
  try {
    const solid = meshDataToManifold(wasm, collapsed);
    try {
      const rebuilt = collapseShortEdges(manifoldToMeshData(solid));
      if (countUnpairedEdges(rebuilt) === 0) return { mesh: rebuilt, closed: true };
    } finally {
      solid.delete();
    }
  } catch {
    // Sin reconstrucción posible: se devuelve la original
  }
  return { mesh, closed: false };
}
