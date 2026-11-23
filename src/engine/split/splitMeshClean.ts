/**
 * @file src/engine/split/splitMeshClean.ts
 * @description Malla cerrada de cada pieza de "dividir para imprimir". Los booleanos del solape de
 * borde contra paredes curvas o inclinadas (codo toroidal, reducción cónica) dejan aristas de largo
 * casi nulo y triángulos degenerados que, al soldar la malla (como hace un lector de STL), quedan
 * como aristas no pareadas. Se reutiliza la limpieza de la proyección (`collapseShortEdges`): colapso
 * por distancia y, si no basta, reconstrucción con Manifold y nuevo colapso. El veredicto final usa la
 * definición única de malla cerrada (`isMeshClosed`, la misma de las estadísticas); si aún no cierra,
 * la pieza pasa por "Reparar malla" antes de entregarse (`repaired: true`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '../../types/kura';
import { manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { collapseShortEdges } from '../projectionCleanup';
import { repairMeshData } from '../repair/meshRepair';
import { isMeshClosed } from '../repair/meshTopology';

export interface ClosedSplitMesh {
  mesh: MeshData;
  closed: boolean;
  /** La pieza solo cerró tras "Reparar malla" (se avisa `SPLIT_PART_REPAIRED`). */
  repaired?: boolean;
}

const closedBoth = (m: MeshData) => countUnpairedEdges(m) === 0 && isMeshClosed(m.positions, m.indices);

/** Manifold acepta la malla tal cual (sin la soldadura de respaldo). */
function accepted(wasm: ManifoldToplevel, mesh: MeshData): boolean {
  const m = new wasm.Mesh({ numProp: 3, vertProperties: new Float32Array(mesh.positions), triVerts: new Uint32Array(mesh.indices) });
  m.merge();
  try {
    const solid = new wasm.Manifold(m);
    const ok = solid.status() === 'NoError';
    solid.delete();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Devuelve `mesh` cerrada si se puede (`closed: true`); si no, la malla original con `closed: false`
 * para que el llamador avise. No modifica `mesh`.
 */
export function closeSplitMesh(wasm: ManifoldToplevel, mesh: MeshData): ClosedSplitMesh {
  if (closedBoth(mesh)) return { mesh, closed: true };
  const collapsed = collapseShortEdges(mesh);
  if (closedBoth(collapsed)) return { mesh: collapsed, closed: true };
  try {
    const solid = meshDataToManifold(wasm, collapsed);
    try {
      const rebuilt = collapseShortEdges(manifoldToMeshData(solid));
      if (closedBoth(rebuilt)) return { mesh: rebuilt, closed: true };
    } finally {
      solid.delete();
    }
  } catch {
    // Sin reconstrucción posible: se sigue con la definición única y la reparación.
  }
  // Las micro-aristas que solo se abren al soldar a 1e-4 no impiden imprimir: vale la definición única.
  if (isMeshClosed(mesh.positions, mesh.indices) && accepted(wasm, mesh)) return { mesh, closed: true };
  const fixed = repairMeshData(mesh);
  if (fixed.report.after.closed && accepted(wasm, fixed.mesh)) return { mesh: fixed.mesh, closed: true, repaired: true };
  return { mesh, closed: false };
}
