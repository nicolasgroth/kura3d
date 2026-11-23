/**
 * @file src/core/operations/meshOperations.ts
 * @description Operaciones puras que reemplazan la malla de un objeto existente: ahuecar,
 * simplificar, refinar, reflejar, texturizar, borrar con esfera, proyectar en
 * superficie y colorear estructuras. Devuelven un parche por ID dentro de un `SceneChange`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import type {
  HollowOptions,
  SceneObject,
  StructuralSegmentationResult,
  SurfaceProjectionOptions,
  TextureOptions,
  Vec3,
} from '../../types/kura';
import { engineWarning } from '../../engine/engineErrors';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { worldBaked } from '../scene/sceneObjects';
import { change, meshPatch, type OperationContext, type SceneChange } from './operationTypes';

const patchOf = (obj: SceneObject, patch: Partial<SceneObject>, warnings: readonly engine.EngineWarning[] = []): SceneChange =>
  change({ patches: [{ id: obj.id, patch }], warnings: [...warnings] });

/** Ahueca el sólido (cavidad interior real y drenaje opcional). */
export async function hollowObject(ctx: OperationContext, obj: SceneObject, options: HollowOptions): Promise<SceneChange> {
  const detailed = options.enabled && options.wallThickness !== 0
    ? await engine.hollowMeshDetailed(obj, options)
    : { mesh: await engine.hollowMesh(obj, options), warnings: [] };
  return patchOf(obj, { ...meshPatch(ctx, obj, detailed.mesh), hollow: { ...options } }, detailed.warnings);
}

/**
 * Repara la malla (soldar, quitar degeneradas y duplicadas, orientar, cerrar agujeros, quitar astillas)
 * y verifica que Manifold la acepte. Si no había nada que reparar, el cambio no trae parches.
 */
export async function repairObject(
  ctx: OperationContext,
  obj: SceneObject,
  options: Omit<engine.MeshRepairOptions, 'onProgress'> = {},
): Promise<{ report: engine.MeshRepairReport; change: SceneChange }> {
  const res = await engine.repairMeshVerified(obj.mesh, { ...options, onProgress: ctx.onProgress });
  if (!res.report.changed) return { report: res.report, change: change({ warnings: res.warnings }) };
  return { report: res.report, change: patchOf(obj, meshPatch(ctx, obj, res.mesh), res.warnings) };
}

/** Decima la malla (Manifold `simplify`). */
export async function simplifyObject(ctx: OperationContext, obj: SceneObject, toleranceMm: number): Promise<SceneChange> {
  const simplified = await engine.simplifyMesh(obj, toleranceMm);
  // Volumen en coordenadas locales: la escala del objeto no cambia el porcentaje.
  const statsBefore = engine.computeMeshStats(obj.mesh);
  const statsAfter = engine.computeMeshStats(simplified);
  const before = statsBefore.volumeMm3;
  const after = statsAfter.volumeMm3;
  const pct = before > 0 ? (100 * (after - before)) / before : 0;
  const warnings = Math.abs(pct) > OPERATION_DEFAULTS.simplify.volumeWarnPct
    ? [engineWarning('SIMPLIFY_VOLUME_CHANGED', { pct: Math.round(pct * 10) / 10 })]
    : [];
  return {
    ...patchOf(obj, meshPatch(ctx, obj, simplified), warnings),
    simplify: {
      trianglesBefore: statsBefore.triangles,
      trianglesAfter: statsAfter.triangles,
      volumeBeforeMm3: before,
      volumeAfterMm3: after,
      volumeChangePct: pct,
    },
  };
}

/** Refina (y suaviza opcionalmente) la malla. */
export async function refineObject(
  ctx: OperationContext,
  obj: SceneObject,
  targetEdgeLengthMm: number,
  smooth: boolean,
): Promise<SceneChange> {
  const refined = await engine.refineMeshDetailed(obj, targetEdgeLengthMm, smooth);
  return patchOf(obj, meshPatch(ctx, obj, refined.mesh), refined.warnings);
}

/** Refleja la malla en un eje (winding corregido). */
export function mirrorObject(ctx: OperationContext, obj: SceneObject, axis: 'x' | 'y' | 'z'): SceneChange {
  return patchOf(obj, meshPatch(ctx, obj, engine.mirrorMeshAxis(obj.mesh, axis)));
}

/** Desplaza la superficie con una textura procedural. */
export function textureObject(ctx: OperationContext, obj: SceneObject, options: TextureOptions): SceneChange {
  return patchOf(obj, { ...meshPatch(ctx, obj, engine.applyProceduralTexture(obj.mesh, options)), texture: { ...options } });
}

/** Borra material dentro de una esfera mundial; la malla resultante ya está en espacio mundial. */
export async function eraseSphere(ctx: OperationContext, obj: SceneObject, worldCenter: Vec3, radiusMm: number): Promise<SceneChange> {
  const res = await engine.eraseRegionWithSphere(obj, worldCenter, radiusMm);
  return patchOf(obj, meshPatch(ctx, obj, res.mesh, { ...worldBaked(), position: res.position }));
}

/** Proyecta texto o SVG sobre la superficie (malla en espacio mundial, transformación horneada). */
export async function projectOnSurface(
  ctx: OperationContext,
  obj: SceneObject,
  options: SurfaceProjectionOptions,
): Promise<SceneChange> {
  const res = await engine.projectGraphicOntoSurface(obj, options);
  return patchOf(obj, { ...meshPatch(ctx, obj, res.mesh, { ...worldBaked(), position: res.position }), source: 'projected' });
}

/** Colorea por cara cada sub-estructura detectada. */
export function colorizeStructures(
  ctx: OperationContext,
  obj: SceneObject,
  segmentation: StructuralSegmentationResult,
): SceneChange {
  return patchOf(obj, meshPatch(ctx, obj, engine.applyStructureColorsToMesh(obj.mesh, segmentation)));
}
