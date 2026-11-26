/**
 * @file src/core/operations/cablePassOperations.ts
 * @description Operación «paso de cable»: mide con rayos el espesor de la pared en el punto tocado, construye el
 * negativo pasante con chaflán en las bocas (o ciego, con la profundidad a mano, si la pared es demasiado gruesa) y
 * lo devuelve como pieza negativa con metadatos `addon` (`cable_pass`, medidas, largo medido, ancla 0 y anfitrión),
 * junto a su análisis (`cablePassAnalysis`). No toca la escena. Corre en el Worker del motor (tarea `cablePass`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as engine from '../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { CABLE_PASS_RANGES, cablePassMesh, invalidCablePassFields, type CablePassParams } from '../addons/cablePass';
import { analyzeCablePass, type CablePassReport } from '../addons/cablePassAnalysis';
import { HOLE_HELPER_COLOR } from './creationOperations';
import type { PlacedMesh } from './magnetOperations';
import { buildWith, type OperationContext } from './operationTypes';

export interface CablePassInput {
  host: PlacedMesh & { id: string };
  params: CablePassParams;
  /** Punto de mundo sobre la cara y normal de mundo hacia afuera. */
  point: Vec3;
  normal: Vec3;
  name: string;
  /** Agregados pendientes cerca de la pieza (para avisar si quedan a menos de 1,2 mm). */
  nearbyAddons?: PlacedMesh[];
}

export interface CablePassResult {
  object: SceneObject;
  report: CablePassReport;
  spansFace: boolean;
}

const toWorld = (o: PlacedMesh): MeshData =>
  engine.applyTransformToMesh({ positions: o.mesh.positions, indices: o.mesh.indices }, o.position, o.rotation, o.scale);

export async function createCablePass(ctx: OperationContext, input: CablePassInput): Promise<CablePassResult> {
  const { host, params } = input;
  const [badField] = invalidCablePassFields(params);
  if (badField) {
    const { min, max } = CABLE_PASS_RANGES[badField];
    throw new engine.EngineError('INVALID_PARAMETER', { name: badField, value: String(params[badField]), min, max });
  }
  const analysis = analyzeCablePass(toWorld(host), params, input.point, input.normal, (input.nearbyAddons ?? []).map(toWorld));
  if (!analysis) throw new engine.EngineError('INVALID_PARAMETER', { name: 'normal' });
  const { report, frame } = analysis;
  const object: SceneObject = {
    ...buildWith(ctx, {
      name: input.name,
      source: 'imported',
      mesh: cablePassMesh(params, report.boreMm, report.through),
      position: [...input.point] as Vec3,
      rotation: frame.rotation,
      color: HOLE_HELPER_COLOR,
      role: 'negative',
    }),
    metadata: { addon: { kind: 'cable_pass', params: { ...params }, anchorMm: 0, boreMm: report.boreMm, hostId: host.id } },
  };
  return { object, report, spansFace: analysis.spansFace };
}
