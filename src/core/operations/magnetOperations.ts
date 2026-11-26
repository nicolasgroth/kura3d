/**
 * @file src/core/operations/magnetOperations.ts
 * @description Operación «alojamiento de imán»: construye el negativo (cilindro o caja paramétrica) orientado según
 * la cara tocada, con metadatos `addon` (tipo, forma, medidas, holguras, anfitrión), y su análisis
 * (`pocketAnalysis`: superficie de la boca, tapa, borde, pared, vecinos y cuánto de la pieza ocupa). No toca la escena: el store agrega el negativo como un paso de
 * deshacer y la resta ocurre con «Aplicar restas». Corre en el Worker del motor (tarea `magnetPocket`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as engine from '../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { invalidMagnetFields, MAGNET_RANGES, type MagnetParams } from '../addons/magnetPocket';
import { analyzePocket } from '../addons/pocketAnalysis';
import type { PocketWallReport } from '../addons/pocketWall';
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
  /** Volumen del hueco dentro de la pieza / volumen de la pieza (aprox.): sobre `MAX_POCKET_FILL` no se coloca. */
  fill: number;
  /** La boca del hueco es más ancha que la pieza en esa cara (sale por lados opuestos): no se coloca. */
  spansFace: boolean;
}

const toWorld = (o: PlacedMesh): MeshData =>
  engine.applyTransformToMesh({ positions: o.mesh.positions, indices: o.mesh.indices }, o.position, o.rotation, o.scale);

export async function createMagnetPocket(ctx: OperationContext, input: MagnetPocketInput): Promise<MagnetPocketResult> {
  const { host, params } = input;
  const [badField] = invalidMagnetFields(params);
  if (badField) {
    const { min, max } = MAGNET_RANGES[badField];
    throw new engine.EngineError('INVALID_PARAMETER', { name: badField, value: String(params[badField]), min, max });
  }
  const world = toWorld(host);
  const others = (input.pendingNegatives ?? []).map(toWorld);
  const analysis = analyzePocket(world, params, input.point, input.normal, others);
  if (!analysis) throw new engine.EngineError('INVALID_PARAMETER', { name: 'normal' });
  const { plan } = analysis;
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
  return { obj, wall: analysis.wall, fill: analysis.fill, spansFace: analysis.spansFace };
}
