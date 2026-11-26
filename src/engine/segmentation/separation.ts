/**
 * @file src/engine/segmentation/separation.ts
 * @description División completa: extrae todas las sub-estructuras detectadas como piezas independientes con etiquetas bilingües, color y posición mundial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, SceneObject, StructuralSegmentationResult, Vec3 } from '../../types/kura';
import { assertSegmentationMatchesMesh } from '../segmentationGuards';
import { extractStructuralRegion } from './extraction';

/**
 * Extrae todas las sub-estructuras detectadas en `segmentation` como objetos independientes
 * listos para añadir a la escena con sus etiquetas bilingües, colores y posiciones mundiales.
 *
 * @param obj Objeto de escena origen.
 * @param segmentation Resultado previo de `detectStructuralRegions`.
 * @returns Arreglo de piezas independientes listas para escena.
 */
export async function splitAllDetectedStructures(
  obj: SceneObject,
  segmentation: StructuralSegmentationResult
): Promise<
  Array<{
    regionId: string;
    labelEs: string;
    labelEn: string;
    color: string;
    mesh: MeshData;
    position: Vec3;
  }>
> {
  const parts: Array<{
    regionId: string;
    labelEs: string;
    labelEn: string;
    color: string;
    mesh: MeshData;
    position: Vec3;
  }> = [];

  assertSegmentationMatchesMesh(obj.mesh, segmentation);
  for (const region of segmentation.regions) {
    const { extracted } = await extractStructuralRegion(obj, region, false);
    const triCount = Math.floor(extracted.mesh.indices.length / 3);
    if (triCount === 0) continue;

    parts.push({
      regionId: region.id,
      labelEs: region.labelEs,
      labelEn: region.labelEn,
      color: region.color,
      mesh: {
        ...extracted.mesh,
        faceColors: new Array(triCount).fill(region.color),
      },
      position: extracted.position,
    });
  }

  return parts;
}
