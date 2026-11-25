/**
 * @file src/core/operations/keyholeOperations.ts
 * @description Operación «ojo de cerradura para colgar en el muro»: une con Manifold las tres partes del negativo
 * (entrada, ranura del cuello y cámara) en una sola malla cerrada, la orienta según la cara tocada (ranura hacia el
 * «arriba» de la pieza) y la devuelve como pieza negativa con metadatos `addon` (`keyhole`, medidas, ancla 0 y
 * anfitrión), junto a su análisis (`keyholeAnalysis`) y si el labio retiene la cabeza (`keyholeRetention`). No toca la escena: el store la agrega en un paso de deshacer.
 * Corre en el Worker del motor (tarea `keyhole`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { invalidKeyholeFields, KEYHOLE_RANGES, keyholePartMeshes, type KeyholeParams } from '../addons/keyhole';
import { analyzeKeyhole, type KeyholeReport } from '../addons/keyholeAnalysis';
import { HOLE_HELPER_COLOR } from './creationOperations';
import { keyholeRetention } from './keyholeRetention';
import type { PlacedMesh } from './magnetOperations';
import { buildWith, type OperationContext } from './operationTypes';

export interface KeyholeInput {
  host: PlacedMesh & { id: string };
  params: KeyholeParams;
  /** Punto de mundo sobre la cara y normal de mundo hacia afuera. */
  point: Vec3;
  normal: Vec3;
  name: string;
}

export interface KeyholeResult {
  object: SceneObject;
  report: KeyholeReport;
  /** La figura es más ancha que la cara: no se coloca. */
  spansFace: boolean;
  /** El labio que queda no retiene la cabeza (cara demasiado chica): no se coloca. */
  notRetained: boolean;
}

/** Une mallas convexas cerradas en una sola con Manifold. */
export async function unionMeshes(meshes: readonly MeshData[]): Promise<MeshData> {
  const wasm = await engine.initManifoldEngine();
  const parts = meshes.map((m) => engine.meshDataToManifold(wasm, m));
  const merged = wasm.Manifold.union(parts);
  try {
    return engine.manifoldToMeshData(merged);
  } finally {
    for (const p of parts) p.delete();
    merged.delete();
  }
}

export async function createKeyhole(ctx: OperationContext, input: KeyholeInput): Promise<KeyholeResult> {
  const { host, params } = input;
  const [badField] = invalidKeyholeFields(params);
  if (badField) {
    const { min, max } = KEYHOLE_RANGES[badField];
    throw new engine.EngineError('INVALID_PARAMETER', { name: badField, value: String(params[badField]), min, max });
  }
  const world = engine.applyTransformToMesh({ positions: host.mesh.positions, indices: host.mesh.indices }, host.position, host.rotation, host.scale);
  const analysis = analyzeKeyhole(world, params, input.point, input.normal);
  if (!analysis) throw new engine.EngineError('INVALID_PARAMETER', { name: 'normal' });
  const { entry, neck, chamber } = keyholePartMeshes(params);
  const mesh = await unionMeshes([entry, neck, chamber]);
  // ¿Retiene? Con el material real: si no queda labio sobre la cabeza en el extremo de la ranura, la cabeza sale.
  const retention = await keyholeRetention(world, mesh, params, analysis.plan);
  const report: KeyholeReport = { ...analysis.report, retentionMm3: retention.retentionMm3, retentionIdealMm3: retention.idealMm3 };
  const object: SceneObject = {
    ...buildWith(ctx, {
      name: input.name,
      source: 'imported',
      mesh,
      position: analysis.plan.position,
      rotation: analysis.plan.rotation,
      color: HOLE_HELPER_COLOR,
      role: 'negative',
    }),
    metadata: { addon: { kind: 'keyhole', params: { ...params }, anchorMm: 0, hostId: host.id } },
  };
  return { object, report, spansFace: analysis.spansFace, notRetained: !retention.retained };
}
