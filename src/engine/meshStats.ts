/**
 * @file src/engine/meshStats.ts
 * @description Estadísticas de una malla (triángulos, vértices, caja, volumen y cierre 2-manifold), sin
 * dependencias pesadas: la usan el motor y el Worker de importación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, SceneObject } from '../types/kura';
import { isMeshClosed } from './repair/meshTopology';

/**
 * Calcula estadísticas geométricas exactas de una malla:
 * conteo de triángulos/vértices, dimensiones AABB en mm, volumen con signo en mm³
 * y verificación topológica de cierre 2-manifold mediante emparejamiento de semi-aristas.
 *
 * @param mesh Malla a analizar.
 * @returns Estadísticas compatibles con `SceneObject['stats']`.
 */
export function computeMeshStats(mesh: MeshData): SceneObject['stats'] {
  const vertCount = Math.floor(mesh.positions.length / 3);
  const triCount = Math.floor(mesh.indices.length / 3);

  if (vertCount === 0 || triCount === 0) {
    return {
      triangles: 0,
      vertices: 0,
      isManifold: false,
      volumeMm3: 0,
      dimensionsMm: [0, 0, 0],
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  // Volumen por teorema de divergencia: sum( v0 · (v1 x v2) ) / 6
  let signedVolume6 = 0;

  for (let i = 0; i < vertCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3];
    const i1 = mesh.indices[t * 3 + 1];
    const i2 = mesh.indices[t * 3 + 2];

    const x0 = mesh.positions[i0 * 3];
    const y0 = mesh.positions[i0 * 3 + 1];
    const z0 = mesh.positions[i0 * 3 + 2];

    const x1 = mesh.positions[i1 * 3];
    const y1 = mesh.positions[i1 * 3 + 1];
    const z1 = mesh.positions[i1 * 3 + 2];

    const x2 = mesh.positions[i2 * 3];
    const y2 = mesh.positions[i2 * 3 + 1];
    const z2 = mesh.positions[i2 * 3 + 2];

    const cx = y1 * z2 - z1 * y2;
    const cy = z1 * x2 - x1 * z2;
    const cz = x1 * y2 - y1 * x2;
    signedVolume6 += x0 * cx + y0 * cy + z0 * cz;
  }

  // Definición única de malla cerrada (la misma de avisos, división y exportación).
  const topologyValid = isMeshClosed(mesh.positions, mesh.indices);

  return {
    triangles: triCount,
    vertices: vertCount,
    isManifold: topologyValid,
    volumeMm3: Math.abs(signedVolume6 / 6),
    dimensionsMm: [
      Math.max(0, maxX - minX),
      Math.max(0, maxY - minY),
      Math.max(0, maxZ - minZ),
    ],
  };
}
