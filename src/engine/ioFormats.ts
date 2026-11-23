/**
 * @file src/engine/ioFormats.ts
 * @description Fachada de importación y exportación para impresión 3D. Los lectores y escritores
 * viven en `src/engine/io/` (uno por formato); aquí se reexportan y se mantienen las funciones
 * históricas (`importSTLBuffer`, `importOBJText`, `import3MFBuffer`) que entregan mallas centradas
 * y apoyadas en la cama, o en coordenadas del archivo con `preservePlacement`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../types/kura';
import { computeVertexNormals } from './manifoldKernel';
import { centerMeshOnBed } from './io/meshBuffers';
import type { ImportedPart } from './io/importTypes';
import { readOBJ } from './io/obj';
import { readSTL } from './io/stl';
import { read3MF } from './io/threeMfImport';

export { exportMeshToBinarySTL, exportSceneToBinarySTL, readSTL, stlBrandHeader } from './io/stl';
export { exportMeshToOBJ, exportSceneToOBJ, objMaterialLibraries, parseMtlColors, readOBJ, readOBJBuffer } from './io/obj';
export { exportSceneToPLY, readPLY } from './io/ply';
export { exportSceneTo3MF } from './io/threeMfExport';
export { read3MF } from './io/threeMfImport';
export { exportSceneToGLB, buildGltfScene, GLTF_METERS_PER_MM } from './io/glb';
export { detectModelFormat, MODEL_IMPORT_ACCEPT, MODEL_IMPORT_EXTENSIONS, parseModelFile } from './io/modelImport';
export { parseModelFileAsync } from './io/modelImportClient';
export { createModelImportSession, type ModelImportSession } from './io/modelImportSession';
export { sourceBytes, type ModelSourceData, type MtlSource } from './io/modelImportTask';
export { clustersOf, findImportClusters, type ImportCluster } from './io/importClusters';
export { placeImportedModels, PLACEMENT_GAP_MM, type FootprintXZ, type ImportPlacementMode, type PlacedPart } from './io/importPlacement';
export {
  DEFAULT_IMPORT_LIMITS,
  ModelImportError,
  type ModelImportErrorCode,
  type ModelImportLimits,
} from './io/importErrors';
export type { ImportedModel, ImportedPart, ModelImportFormat, ModelParseOptions } from './io/importTypes';

/** Opciones de las funciones históricas de importación. */
export interface MeshImportOptions {
  /** Conserva coordenadas de escena en mm (posición y altura del archivo) en vez de centrar. */
  preservePlacement?: boolean;
}

function placeMesh(mesh: MeshData, options?: MeshImportOptions): MeshData {
  return options?.preservePlacement ? mesh : centerMeshOnBed(mesh).mesh;
}

/** Une piezas en una sola malla (para la API histórica de OBJ). */
function mergeParts(parts: ImportedPart[]): MeshData {
  if (parts.length === 1) return parts[0].mesh;
  const vertexTotal = parts.reduce((acc, p) => acc + p.mesh.positions.length, 0);
  const indexTotal = parts.reduce((acc, p) => acc + p.mesh.indices.length, 0);
  const positions = new Float32Array(vertexTotal);
  const indices = new Uint32Array(indexTotal);
  const anyColors = parts.some((p) => p.mesh.faceColors || p.color);
  const faceColors: string[] = [];
  let pOff = 0;
  let iOff = 0;
  for (const part of parts) {
    positions.set(part.mesh.positions, pOff);
    const base = pOff / 3;
    for (let i = 0; i < part.mesh.indices.length; i++) indices[iOff + i] = part.mesh.indices[i] + base;
    if (anyColors) {
      const tris = part.mesh.indices.length / 3;
      for (let t = 0; t < tris; t++) faceColors.push(part.mesh.faceColors?.[t] ?? part.color ?? '#38bdf8');
    }
    pOff += part.mesh.positions.length;
    iOff += part.mesh.indices.length;
  }
  const distinct = new Set(faceColors).size > 1;
  return { positions, indices, normals: computeVertexNormals(positions, indices), ...(distinct ? { faceColors } : {}) };
}

/**
 * Importa un STL (binario o ASCII), convierte Z-up a Y-up, suelda vértices y, por defecto,
 * centra la malla sobre la cama.
 */
export function importSTLBuffer(buffer: ArrayBuffer, options?: MeshImportOptions): MeshData {
  return placeMesh(readSTL(buffer).parts[0].mesh, options);
}

/**
 * Parsea texto Wavefront OBJ (todas sus piezas unidas) y, por defecto, centra la malla sobre la cama.
 */
export function importOBJText(text: string, options?: MeshImportOptions & { mtlText?: string }): MeshData {
  return placeMesh(mergeParts(readOBJ(text, 'model.obj', { mtlText: options?.mtlText }).parts), options);
}

/**
 * Importa un `.3mf` resolviendo componentes, instancias y transformaciones de build. Devuelve una
 * entrada por malla instanciada; por defecto cada una centrada sobre la cama.
 */
export function import3MFBuffer(
  buffer: ArrayBuffer,
  options?: MeshImportOptions,
): Array<{ name: string; color: string; mesh: MeshData; isHole?: boolean }> {
  return read3MF(buffer).parts.map((part) => ({
    name: part.name,
    color: part.color ?? '#38bdf8',
    mesh: placeMesh(part.mesh, options),
    ...(part.isHole ? { isHole: true } : {}),
  }));
}
