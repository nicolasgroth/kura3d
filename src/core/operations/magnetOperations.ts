/**
 * @file src/core/operations/magnetOperations.ts
 * @description Operación «alojamiento de imán»: construye el negativo (cilindro o caja paramétrica) orientado según
 * la cara tocada, con metadatos `addon` (tipo, forma, medidas, holguras, anfitrión). En caras curvas mide la
 * superficie de la boca (sobresalida para abrir limpio, profundidad útil); mide la pared alrededor del hueco y la
 * separación con los negativos pendientes cercanos. No toca la escena: el store agrega el negativo como un paso de
 * deshacer y la resta ocurre con «Aplicar restas». Corre en el Worker del motor (tarea `magnetPocket`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { invalidMagnetFields, placePocket, type MagnetParams } from '../addons/magnetPocket';
import { measurePocketNeighbors, type NeighborProbe } from '../addons/pocketNeighbors';
import { measureMouthSurface } from '../addons/pocketSurface';
import { measurePocketWall, type PocketWallReport } from '../addons/pocketWall';
import { parametricOrigin } from '../scene/parametric';
import { HOLE_HELPER_COLOR, primitiveMesh } from './creationOperations';
import { buildWith, type OperationContext } from './operationTypes';

/** Solo lo que el Worker necesita de una pieza: su malla (posiciones e índices) y su transformación. */
export interface PlacedMesh {
  mesh: Pick<MeshData, 'positions' | 'indices'>;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface MagnetPocketInput {
  host: PlacedMesh & { id: string };
  params: MagnetParams;
  /** Punto de mundo sobre la cara y normal de mundo hacia afuera. */
  point: Vec3;
  normal: Vec3;
  name: string;
  /** Negativos pendientes que pueden tocar a la pieza (para avisar si quedan pegados o superpuestos). */
  pendingNegatives?: PlacedMesh[];
}

export interface MagnetPocketResult {
  obj: SceneObject;
  wall: PocketWallReport;
}

const toWorld = (o: PlacedMesh): MeshData =>
  engine.applyTransformToMesh({ positions: o.mesh.positions, indices: o.mesh.indices }, o.position, o.rotation, o.scale);

export async function createMagnetPocket(ctx: OperationContext, input: MagnetPocketInput): Promise<MagnetPocketResult> {
  const { host, params } = input;
  if (invalidMagnetFields(params).length > 0) throw new engine.EngineError('INVALID_PARAMETER', { name: 'magnet' });
  const flat = placePocket(params, input.point, input.normal);
  if (!flat) throw new engine.EngineError('INVALID_PARAMETER', { name: 'normal' });
  const world = toWorld(host);
  // Caras curvas: la sobresalida cubre lo que sube la superficie en el borde de la boca.
  const surface = measureMouthSurface(world, input.point, flat.frame, params);
  const plan = placePocket(params, input.point, input.normal, surface.overshootMm)!;
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
  const probe: NeighborProbe = { rays: [] };
  const wall = measurePocketWall(world, input.point, plan.frame, plan.dims, {
    rimHeights: surface.rimHeights,
    onRay: (origin, dir, hostWall) => probe.rays.push({ origin, dir, hostWall }),
  });
  const others = (input.pendingNegatives ?? []).map(toWorld);
  const neighbor = others.length > 0 ? measurePocketNeighbors(world, input.point, plan.frame, plan.dims, others, probe) : null;
  return { obj, wall: { ...wall, protrudeMm: surface.protrudeMm, neighbor } };
}
