/**
 * @file src/engine/colorSplitFinish.ts
 * @description Cierre y verificación de las piezas de "separar por colores". `directPiecesValid` acepta
 * las piezas del camino directo (`colorSplitThicken.ts`) solo si Manifold las toma sin error y cada capa
 * de color queda dentro del sólido original (su cara interior no atraviesa la pared). `closeColorPart`
 * da el veredicto con la definición única de malla cerrada del inspector (`isMeshClosed`) y, si la malla
 * no cierra, la pasa por el cierre de "dividir" y "Reparar malla" (`closeSplitMesh`) antes de entregarla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '../types/kura';
import { isMeshClosed } from './repair/meshTopology';
import { closeSplitMesh } from './split/splitMeshClean';
import { WasmScope } from './wasmScope';

/** Fracción de volumen de una capa que puede quedar fuera del original por redondeo. */
const CONTAINMENT_TOLERANCE = 1e-4;

/** Manifold de `mesh` tal cual (sin soldar); null si Manifold la rechaza. */
export function manifoldOfMesh(wasm: ManifoldToplevel, mesh: MeshData): Manifold | null {
  const m = new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: new Float32Array(mesh.positions), triVerts: new Uint32Array(mesh.indices) }));
  if (m.status() !== 'NoError' || m.isEmpty()) { m.delete(); return null; }
  return m;
}

/**
 * Las piezas directas de un cuerpo son válidas: cerradas por índice, aceptadas por Manifold, con
 * volumen positivo, y cada capa no base contenida en `solid` (el cuerpo original).
 */
export function directPiecesValid(wasm: ManifoldToplevel, solid: Manifold, pieces: Map<string, MeshData>, baseColor: string, minVolume: number): boolean {
  const scope = new WasmScope();
  try {
    let total = 0;
    for (const [color, mesh] of pieces) {
      if (!isMeshClosed(mesh.positions, mesh.indices, 0)) return false;
      const m = manifoldOfMesh(wasm, mesh);
      if (!m) return false;
      scope.track(m);
      const vol = m.volume();
      if (!(vol >= minVolume)) return false;
      total += vol;
      if (color === baseColor) continue;
      const inside = scope.track(solid.intersect(m)).volume();
      if (inside < vol * (1 - CONTAINMENT_TOLERANCE)) return false;
    }
    const orig = solid.volume();
    return Math.abs(total - orig) <= orig * CONTAINMENT_TOLERANCE;
  } finally {
    scope.dispose();
  }
}

/** Junta mallas cerradas disjuntas (cuerpos conexos distintos) en una sola, sin soldar. */
export function concatMeshes(meshes: MeshData[]): MeshData {
  if (meshes.length === 1) return meshes[0];
  const nPos = meshes.reduce((s, m) => s + m.positions.length, 0);
  const nIdx = meshes.reduce((s, m) => s + m.indices.length, 0);
  const positions = new Float32Array(nPos);
  const indices = new Uint32Array(nIdx);
  let p = 0, i = 0;
  for (const m of meshes) {
    positions.set(m.positions, p);
    for (let k = 0; k < m.indices.length; k++) indices[i + k] = m.indices[k] + p / 3;
    p += m.positions.length;
    i += m.indices.length;
  }
  return { positions, indices };
}

/** Pieza con su veredicto de cierre (definición del inspector) y si hizo falta repararla. */
export interface ClosedColorPart {
  mesh: MeshData;
  closed: boolean;
  repaired: boolean;
}

/** Veredicto final de una pieza: cerrada tal cual, cerrada tras reparar, o abierta (se avisa). */
export function closeColorPart(wasm: ManifoldToplevel, mesh: MeshData): ClosedColorPart {
  if (isMeshClosed(mesh.positions, mesh.indices)) return { mesh, closed: true, repaired: false };
  const fixed = closeSplitMesh(wasm, mesh);
  return { mesh: fixed.mesh, closed: fixed.closed && isMeshClosed(fixed.mesh.positions, fixed.mesh.indices), repaired: !!fixed.repaired };
}
