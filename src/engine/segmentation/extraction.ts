/**
 * @file src/engine/segmentation/extraction.ts
 * @description Extracción de una sub-estructura detectada como objeto sólido independiente, con cierre de bucles abiertos y remanente opcional.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { DetectedStructureRegion, MeshData, SceneObject, Vec3 } from '../../types/kura';
import { applyTransformToMesh, computeMeshStats } from '../primitives';
import { assertRegionFitsMesh } from '../segmentationGuards';
import { buildClosedSubMesh, sanitizeWithManifoldIfValid } from './closure';
import { extractPositionAndNormalize } from './geometryUtils';

/**
 * Extrae una sub-estructura detectada como un objeto 3D sólido independiente.
 * - Si proviene de una cáscara desconectada, la extrae de forma exacta.
 * - Si proviene de una malla única fusionada, cierra cada bucle de frontera abierta
 *   mediante tapas en abanico al centroide con orientación saliente consistente.
 * - Si `removeFromSource` es true, calcula además la malla remanente cerrada (con respaldo seguro).
 *
 * @param obj Objeto de escena origen.
 * @param region Sub-estructura detectada a extraer.
 * @param removeFromSource Si es true, devuelve también la geometría remanente sin la región extraída.
 * @returns Malla extraída normalizada a cama con su posición mundial y remanente opcional.
 */
export async function extractStructuralRegion(
  obj: SceneObject,
  region: DetectedStructureRegion,
  removeFromSource = false
): Promise<{
  extracted: { mesh: MeshData; position: Vec3 };
  remainder?: { mesh: MeshData; position: Vec3 } | null;
}> {
  const totalTris = Math.floor(obj.mesh.indices.length / 3);
  assertRegionFitsMesh(region, totalTris);

  const localExtracted = buildClosedSubMesh(
    obj.mesh,
    region.faceIndices,
    region.color,
    false,
    region.color
  );
  const sanitizedExtracted = region.isDisconnectedShell
    ? await sanitizeWithManifoldIfValid(localExtracted)
    : localExtracted;

  const worldExtracted = applyTransformToMesh(
    sanitizedExtracted,
    obj.position,
    obj.rotation,
    obj.scale
  );
  const extracted = extractPositionAndNormalize(worldExtracted);

  let remainder: { mesh: MeshData; position: Vec3 } | null | undefined;
  if (removeFromSource) {
    const selectedSet = new Set(region.faceIndices);
    const remainingTris: number[] = [];
    for (let t = 0; t < totalTris; t++) {
      if (!selectedSet.has(t)) {
        remainingTris.push(t);
      }
    }

    if (remainingTris.length === 0) {
      remainder = null;
    } else {
      const localRemainder = buildClosedSubMesh(
        obj.mesh,
        remainingTris,
        obj.color,
        Boolean(obj.mesh.faceColors?.length),
        obj.color
      );
      const stats = computeMeshStats(localRemainder);
      if (stats.triangles > 0 && stats.volumeMm3 > 1e-6) {
        const sanitizedRemainder = await sanitizeWithManifoldIfValid(localRemainder);
        const worldRemainder = applyTransformToMesh(
          sanitizedRemainder,
          obj.position,
          obj.rotation,
          obj.scale
        );
        remainder = extractPositionAndNormalize(worldRemainder);
      } else {
        remainder = null;
      }
    }
  }

  return removeFromSource ? { extracted, remainder } : { extracted };
}
