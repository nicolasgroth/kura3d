/**
 * @file mcp-server/src/headlessUserAxes.ts
 * @description Borde de ejes del modo sin interfaz: el motor headless guarda la escena en ejes internos
 * (Y arriba) y su contrato público usa los del usuario (X derecha, Y fondo, Z arriba), igual que el
 * Command Bus de la app. Las conversiones son las de `src/core/scene/userAxesContract` (las mismas que
 * usa el bus); aquí solo se aplican a las formas de respuesta del servidor MCP.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { localizeEngineWarning, type EngineWarning } from '../../src/engine/engineErrors';
import {
  assemblyResponseToUser,
  objectSummaryToUser,
  splitJointToUser,
  splitPlanToUser,
  structureRegionToUser,
} from '../../src/core/scene/userAxesContract';
import { userWarning } from '../../src/core/scene/userEngineMessages';
import { summarizeObject, type HeadlessSceneObject, type SceneObjectSummary } from './headlessSupport.js';
import type { StructuralSegmentationResult } from './types.js';

export {
  alignModeFromUser,
  axisFromUser,
  keepModeFromUser,
  moldSplitAxisFromUser,
  planeFromUser,
  projectionAxisFromUser,
  rotationFromUser,
  scaleFromUser,
  structureRegionToUser,
  vecFromUser,
} from '../../src/core/scene/userAxesContract';
export { internalAxisOfUser } from '../../src/core/scene/displayAxes';
export { assemblyResponseToUser, splitPlanToUser };

/** Resumen serializable de un objeto con transformación y medidas en ejes del usuario. */
export function userSummary(obj: HeadlessSceneObject): SceneObjectSummary {
  return objectSummaryToUser(summarizeObject(obj));
}

/** Segmentación estructural con medidas y centros de cada región en ejes del usuario. */
export function userSegmentation(seg: StructuralSegmentationResult): StructuralSegmentationResult {
  return { ...seg, regions: seg.regions.map(structureRegionToUser) };
}

/** Radio de la pincelada de `paint_object` con `localPoint` (el valor inicial del pincel de la app). */
export const PAINT_BRUSH_RADIUS_MM = 5;

/** Aviso del motor con su mensaje en inglés. */
export type UserWarning = EngineWarning & { message: string };

/** Avisos del motor con ejes del usuario y su mensaje en inglés (el código y los parámetros se conservan). */
export function userWarnings(warnings: readonly EngineWarning[]): UserWarning[] {
  return warnings.map((w) => {
    const u = userWarning(w);
    return { ...u, message: localizeEngineWarning('en', u) };
  });
}

/** Uniones de la división en la forma compacta del bus (eje y caras del usuario). */
export const userSplitJoints = (joints: Parameters<typeof splitJointToUser>[0][]) => joints.map(splitJointToUser);
