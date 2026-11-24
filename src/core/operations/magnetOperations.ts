/**
 * @file src/core/operations/magnetOperations.ts
 * @description Operación «alojamiento de imán»: construye el negativo (cilindro o caja paramétrica) orientado según
 * la cara tocada, con metadatos `addon` (tipo, forma, medidas, holguras, anfitrión), y mide la pared que quedaría
 * alrededor del hueco en la pieza anfitriona. No toca la escena: el store agrega el negativo como un paso de deshacer
 * y la resta ocurre con «Aplicar restas», como cualquier negativo. Corre en el Worker del motor (tarea `magnetPocket`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import type { SceneObject, Vec3 } from '../../types/kura';
import { invalidMagnetFields, placePocket, type MagnetParams } from '../addons/magnetPocket';
import { measurePocketWall, type PocketWallReport } from '../addons/pocketWall';
import { parametricOrigin } from '../scene/parametric';
import { HOLE_HELPER_COLOR, primitiveMesh } from './creationOperations';
import { buildWith, type OperationContext } from './operationTypes';

export interface MagnetPocketInput {
  host: SceneObject;
  params: MagnetParams;
  /** Punto de mundo sobre la cara y normal de mundo hacia afuera. */
  point: Vec3;
  normal: Vec3;
  name: string;
}

export interface MagnetPocketResult {
  obj: SceneObject;
  wall: PocketWallReport;
}

export async function createMagnetPocket(ctx: OperationContext, input: MagnetPocketInput): Promise<MagnetPocketResult> {
  const { host, params } = input;
  if (invalidMagnetFields(params).length > 0) throw new engine.EngineError('INVALID_PARAMETER', { name: 'magnet' });
  const plan = placePocket(params, input.point, input.normal);
  if (!plan) throw new engine.EngineError('INVALID_PARAMETER', { name: 'normal' });
  const mesh = await primitiveMesh(plan.primitive.type, plan.primitive.params);
  const built = buildWith(ctx, {
    name: input.name,
    source: 'primitive',
    mesh,
    position: plan.position,
    rotation: plan.rotation,
    color: HOLE_HELPER_COLOR,
    role: 'negative',
    primitiveType: plan.primitive.type,
    primitiveParams: plan.primitive.params,
    parametric: parametricOrigin('primitive', mesh),
  });
  const obj: SceneObject = {
    ...built,
    metadata: { addon: { kind: 'magnet_pocket', params: { ...params }, hostId: host.id } },
  };
  const world = engine.applyTransformToMesh(host.mesh, host.position, host.rotation, host.scale);
  const wall = measurePocketWall(world, input.point, plan.frame, plan.dims);
  return { obj, wall };
}
