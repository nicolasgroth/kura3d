/**
 * @file src/core/operations/meshOperations.ts
 * @description Operaciones puras que reemplazan la malla de un objeto existente: ahuecar,
 * simplificar, refinar, reflejar, texturizar, pintar entero, borrar con esfera, proyectar en
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

/** Decima la malla (Manifold `simplify`). */
export async function simplifyObject(ctx: OperationContext, obj: SceneObject, toleranceMm: number): Promise<SceneChange> {
  return patchOf(obj, meshPatch(ctx, obj, await engine.simplifyMesh(obj, toleranceMm)));
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

/** Pinta el objeto completo: color por cara (y color base si `setBaseColor`). */
export function paintWholeObject(ctx: OperationContext, obj: SceneObject, color: string, setBaseColor: boolean): SceneChange {
  const patch = meshPatch(ctx, obj, engine.paintEntireMesh(obj.mesh, color));
  return patchOf(obj, setBaseColor ? { ...patch, color } : patch);
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
