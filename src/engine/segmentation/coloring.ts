/**
 * @file src/engine/segmentation/coloring.ts
 * @description Coloreado de una malla según las regiones estructurales detectadas (faceColors listos para inspección y exportación 3MF multicolor).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, StructuralSegmentationResult } from '../../types/kura';
import { assertSegmentationMatchesMesh } from '../segmentationGuards';
import { STRUCTURAL_COLOR_PALETTE } from './constants';

/**
 * Pinta cada triángulo de `mesh.faceColors` con el color hexadecimal de la región estructural
 * detectada a la que pertenece, dejando la malla lista para inspección visual y exportación 3MF multicolor.
 *
 * @param mesh Malla origen en formato Kurra3D Studio.
 * @param segmentation Resultado devuelto por `detectStructuralRegions`.
 * @returns Nueva instancia `MeshData` con `faceColors` poblado para todos sus triángulos.
 */
export function applyStructureColorsToMesh(
  mesh: MeshData,
  segmentation: StructuralSegmentationResult
): MeshData {
  assertSegmentationMatchesMesh(mesh, segmentation);
  const triCount = Math.floor(mesh.indices.length / 3);
  const fallbackColor = segmentation.regions[0]?.color ?? STRUCTURAL_COLOR_PALETTE[0];
  const faceColors = new Array<string>(triCount).fill(fallbackColor);

  for (const region of segmentation.regions) {
    for (const triIdx of region.faceIndices) {
      if (triIdx >= 0 && triIdx < triCount) {
        faceColors[triIdx] = region.color;
      }
    }
  }

  return {
    positions: new Float32Array(mesh.positions),
    indices: new Uint32Array(mesh.indices),
    ...(mesh.normals ? { normals: new Float32Array(mesh.normals) } : {}),
    faceColors,
  };
}
