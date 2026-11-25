/**
 * @file src/engine/mirror.ts
 * @description Simetría especular (mirror) de una malla respecto a un eje cartesiano, con devanado invertido y re-normalización a cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../types/kura';
import { computeVertexNormals } from './manifoldKernel';
import { normalizeMeshToBed } from './primitives';

/**
 * Refleja (espeja) una malla respecto a uno de los ejes cartesianos ('x', 'y' o 'z'),
 * invierte el orden de devanado `(i0, i2, i1)` de cada triángulo para preservar normales
 * salientes y condición 2-manifold watertight, conserva `faceColors` y re-normaliza a cama (Y >= 0).
 *
 * @param mesh Malla de entrada en formato Kurra3D Studio.
 * @param axis Eje de simetría especular ('x', 'y' o 'z').
 * @returns Nueva malla reflejada, cerrada y apoyada sobre la cama.
 */
export function mirrorMeshAxis(mesh: MeshData, axis: 'x' | 'y' | 'z'): MeshData {
  const vertCount = Math.floor(mesh.positions.length / 3);
  const triCount = Math.floor(mesh.indices.length / 3);

  if (vertCount === 0 || triCount === 0) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      ...(mesh.normals ? { normals: new Float32Array(0) } : {}),
      ...(mesh.faceColors ? { faceColors: [] } : {}),
    };
  }

  const positions = new Float32Array(mesh.positions);
  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  for (let v = 0; v < vertCount; v++) {
    positions[v * 3 + axisIdx] = -positions[v * 3 + axisIdx];
  }

  // Invertir devanado (i0, i1, i2) -> (i0, i2, i1) tras la reflexión para mantener volumen positivo y cierre 2-manifold
  const indices = new Uint32Array(mesh.indices);
  for (let t = 0; t < triCount; t++) {
    const tmp = indices[t * 3 + 1];
    indices[t * 3 + 1] = indices[t * 3 + 2];
    indices[t * 3 + 2] = tmp;
  }

  const normals = computeVertexNormals(positions, indices);
  const mirrored: MeshData = {
    positions,
    indices,
    normals,
    ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
  };

  return normalizeMeshToBed(mirrored);
}
