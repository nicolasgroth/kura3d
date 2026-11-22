/**
 * @file src/core/operations/engineTasks.ts
 * @description Registro de tareas pesadas del motor que pueden correr en el Worker o en proceso
 * con el mismo código: cada tarea recibe el `OperationContext` y argumentos serializables y llama
 * a una operación pura de `src/core/operations` (o a un exportador del motor).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import type {
  DetectedStructureRegion,
  HollowOptions,
  MaterialPresetId,
  MoldOptions,
  PlaneCutOptions,
  PrinterProfile,
  SceneObject,
  StructuralSegmentationResult,
  SurfaceProjectionOptions,
  ThreadOptions,
  Vec3,
} from '../../types/kura';
import { applyHoles, booleanOperation, convexHull } from './csgOperations';
import { createThread } from './creationOperations';
import { eraseSphere, hollowObject, projectOnSurface, refineObject, simplifyObject } from './meshOperations';
import type { OperationContext } from './operationTypes';
import { extractStructure, generateMold, planeCut, splitDisconnected, splitStructures } from './partOperations';

export type ExportFormat = 'stl' | '3mf' | 'obj' | 'glb' | 'ply';

export interface ExportTaskArgs {
  format: ExportFormat;
  targets: SceneObject[];
  baseName: string;
  unitSystem: Parameters<typeof engine.exportSceneTo3MF>[1];
  slicerTarget: Parameters<typeof engine.exportSceneTo3MF>[2];
}

/** Argumentos del informe de imprimibilidad (solo lectura; no modifica la escena). */
export interface PrintabilityTaskArgs {
  obj: SceneObject;
  bed: PrinterProfile;
  materialId: MaterialPresetId;
  infillPercent?: number;
  overhangAngleDeg?: number;
  minWallMm?: number;
}

/** Archivos producidos por la exportación (`suffix` es la extensión con punto). */
export interface ExportTaskResult {
  files: Array<{ suffix: string; data: Uint8Array }>;
}

/** Genera los archivos de la exportación (STL/3MF/OBJ+MTL/GLB/PLY). */
export async function exportSceneFiles(a: ExportTaskArgs): Promise<ExportTaskResult> {
  switch (a.format) {
    case 'stl':
      return { files: [{ suffix: '.stl', data: engine.exportSceneToBinarySTL(a.targets) }] };
    case '3mf':
      return { files: [{ suffix: '.3mf', data: engine.exportSceneTo3MF(a.targets, a.unitSystem, a.slicerTarget) }] };
    case 'obj': {
      const { obj, mtl } = engine.exportSceneToOBJ(a.targets, a.baseName);
      const enc = new TextEncoder();
      return { files: [{ suffix: '.obj', data: enc.encode(obj) }, { suffix: '.mtl', data: enc.encode(mtl) }] };
    }
    case 'glb':
      return { files: [{ suffix: '.glb', data: await engine.exportSceneToGLB(a.targets) }] };
    case 'ply':
      return { files: [{ suffix: '.ply', data: engine.exportSceneToPLY(a.targets) }] };
  }
}

/** Tareas del motor. Los argumentos y resultados deben ser clonables (sin funciones). */
export const ENGINE_TASKS = {
  boolean: (ctx: OperationContext, a: Parameters<typeof booleanOperation>[1]) => booleanOperation(ctx, a),
  applyHoles: (ctx: OperationContext, a: { solids: SceneObject[]; holes: SceneObject[] }) => applyHoles(ctx, a.solids, a.holes),
  convexHull: (ctx: OperationContext, a: { targets: SceneObject[]; name?: string }) => convexHull(ctx, a.targets, a.name),
  hollow: (ctx: OperationContext, a: { obj: SceneObject; options: HollowOptions }) => hollowObject(ctx, a.obj, a.options),
  simplify: (ctx: OperationContext, a: { obj: SceneObject; toleranceMm: number }) => simplifyObject(ctx, a.obj, a.toleranceMm),
  refine: (ctx: OperationContext, a: { obj: SceneObject; edgeMm: number; smooth: boolean }) =>
    refineObject(ctx, a.obj, a.edgeMm, a.smooth),
  erase: (ctx: OperationContext, a: { obj: SceneObject; center: Vec3; radiusMm: number }) =>
    eraseSphere(ctx, a.obj, a.center, a.radiusMm),
  projectSurface: (ctx: OperationContext, a: { obj: SceneObject; options: SurfaceProjectionOptions }) =>
    projectOnSurface(ctx, a.obj, a.options),
  planeCut: (ctx: OperationContext, a: { obj: SceneObject; options: PlaneCutOptions }) => planeCut(ctx, a.obj, a.options),
  splitDisconnected: (ctx: OperationContext, a: { obj: SceneObject }) => splitDisconnected(ctx, a.obj),
  mold: (ctx: OperationContext, a: { obj: SceneObject; options: MoldOptions }) => generateMold(ctx, a.obj, a.options),
  detectStructures: (_ctx: OperationContext, a: { obj: SceneObject; creaseAngleDeg: number }) =>
    engine.detectStructuralRegions(a.obj, { creaseAngleDeg: a.creaseAngleDeg }),
  extractStructure: (
    ctx: OperationContext,
    a: { obj: SceneObject; segmentation: StructuralSegmentationResult; region: DetectedStructureRegion; removeFromSource: boolean },
  ) => extractStructure(ctx, a.obj, a.segmentation, a.region, a.removeFromSource),
  splitStructures: (ctx: OperationContext, a: { obj: SceneObject; segmentation: StructuralSegmentationResult }) =>
    splitStructures(ctx, a.obj, a.segmentation),
  thread: (ctx: OperationContext, a: { options: ThreadOptions; placement: { name?: string; position?: Vec3 } }) =>
    createThread(ctx, a.options, a.placement),
  export: (_ctx: OperationContext, a: ExportTaskArgs) => exportSceneFiles(a),
  printability: (_ctx: OperationContext, a: PrintabilityTaskArgs) =>
    engine.analyzePrintability(a.obj, a.bed, a.materialId, a.infillPercent, a.overhangAngleDeg, a.minWallMm),
};

export type EngineTaskName = keyof typeof ENGINE_TASKS;
export type EngineTaskArgs<N extends EngineTaskName> = Parameters<(typeof ENGINE_TASKS)[N]>[1];
export type EngineTaskResult<N extends EngineTaskName> = Awaited<ReturnType<(typeof ENGINE_TASKS)[N]>>;

/** Ejecuta una tarea en el hilo actual (Node, pruebas, MCP headless o respaldo sin Worker). */
export function runEngineTaskInProcess<N extends EngineTaskName>(
  ctx: OperationContext,
  name: N,
  args: EngineTaskArgs<N>,
): Promise<EngineTaskResult<N>> {
  const task = ENGINE_TASKS[name] as (c: OperationContext, a: EngineTaskArgs<N>) => Promise<EngineTaskResult<N>>;
  return Promise.resolve(task(ctx, args));
}
