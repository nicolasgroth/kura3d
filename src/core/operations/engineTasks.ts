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
import { BRAND } from '../../brand';
import type {
  DetectedStructureRegion,
  HollowOptions,
  ImageTo3DOptions,
  MaterialPresetId,
  MoldOptions,
  PlaneCutOptions,
  PrimitiveParams,
  PrimitiveType,
  PrinterProfile,
  SceneGroup,
  SceneObject,
  StructuralSegmentationResult,
  SurfaceProjectionOptions,
  SvgImportOptions,
  ThreadOptions,
  Vec3,
} from '../../types/kura';
import { measureObjectCapacity, type CapacityOptions } from '../../engine/measure';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import type { SimplifyRequest } from '../../engine/simplify';
import type { ThreeMfPlateLayout, ThreeMfProjectMeta } from '../../engine/io/threeMfExport';
import { booleanOperation, convexHull } from './csgOperations';
import { createThread, imageReliefMesh, primitiveMesh, regenerateParametric, svgMesh, type ParametricEdit } from './creationOperations';
import { eraseSphere, hollowObject, projectOnSurface, refineObject, repairObject, simplifyObject } from './meshOperations';
import type { OperationContext } from './operationTypes';
import { smoothObject, type SmoothTaskOptions } from './smoothOperations';
import { extractStructure, generateMold, planeCut, splitByColor, splitDisconnected, splitStructures } from './partOperations';
import { executeBedSplit, planSplitForBed, type ExecuteBedSplitOptions } from './splitOperations';
import { runFitToBed, type FitToBedTaskArgs } from './fitOperations';
import { orientApplyChange, orientForPrint, orientOverhangFaces, type OrientApplyTaskArgs, type OrientForPrintTaskArgs, type OrientOverhangFacesArgs } from './orientOperations';
import { runFitCheck, type FitCheckInput } from '../../engine/fitCheck';
import { arrangeOnPlatesTask, type ArrangeTaskArgs } from './plateArrangeOperations';
import { runRecipe } from '../recipes/run/executeRecipe';
import { createMagnetPocket, type MagnetPocketInput } from './magnetOperations';
import { createScrewBoss, type ScrewBossInput } from './screwBossOperations';
import { createKeyhole, type KeyholeInput } from './keyholeOperations';
import { createCablePass, type CablePassInput } from './cablePassOperations';
import { applyHolesWithPosts } from './addonPostMerge';
import type { RunInput } from '../recipes/run/types';

export type ExportFormat = 'stl' | '3mf' | 'obj' | 'glb' | 'ply';

export interface ExportTaskArgs {
  format: ExportFormat;
  targets: SceneObject[];
  baseName: string;
  unitSystem: Parameters<typeof engine.exportSceneTo3MF>[1];
  /**
   * 3MF de escena completa: grupos de la escena. `targets` trae entonces TODOS los objetos (también
   * ocultos y huecos) y el archivo lleva los metadatos de Kurra Studio para restaurarla tal cual.
   */
  sceneGroups?: SceneGroup[];
  /** 3MF con varias placas reales: placas del laminador y orígenes restados (lote P6). */
  plateLayout?: ThreeMfPlateLayout;
  /** 3MF: nombre, descripción y autor del proyecto (metadatos `Title` / `Description` / `Designer`). */
  projectMeta?: ThreeMfProjectMeta;
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

/** Argumentos de la capacidad de un recipiente (solo lectura). */
export interface CapacityTaskArgs {
  obj: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>;
  options?: Omit<CapacityOptions, 'onProgress'>;
}

/** Archivos producidos por la exportación (`suffix` es la extensión con punto). */
export interface ExportTaskResult {
  files: Array<{ suffix: string; data: Uint8Array }>;
}

/** Genera los archivos de la exportación (STL/3MF/OBJ+MTL/GLB/PLY). */
export async function exportSceneFiles(a: ExportTaskArgs): Promise<ExportTaskResult> {
  switch (a.format) {
    case 'stl':
      return { files: [{ suffix: '.stl', data: engine.exportSceneToBinarySTL(a.targets, engine.stlBrandHeader(BRAND)) }] };
    case '3mf':
      return { files: [{ suffix: '.3mf', data: engine.exportSceneTo3MF(a.targets, a.unitSystem, undefined, BRAND, a.sceneGroups ? { groups: a.sceneGroups } : undefined, a.plateLayout, a.projectMeta) }] };
    case 'obj': {
      const { obj, mtl } = engine.exportSceneToOBJ(a.targets, a.baseName, BRAND);
      const enc = new TextEncoder();
      return { files: [{ suffix: '.obj', data: enc.encode(obj) }, { suffix: '.mtl', data: enc.encode(mtl) }] };
    }
    case 'glb':
      return { files: [{ suffix: '.glb', data: await engine.exportSceneToGLB(a.targets, BRAND) }] };
    case 'ply':
      return { files: [{ suffix: '.ply', data: engine.exportSceneToPLY(a.targets, BRAND) }] };
  }
}

/** Tareas del motor. Los argumentos y resultados deben ser clonables (sin funciones). */
export const ENGINE_TASKS = {
  boolean: (ctx: OperationContext, a: Parameters<typeof booleanOperation>[1]) => booleanOperation(ctx, a),
  // Une antes los postes de torreta a su pieza (sin postes es `applyHoles` tal cual).
  applyHoles: (ctx: OperationContext, a: { solids: SceneObject[]; holes: SceneObject[] }) => applyHolesWithPosts(ctx, a.solids, a.holes),
  convexHull: (ctx: OperationContext, a: { targets: SceneObject[]; name?: string }) => convexHull(ctx, a.targets, a.name),
  hollow: (ctx: OperationContext, a: { obj: SceneObject; options: HollowOptions }) => hollowObject(ctx, a.obj, a.options),
  // Número = «Por tolerancia» (compatibilidad); si no, la petición con su modo. Cancelar termina el Worker.
  simplify: (ctx: OperationContext, a: { obj: SceneObject; toleranceMm?: number; request?: SimplifyRequest }) =>
    simplifyObject(ctx, a.obj, a.request ?? a.toleranceMm ?? OPERATION_DEFAULTS.simplify.toleranceMm),
  repair: (ctx: OperationContext, a: { obj: SceneObject; options?: Omit<engine.MeshRepairOptions, 'onProgress'> }) =>
    repairObject(ctx, a.obj, a.options),
  diagnoseMesh: (_ctx: OperationContext, a: { mesh: Pick<SceneObject['mesh'], 'positions' | 'indices'> }) => engine.diagnoseMesh(a.mesh),
  refine: (ctx: OperationContext, a: { obj: SceneObject; edgeMm: number; smooth: boolean }) =>
    refineObject(ctx, a.obj, a.edgeMm, a.smooth),
  smooth: (ctx: OperationContext, a: { obj: SceneObject; options?: SmoothTaskOptions }) => smoothObject(ctx, a.obj, a.options),
  erase: (ctx: OperationContext, a: { obj: SceneObject; center: Vec3; radiusMm: number }) =>
    eraseSphere(ctx, a.obj, a.center, a.radiusMm),
  projectSurface: (ctx: OperationContext, a: { obj: SceneObject; options: SurfaceProjectionOptions }) =>
    projectOnSurface(ctx, a.obj, a.options),
  planeCut: (ctx: OperationContext, a: { obj: SceneObject; options: PlaneCutOptions }) => planeCut(ctx, a.obj, a.options),
  splitDisconnected: (ctx: OperationContext, a: { obj: SceneObject }) => splitDisconnected(ctx, a.obj),
  splitByColor: (ctx: OperationContext, a: { obj: SceneObject; options: engine.ColorSplitOptions }) =>
    splitByColor(ctx, a.obj, 1, a.options),
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
  // Creación: el Worker genera la malla; el hilo principal la ubica en la escena y crea el objeto.
  primitiveMesh: (_ctx: OperationContext, a: { type: PrimitiveType; params?: PrimitiveParams }) => primitiveMesh(a.type, a.params),
  regenerateParametric: (ctx: OperationContext, a: { obj: SceneObject; edit: ParametricEdit }) => regenerateParametric(ctx, a.obj, a.edit),
  // Alojamiento de imán: negativo orientado por la cara y pared medida con rayos sobre la anfitriona.
  magnetPocket: (ctx: OperationContext, a: MagnetPocketInput) => createMagnetPocket(ctx, a),
  // Torreta para tornillo: poste (sólido) y agujero (negativo) orientados por la cara, con su análisis.
  screwBoss: (ctx: OperationContext, a: ScrewBossInput) => createScrewBoss(ctx, a),
  // Ojo de cerradura para colgar en el muro: negativo de tres partes unidas, ranura hacia «arriba».
  keyhole: (ctx: OperationContext, a: KeyholeInput) => createKeyhole(ctx, a),
  // Paso de cable: negativo pasante con el largo medido con rayos.
  cablePass: (ctx: OperationContext, a: CablePassInput) => createCablePass(ctx, a),
  imageReliefMesh: (_ctx: OperationContext, a: { options: ImageTo3DOptions }) => imageReliefMesh(a.options),
  svgMesh: (_ctx: OperationContext, a: { options: SvgImportOptions; contours: engine.PackedSvgContours }) => svgMesh(a.options, a.contours),
  splitPlan: (
    ctx: OperationContext,
    a: { obj: SceneObject; bed: engine.SplitBed; options?: engine.BedSplitPlanOptions; assemblyPreview?: Omit<engine.BedSplitExecuteOptions, 'onProgress'> },
  ) => planSplitForBed(ctx, a.obj, a.bed, a.options, a.assemblyPreview),
  splitForBed: (ctx: OperationContext, a: { obj: SceneObject; plan: engine.BedSplitPlan; options: ExecuteBedSplitOptions }) =>
    executeBedSplit(ctx, a.obj, a.plan, a.options),
  fitToBed: (_ctx: OperationContext, a: FitToBedTaskArgs) => runFitToBed(a),
  // Orientar para imprimir: analizar es solo lectura; aplicar devuelve un parche de transformación.
  orientForPrint: (_ctx: OperationContext, a: OrientForPrintTaskArgs) => orientForPrint(a),
  orientApply: (_ctx: OperationContext, a: OrientApplyTaskArgs) => orientApplyChange(a),
  orientOverhangFaces: (_ctx: OperationContext, a: OrientOverhangFacesArgs) => orientOverhangFaces(a),
  // Repartir en placas: solo lectura (orienta si se pide y empaqueta); el store aplica el plan en un paso.
  arrangeOnPlates: (_ctx: OperationContext, a: ArrangeTaskArgs) => arrangeOnPlatesTask(a),
  // Receta completa (validar → resolver → escena de trabajo → salidas): el resultado es un SceneChange de solo objetos nuevos.
  runRecipe: (ctx: OperationContext, a: Omit<RunInput, 'signal' | 'now'>) => runRecipe(ctx, a),
  validateAssembly: (_ctx: OperationContext, a: { objects: SceneObject[] }) => engine.storedAssemblyResponse(a.objects),
  // Comprobar encaje: solo lectura; cancelar termina el Worker (en proceso, descarta el resultado).
  fitCheck: (ctx: OperationContext, a: FitCheckInput) => runFitCheck(a, { onProgress: ctx.onProgress }),
  export: (_ctx: OperationContext, a: ExportTaskArgs) => exportSceneFiles(a),
  printability: (_ctx: OperationContext, a: PrintabilityTaskArgs) =>
    engine.analyzePrintability(a.obj, a.bed, a.materialId, a.infillPercent, a.overhangAngleDeg, a.minWallMm),
  capacity: (ctx: OperationContext, a: CapacityTaskArgs) =>
    measureObjectCapacity(a.obj, { ...a.options, onProgress: ctx.onProgress }),
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
  engine.takeImplicitWeldWarning();
  return Promise.resolve(task(ctx, args)).then((result) => attachImplicitWeldWarning(result));
}

/**
 * Si la tarea solo funcionó porque el motor soldó vértices en silencio, agrega `MESH_WELDED_IMPLICITLY`
 * a los avisos de su `SceneChange` (directo o en `change`). Una sola definición para app y headless.
 */
export function attachImplicitWeldWarning<T>(result: T): T {
  const warning = engine.takeImplicitWeldWarning();
  if (!warning || result === null || typeof result !== 'object') return result;
  const r = result as { warnings?: unknown; change?: { warnings?: unknown } };
  const list = Array.isArray(r.warnings) ? r.warnings : Array.isArray(r.change?.warnings) ? r.change!.warnings : null;
  if (list) (list as engine.EngineWarning[]).push(warning);
  return result;
}
