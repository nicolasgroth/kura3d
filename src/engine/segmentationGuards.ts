/**
 * @file src/engine/segmentationGuards.ts
 * @description Validaciones de una segmentación estructural contra la malla sobre la que se
 * aplica: huella de la malla (`SEGMENTATION_STALE`) e índices de cara dentro de rango
 * (`SEGMENTATION_REGION_INVALID`). Evitan aplicar índices viejos sobre una geometría nueva.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { DetectedStructureRegion, MeshData, StructuralSegmentationResult } from '../types/kura';
import { EngineError } from './engineErrors';
import { computeMeshFingerprint } from './meshFingerprint';

/** true si la segmentación se calculó sobre esta misma malla (huella y nº de triángulos). */
export function segmentationMatchesMesh(mesh: MeshData, segmentation: StructuralSegmentationResult): boolean {
  if (segmentation.totalTriangles !== Math.floor(mesh.indices.length / 3)) return false;
  return !segmentation.meshFingerprint || segmentation.meshFingerprint === computeMeshFingerprint(mesh);
}

/** Lanza `SEGMENTATION_STALE` si la segmentación no corresponde a la malla. */
export function assertSegmentationMatchesMesh(mesh: MeshData, segmentation: StructuralSegmentationResult): void {
  if (!segmentationMatchesMesh(mesh, segmentation)) throw new EngineError('SEGMENTATION_STALE');
}

/** Lanza `SEGMENTATION_REGION_INVALID` si la región está vacía o tiene índices fuera de la malla. */
export function assertRegionFitsMesh(region: DetectedStructureRegion, totalTris: number): void {
  const valid =
    totalTris > 0 &&
    region.faceIndices.length > 0 &&
    region.faceIndices.every((t) => Number.isInteger(t) && t >= 0 && t < totalTris);
  if (!valid) throw new EngineError('SEGMENTATION_REGION_INVALID');
}
