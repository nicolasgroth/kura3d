/**
 * @file src/core/operations/paintOperations.ts
 * @description Operaciones puras de pintura por caras: muestra de pincel, relleno por región y pintar
 * todo. Un objeto bloqueado no se pinta y pintar sin cambiar ningún color no produce parches, así el
 * adaptador no agrega pasos de historial vacíos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { paintEntireMesh, paintFloodFillConnectedFaces, paintMeshFacesInSphere, type BrushOptions } from '../../engine/paint';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { CREASE_ANGLE_DEG } from '../../utils/creasedNormals';
import { change, emptyChange, meshPatch, type OperationContext, type SceneChange } from './operationTypes';

/** El relleno por región se detiene en las aristas vivas: el mismo ángulo de pliegue del visor. */
export const PAINT_REGION_ANGLE_DEG = CREASE_ANGLE_DEG;

/** Parche de la malla pintada: solo la malla si la topología no cambió; con estadísticas si se subdividió. */
function paintPatch(ctx: OperationContext, obj: SceneObject, mesh: MeshData): SceneChange | null {
  if (mesh === obj.mesh) return null;
  const patch = mesh.indices === obj.mesh.indices ? { mesh } : meshPatch(ctx, obj, mesh);
  return change({ patches: [{ id: obj.id, patch }] });
}

/** Una muestra del pincel esférico (centro en coordenadas locales). `null` si no cambia nada. */
export function paintBrushSample(
  ctx: OperationContext,
  obj: SceneObject,
  localPoint: Vec3,
  radiusMm: number,
  color: string,
  options: BrushOptions = {},
): SceneChange | null {
  if (obj.locked) return null;
  return paintPatch(ctx, obj, paintMeshFacesInSphere(obj, localPoint, radiusMm, color, options));
}

/** Relleno por región desde la cara `faceIndex`. `null` si no cambia nada. */
export function paintRegion(
  ctx: OperationContext,
  obj: SceneObject,
  faceIndex: number,
  color: string,
  angleDeg = PAINT_REGION_ANGLE_DEG,
): SceneChange | null {
  if (obj.locked) return null;
  return paintPatch(ctx, obj, paintFloodFillConnectedFaces(obj.mesh, faceIndex, color, angleDeg, obj.color));
}

/** Pinta el objeto completo: color por cara (y color base si `setBaseColor`). Sin parches si nada cambia. */
export function paintWholeObject(ctx: OperationContext, obj: SceneObject, color: string, setBaseColor: boolean): SceneChange {
  if (obj.locked) return emptyChange();
  const sameBase = obj.color.toLowerCase() === color.toLowerCase();
  const mesh = paintEntireMesh(obj.mesh, color, obj.color);
  if (mesh === obj.mesh && (!setBaseColor || sameBase)) return emptyChange();
  const patch = mesh === obj.mesh ? {} : paintPatch(ctx, obj, mesh)!.patches[0].patch;
  return change({ patches: [{ id: obj.id, patch: setBaseColor ? { ...patch, color } : patch }] });
}
