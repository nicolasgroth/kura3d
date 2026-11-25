/**
 * @file src/core/operations/screwBossOperations.ts
 * @description Operación «torreta para tornillo»: construye sus dos piezas orientadas según la cara tocada, con
 * metadatos `addon` (`screw_boss`, parte, medidas, ancla y anfitrión): el poste, un sólido que se une a la pieza al
 * aplicar las restas (ver `addonPostMerge`), y el agujero, un negativo coaxial con chaflán de entrada que se resta
 * del poste y de la pieza. Devuelve también su análisis (`screwBossAnalysis`). No toca la escena: el store agrega
 * ambas piezas en un paso de deshacer. Corre en el Worker del motor (tarea `screwBoss`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { bossHoleMesh, bossPostMesh, invalidScrewBossFields, SCREW_BOSS_RANGES, type ScrewBossParams } from '../addons/screwBoss';
import { analyzeScrewBoss, type ScrewBossReport } from '../addons/screwBossAnalysis';
import { HOLE_HELPER_COLOR } from './creationOperations';
import type { PlacedMesh } from './magnetOperations';
import { buildWith, type OperationContext } from './operationTypes';

export interface ScrewBossInput {
  host: PlacedMesh & { id: string; color: string };
  params: ScrewBossParams;
  /** Punto de mundo sobre la cara y normal de mundo hacia afuera. */
  point: Vec3;
  normal: Vec3;
  /** Nombres del poste y del agujero. */
  names: { post: string; hole: string };
  /** Torretas e imanes pendientes cerca de la pieza (para avisar si chocan). */
  nearbyAddons?: PlacedMesh[];
}

export interface ScrewBossResult {
  post: SceneObject;
  hole: SceneObject;
  report: ScrewBossReport;
  /** El pie del poste es más ancho que la zona de apoyo: no se coloca. */
  spansFace: boolean;
}

const toWorld = (o: PlacedMesh): MeshData =>
  engine.applyTransformToMesh({ positions: o.mesh.positions, indices: o.mesh.indices }, o.position, o.rotation, o.scale);

export async function createScrewBoss(ctx: OperationContext, input: ScrewBossInput): Promise<ScrewBossResult> {
  const { host, params } = input;
  const [badField] = invalidScrewBossFields(params);
  if (badField) {
    const { min, max } = SCREW_BOSS_RANGES[badField];
    throw new engine.EngineError('INVALID_PARAMETER', { name: badField, value: String(params[badField]), min, max });
  }
  const world = toWorld(host);
  const others = (input.nearbyAddons ?? []).map(toWorld);
  const analysis = analyzeScrewBoss(world, params, input.point, input.normal, others);
  if (!analysis) throw new engine.EngineError('INVALID_PARAMETER', { name: 'normal' });
  const { plan } = analysis;
  const meta = (part: 'post' | 'hole', anchorMm: number) => ({
    addon: { kind: 'screw_boss' as const, part, params: { ...params }, anchorMm, hostId: host.id },
  });
  const post: SceneObject = {
    ...buildWith(ctx, {
      name: input.names.post,
      source: 'imported',
      mesh: bossPostMesh(params, plan.seatMm),
      position: plan.post.position,
      rotation: plan.rotation,
      color: host.color,
      role: 'solid',
    }),
    metadata: meta('post', plan.post.anchorMm),
  };
  const hole: SceneObject = {
    ...buildWith(ctx, {
      name: input.names.hole,
      source: 'imported',
      mesh: bossHoleMesh(params),
      position: plan.hole.position,
      rotation: plan.rotation,
      color: HOLE_HELPER_COLOR,
      role: 'negative',
    }),
    metadata: meta('hole', plan.hole.anchorMm),
  };
  return { post, hole, report: analysis.report, spansFace: analysis.spansFace };
}
