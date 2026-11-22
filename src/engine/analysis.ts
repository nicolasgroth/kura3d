/**
 * @file src/engine/analysis.ts
 * @description Simplificación topológica, refinamiento/suavizado adaptativo y envolvente convexa (Convex Hull)
 * sobre el núcleo Manifold-3D en Kura3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type { MeshData, SceneObject, Vec3 } from '../types/kura';
import {
  createColorRegistry,
  initManifoldEngine,
  manifoldToMeshData,
  meshDataToManifold,
} from './manifoldKernel';
import { EngineError, requireOperationRange } from './engineErrors';
import { OPERATION_RANGES } from './operationLimits';
import { refineMeshDetailed } from './refine';
import { applyTransformToMesh, normalizeMeshToBed } from './primitives';

/**
 * Extrae el centro-base mundial `[cx, minY, cz]` de una malla y normaliza sus
 * coordenadas locales a Y=0 centrado en XZ.
 */
function extractPositionAndNormalize(mesh: MeshData): {
  mesh: MeshData;
  position: Vec3;
} {
  const vertCount = Math.floor(mesh.positions.length / 3);
  if (vertCount === 0) {
    return { mesh, position: [0, 0, 0] };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }

  return {
    mesh: normalizeMeshToBed(mesh),
    position: [(minX + maxX) * 0.5, minY, (minZ + maxZ) * 0.5],
  };
}

/** El informe de imprimibilidad vive en `printability.ts`; se reexporta por compatibilidad. */
export { analyzePrintability } from './printability';

/**
 * Reduce la densidad poligonal de un objeto mediante decimación topológica nativa
 * `manifold.simplify(toleranceMm)`, garantizando una malla cerrada watertight y
 * preservando `faceColors` cuando existen.
 *
 * @param obj Objeto de escena a simplificar (opera sobre su malla local).
 * @param toleranceMm Tolerancia máxima de desviación en mm de mundo (se aplica dividida por la escala).
 * @returns Malla simplificada watertight normalizada a cama.
 */
export async function simplifyMesh(
  obj: SceneObject,
  toleranceMm: number
): Promise<MeshData> {
  const tol = requireOperationRange('toleranceMm', toleranceMm, OPERATION_RANGES.simplify.toleranceMm);
  const wasm = await initManifoldEngine();
  const registry = obj.mesh.faceColors?.length
    ? createColorRegistry(wasm, [
        { color: obj.color, faceColors: obj.mesh.faceColors },
      ])
    : null;

  let manifold: Manifold | null = null;
  let simplified: Manifold | null = null;

  try {
    manifold = meshDataToManifold(
      wasm,
      obj.mesh,
      registry?.colorToId,
      obj.color
    );
    // La tolerancia es en mm de mundo: en la malla local se divide por la mayor escala del objeto,
    // así la desviación final nunca supera `tol` en ningún eje.
    const maxScale = Math.max(...obj.scale.map((s) => Math.abs(s))) || 1;
    simplified = manifold.simplify(tol / maxScale);
    // Una tolerancia mayor que la pieza la colapsa: error tipado, el objeto queda intacto.
    if (simplified.isEmpty() || simplified.numTri() === 0 || simplified.volume() <= 0) {
      throw new EngineError('MESH_EMPTY', { operation: 'simplify_mesh' });
    }
    const outMesh = manifoldToMeshData(simplified, registry?.idToColor);
    return normalizeMeshToBed(outMesh);
  } finally {
    manifold?.delete();
    simplified?.delete();
  }
}

/**
 * Refina y opcionalmente suaviza una malla sin deformar sus dimensiones exteriores
 * (API compatible: solo la malla). La longitud se interpreta en mm de mundo; ver
 * `refineMeshDetailed` para la longitud efectiva y los avisos tipados.
 *
 * @param obj Objeto de escena origen (opera sobre su malla local).
 * @param targetEdgeLengthMm Longitud objetivo de arista en milímetros de mundo.
 * @param smooth Si es true, suaviza conservando aristas vivas y caras planas (por defecto false).
 * @returns Malla refinada watertight normalizada a cama.
 */
export async function refineMesh(
  obj: SceneObject,
  targetEdgeLengthMm: number,
  smooth = false
): Promise<MeshData> {
  return (await refineMeshDetailed(obj, targetEdgeLengthMm, smooth)).mesh;
}

/**
 * Calcula la envolvente convexa (Convex Hull) 3D cerrada de uno o más objetos de escena
 * en sus posiciones y orientaciones mundiales actuales, devolviendo la malla centrada
 * en XZ sobre Y=0 junto con su posición mundial `[cx, minY, cz]`.
 *
 * @param objects Lista no vacía de objetos de escena a envolver.
 * @returns Malla hull watertight y su posición mundial.
 */
export async function computeConvexHull(
  objects: SceneObject[]
): Promise<{ mesh: MeshData; position: Vec3 }> {
  if (objects.length === 0) {
    throw new EngineError('HULL_NO_INPUT');
  }

  const wasm = await initManifoldEngine();
  const manifolds: Manifold[] = [];
  let hullManifold: Manifold | null = null;

  try {
    for (const obj of objects) {
      const worldMesh = applyTransformToMesh(
        obj.mesh,
        obj.position,
        obj.rotation,
        obj.scale
      );
      manifolds.push(meshDataToManifold(wasm, worldMesh, undefined, obj.color));
    }

    hullManifold = wasm.Manifold.hull(manifolds);
    if (hullManifold.isEmpty() || hullManifold.numTri() === 0) {
      throw new EngineError('MESH_EMPTY', { operation: 'convex_hull' });
    }

    const outMesh = manifoldToMeshData(hullManifold);
    return extractPositionAndNormalize(outMesh);
  } finally {
    for (const m of manifolds) {
      m.delete();
    }
    hullManifold?.delete();
  }
}
