/**
 * @file src/core/operations/organizeOperations.ts
 * @description Operación pura "Combinar en un objeto": concatena las mallas de varios objetos con sus
 * transformaciones aplicadas en un solo objeto con varios cuerpos, sin booleanas ni cambios de
 * geometría (el volumen es la suma). Conserva colores por cara y el color de cada fuente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { isReference } from '../scene/objectRole';
import { buildWith, change, type OperationContext, type SceneChange } from './operationTypes';

/** Concatena mallas en mundo; `faceColors` solo si hay colores por cara o colores distintos. */
export function concatWorldMeshes(objs: readonly SceneObject[]): MeshData {
  const worlds = objs.map((o) => engine.applyTransformToMesh(o.mesh, o.position, o.rotation, o.scale));
  const vertexTotal = worlds.reduce((n, m) => n + m.positions.length, 0);
  const indexTotal = worlds.reduce((n, m) => n + m.indices.length, 0);
  const positions = new Float32Array(vertexTotal);
  const indices = new Uint32Array(indexTotal);
  const needColors = objs.some((o) => o.mesh.faceColors?.length) || new Set(objs.map((o) => o.color.toLowerCase())).size > 1;
  const faceColors: string[] = [];
  let pOff = 0;
  let iOff = 0;
  worlds.forEach((m, k) => {
    positions.set(m.positions, pOff);
    const base = pOff / 3;
    for (let i = 0; i < m.indices.length; i++) indices[iOff + i] = m.indices[i] + base;
    if (needColors) {
      const faces = m.indices.length / 3;
      for (let f = 0; f < faces; f++) faceColors.push(m.faceColors?.[f] ?? objs[k].color);
    }
    pOff += m.positions.length;
    iOff += m.indices.length;
  });
  const mesh: MeshData = { positions, indices };
  if (needColors) mesh.faceColors = faceColors;
  return mesh;
}

/** Centro-base `[cx, minY, cz]` de una malla en mundo. */
function basePosition(mesh: MeshData): Vec3 {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i], y = mesh.positions[i + 1], z = mesh.positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }
  return Number.isFinite(minX) ? [(minX + maxX) / 2, minY, (minZ + maxZ) / 2] : [0, 0, 0];
}

/**
 * Combina los objetos en uno con varios cuerpos. Toma color y material del primero; la malla queda en
 * espacio local (centro X/Z en 0, base en Y = 0) y la posición la devuelve al mismo lugar del mundo.
 */
export function combineObjects(
  ctx: OperationContext,
  objs: readonly SceneObject[],
  name: string,
): { result: SceneObject; change: SceneChange } {
  if (objs.length < 2) throw new engine.EngineError('MESH_EMPTY', { operation: name });
  // Combinar no mezcla tipos ni consume referencias (el adaptador ya avisa; esto es la red de seguridad).
  if (objs.some(isReference) || new Set(objs.map((o) => o.role)).size > 1) {
    throw new engine.EngineError('REFERENCE_NOT_ALLOWED', { operation: name });
  }
  const world = concatWorldMeshes(objs);
  const position = basePosition(world);
  const mesh = engine.normalizeMeshToBed(world);
  const first = objs[0];
  const result = buildWith(ctx, {
    name,
    source: 'combined',
    mesh,
    position,
    color: first.color,
    materialPreset: first.materialPreset,
    role: first.role,
  });
  const placed: SceneObject = first.groupRef ? { ...result, groupRef: first.groupRef } : result;
  return { result: placed, change: change({ added: [placed], removedIds: objs.map((o) => o.id) }) };
}
