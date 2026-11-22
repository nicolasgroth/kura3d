/**
 * @file mcp-server/src/headlessEngine.ts
 * @description Capa delgada de estado de escena para el modo Headless del servidor MCP de Kura3D.
 * Mantiene objetos, unidades y perfil de impresora en memoria. Las operaciones de escena son las
 * mismas funciones puras que usa la app (`src/core/operations`, sobre el motor Manifold de
 * `src/engine`), con la política de construcción y los nombres del headless. Este archivo solo
 * valida entradas, aplica el `SceneChange` y arma la respuesta MCP.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as ops from '../../src/core/operations/index';
import type { OperationContext, SceneChange } from '../../src/core/operations/index';
import { parametricStateOf } from '../../src/core/scene/parametric';
import { HEADLESS_BUILD_POLICY } from '../../src/core/scene/sceneObjects';
import * as engine from '../../src/engine/index';
import { OPERATION_DEFAULTS } from '../../src/engine/operationLimits';
import { resolveAssemblyTargets, ValidateAssemblyTargetError } from '../../src/core/commands/validateAssemblySchema';
import { createHeadlessNaming } from './headlessNaming.js';
import { write3mfFile, writeStlFile, type ExportFileResult } from './headlessExport.js';
import { freePlacer, spreadPartsInFreeSpace, type HeadlessPlacement } from './headlessPlacement.js';
import { SerialQueue } from './headlessQueue.js';
import {
  assertUnlocked,
  HeadlessCommandError,
  makeObjectId,
  worldStatsOf,
  summarizeObject,
  type BuildObjectParams,
  type HeadlessSceneObject,
  type SceneObjectSummary,
} from './headlessSupport.js';
import {
  DEFAULT_PRINTER_PROFILES,
  MATERIAL_PRESETS,
  type AlignMode,
  type BooleanOpType,
  type DetectedStructureRegion,
  type MaterialPresetId,
  type MoldOptions,
  type PlaneCutOptions,
  type PrimitiveParams,
  type PrimitiveType,
  type PrintabilityReport,
  type PrinterProfile,
  type SegmentationOptions,
  type SlicerTarget,
  type StructuralSegmentationResult,
  type SurfaceProjectionOptions,
  type TextureOptions,
  type ThreadOptions,
  type UnitSystem,
  type Vec3,
} from './types.js';

export type { ExportFileResult } from './headlessExport.js';
export { HeadlessUnsupportedError, type SceneObjectSummary } from './headlessSupport.js';

/** Separación fija entre piezas de `arrange_grid` (la misma que en la app). */
export const ENGINE_GRID_SPACING_MM = ops.ARRANGE_GRID_SPACING_MM;

/** Nota común que identifica el origen real de la geometría en las respuestas. */
const ENGINE_NOTE = 'Calculado con el motor Manifold compartido de Kura3D (src/engine).';

/** Instantánea completa del estado de la escena en modo Headless. */
export interface HeadlessSceneState {
  mode: 'headless';
  units: UnitSystem;
  printerProfile: PrinterProfile;
  objectCount: number;
  objects: SceneObjectSummary[];
}

/** Motor de escena en memoria usado cuando la UI de Kura3D no está conectada al puente. */
export class KuraHeadlessEngine {
  private readonly objects = new Map<string, HeadlessSceneObject>();
  private units: UnitSystem = 'mm';
  private printerProfile: PrinterProfile = { ...DEFAULT_PRINTER_PROFILES[0] };
  private counter = 0;
  /** Cola FIFO: las llamadas MCP concurrentes se ejecutan de a una (ver `dispatchWithFallback`). */
  readonly queue = new SerialQueue();
  /** Contexto de las operaciones compartidas: estadísticas de mundo, IDs `kura_N_*` y nombres fijos. */
  private readonly ctx: OperationContext = {
    policy: HEADLESS_BUILD_POLICY,
    newId: () => makeObjectId(++this.counter),
    naming: createHeadlessNaming(() => this.counter),
  };

  /** Devuelve una instantánea serializable de toda la escena actual. */
  getSceneState(): HeadlessSceneState {
    const objects = Array.from(this.objects.values()).map(summarizeObject);
    return {
      mode: 'headless',
      units: this.units,
      printerProfile: { ...this.printerProfile },
      objectCount: objects.length,
      objects,
    };
  }

  /** Copia profunda de un objeto de escena (malla incluida) para inspección o verificación. */
  getObject(objectId: string): HeadlessSceneObject {
    return structuredClone(this.requireObject(objectId));
  }

  /**
   * Crea una primitiva paramétrica (o texto 3D) con `createPrimitiveMesh` del motor, apoyada en la
   * cama en el primer hueco libre, salvo `placement: 'origin'` o `position` explícita.
   */
  async createPrimitive(input: {
    primitiveType: PrimitiveType;
    name?: string;
    params?: PrimitiveParams;
    position?: Vec3;
    rotation?: Vec3;
    scale?: Vec3;
    color?: string;
    materialPreset?: MaterialPresetId;
    isHole?: boolean;
    /** `free` (por defecto): primer hueco libre de la cama del perfil; `origin`: origen. */
    placement?: HeadlessPlacement;
  }): Promise<SceneObjectSummary> {
    const params: PrimitiveParams = input.params ?? {};
    const obj = await ops.createPrimitive(this.ctx, {
      place: this.placer(input.placement, input.rotation, input.scale),
      type: input.primitiveType,
      params,
      name: input.name ?? this.ctx.naming.primitive(input.primitiveType, this.counter),
      color: input.color ?? '#38bdf8',
      position: input.position,
      rotation: input.rotation,
      scale: input.scale,
      materialPreset: input.materialPreset,
      isHole: input.isHole,
    });
    this.objects.set(obj.id, obj);
    return summarizeObject(obj);
  }

  /** Modifica posición, rotación, escala, nombre o propiedades básicas de un objeto. */
  transformObject(
    objectId: string,
    patch: {
      position?: Vec3;
      rotation?: Vec3;
      scale?: Vec3;
      name?: string;
      isHole?: boolean;
      visible?: boolean;
      locked?: boolean;
    }
  ): SceneObjectSummary {
    const obj = this.requireObject(objectId);
    // Bloqueado: solo se acepta cambiar el propio `locked` (para desbloquear).
    const otherKeys = Object.entries(patch).some(([k, v]) => k !== 'locked' && v !== undefined);
    if (otherKeys && !(patch.locked === false)) assertUnlocked(obj);
    if (patch.position) obj.position = [...patch.position];
    if (patch.rotation) obj.rotation = [...patch.rotation];
    if (patch.scale) obj.scale = [...patch.scale];
    if (patch.name !== undefined) obj.name = patch.name;
    if (patch.isHole !== undefined) obj.isHole = patch.isHole;
    if (patch.visible !== undefined) obj.visible = patch.visible;
    if (patch.locked !== undefined) obj.locked = patch.locked;
    obj.stats = worldStatsOf(obj);
    return summarizeObject(obj);
  }

  /** Elimina un objeto de la escena por su identificador. */
  deleteObject(objectId: string): { deletedId: string; remainingCount: number } {
    this.requireEditable(objectId);
    this.objects.delete(objectId);
    return { deletedId: objectId, remainingCount: this.objects.size };
  }

  /** Ahueca el sólido con `hollowMesh` del motor (cavidad interior real y drenaje opcional). */
  async hollowObject(
    objectId: string,
    options: { wallThickness: number; drainHole?: boolean; drainHoleRadius?: number }
  ): Promise<SceneObjectSummary> {
    const obj = this.requireEditable(objectId);
    const hollow = {
      enabled: true,
      wallThickness: options.wallThickness,
      drainHole: Boolean(options.drainHole),
      drainHoleRadius: options.drainHoleRadius ?? 2,
    };
    this.apply(await ops.hollowObject(this.ctx, obj, hollow));
    return summarizeObject(obj);
  }

  /** Booleana CSG exacta encadenando `runBooleanOperation` del motor sobre cada herramienta. */
  async booleanOperation(input: {
    targetId: string;
    toolIds: string[];
    operation: BooleanOpType;
    keepTools?: boolean;
    resultName?: string;
  }): Promise<{
    object: SceneObjectSummary | null;
    resultId: string | null;
    consumedIds: string[];
    note: string;
    warnings: engine.EngineWarning[];
  }> {
    const target = this.requireEditable(input.targetId);
    if (input.toolIds.length === 0) {
      throw new Error('Se requiere al menos un objeto herramienta en `toolIds`.');
    }
    const tools = input.toolIds.map((id) => this.requireEditable(id));
    if (tools.some((t) => t.id === target.id)) {
      throw new Error('El objeto objetivo no puede ser también herramienta de la operación booleana.');
    }

    const { result, change } = await ops.booleanOperation(this.ctx, {
      target,
      tools,
      op: input.operation,
      keepTools: input.keepTools,
      name: input.resultName ?? this.ctx.naming.booleanResult(input.operation, [target]),
    });
    // Piezas que no se tocan: la escena no cambia y se devuelve el aviso BOOLEAN_NO_EFFECT.
    if (!result) return { object: null, resultId: null, consumedIds: [], note: ENGINE_NOTE, warnings: change.warnings };
    this.apply(change);
    return { object: summarizeObject(result), resultId: result.id, consumedIds: change.removedIds, note: ENGINE_NOTE, warnings: [] };
  }

  /**
   * Dividir para imprimir (misma operación que la app). Con `dryRun` solo devuelve el plan. Las piezas
   * quedan armadas en su lugar; su ubicación de impresión va en `metadata.split.print`.
   */
  async splitForBed(
    objectId: string,
    input: { bed?: Partial<engine.SplitBed>; plan: engine.BedSplitPlanOptions; execute: Omit<engine.BedSplitExecuteOptions, 'onProgress'>; dryRun: boolean }
  ) {
    const obj = this.requireEditable(objectId);
    const p = this.printerProfile;
    const bed: engine.SplitBed = { widthMm: p.bedWidthMm, depthMm: p.bedDepthMm, heightMm: p.maxHeightMm, ...input.bed };
    const plan = await ops.planSplitForBed(this.ctx, obj, bed, input.plan);
    if (input.dryRun || plan.fitsWithoutCuts) return { dryRun: input.dryRun, plan, parts: [], joints: [], plateCount: 0, note: ENGINE_NOTE, warnings: [] };
    const { result, change } = await ops.executeBedSplit(this.ctx, obj, plan, { ...input.execute, bed });
    this.apply(change);
    return {
      dryRun: false,
      plan,
      parts: result.parts.map((o) => ({ ...summarizeObject(o), code: o.metadata?.split?.code, plate: o.metadata?.split?.print.plate })),
      joints: result.joints,
      ...(result.looseDowels.length > 0 ? { looseDowels: result.looseDowels } : {}),
      plateCount: result.plateCount,
      assembly: result.assembly,
      volumes: { source: result.sourceVolumeMm3, clearance: result.clearanceVolumeMm3, engraved: result.engravedVolumeMm3 },
      note: ENGINE_NOTE,
      warnings: change.warnings,
    };
  }

  /**
   * Revalida el armado de un grupo dividido (solo lectura): por `groupId` o por `ids` de piezas del
   * mismo grupo, con las uniones guardadas en `metadata.split.joints`. Mismo esquema que el bus.
   */
  validateAssembly(input: { groupId?: string; ids?: string[] }) {
    let targets: HeadlessSceneObject[];
    try {
      targets = resolveAssemblyTargets(Array.from(this.objects.values()), input);
    } catch (err) {
      if (!(err instanceof ValidateAssemblyTargetError)) throw err;
      const message: Record<string, string> = {
        'not-found': `Part or split group "${err.detail}" not found.`,
        'no-target': 'Give groupId or the ids of the split parts.',
      };
      const code = err.reason === 'not-found' ? 'not-found' : err.reason === 'no-target' ? 'invalid-params' : 'precondition';
      throw new HeadlessCommandError(
        code,
        message[err.reason] ?? `These parts cannot be revalidated (${err.reason}): they must belong to one split group with their joints saved.`,
        { reason: err.reason },
      );
    }
    return { ...engine.storedAssemblyResponse(targets), note: ENGINE_NOTE };
  }

  /** Corta por plano con `planeCutWithConnectors` del motor (conectores reales incluidos). */
  async planeCut(
    objectId: string,
    options: PlaneCutOptions
  ): Promise<{ parts: SceneObjectSummary[]; note: string; warnings: engine.EngineWarning[] }> {
    const obj = this.requireEditable(objectId);
    const { parts, change } = await ops.planeCut(this.ctx, obj, options);
    if (parts.length === 0) {
      throw new Error('El plano de corte no intersecta el objeto: no se generaron piezas.');
    }
    // Las mitades se separan en X/Z para que sus cajas envolventes (y los conectores) no se solapen.
    const placed = this.spread(parts, change.removedIds);
    this.apply({ ...change, added: placed });
    return { parts: placed.map(summarizeObject), note: ENGINE_NOTE, warnings: change.warnings };
  }

  /** Separa islas desconectadas con `splitDisconnectedParts` del motor. */
  async splitDisconnected(objectId: string): Promise<{ parts: SceneObjectSummary[]; note: string }> {
    const obj = this.requireEditable(objectId);
    const { parts, change } = await ops.splitDisconnected(this.ctx, obj);
    if (parts.length === 0) {
      return { parts: [summarizeObject(obj)], note: 'El objeto es un único cuerpo conexo; no hay nada que separar.' };
    }
    this.apply(change);
    return { parts: parts.map(summarizeObject), note: ENGINE_NOTE };
  }

  /** Separa por color de cara con `splitMeshByColor` del motor. */
  splitByColor(objectId: string): {
    parts: SceneObjectSummary[];
    note: string;
    warnings?: Array<{ code: string; message: string }>;
  } {
    const obj = this.requireEditable(objectId);
    const { parts, change } = ops.splitByColor(this.ctx, obj, 2);
    if (parts.length === 0) {
      return { parts: [summarizeObject(obj)], note: 'El objeto tiene un solo color; no hay nada que separar.' };
    }
    this.apply(change);
    const summaries = parts.map(summarizeObject);
    if (change.warnings.length === 0) return { parts: summaries, note: ENGINE_NOTE };
    return {
      parts: summaries,
      note: ENGINE_NOTE,
      warnings: change.warnings.map((w) => ({ code: w.code, message: engine.localizeEngineWarning('es', w) })),
    };
  }

  /** Desplaza la superficie con `applyProceduralTexture` del motor. */
  applyTexture(objectId: string, texture: TextureOptions): SceneObjectSummary {
    const obj = this.requireEditable(objectId);
    this.apply(ops.textureObject(this.ctx, obj, texture));
    return summarizeObject(obj);
  }

  /** Pinta el objeto completo (`paintEntireMesh`): color base y color por cara para 3MF. */
  paintObject(objectId: string, color: string): SceneObjectSummary {
    const obj = this.requireEditable(objectId);
    this.apply(ops.paintWholeObject(this.ctx, obj, color, true));
    return summarizeObject(obj);
  }

  /** Asigna un preset de material físico/visual PBR. */
  setMaterial(objectId: string, materialPreset: MaterialPresetId): SceneObjectSummary {
    if (!Object.prototype.hasOwnProperty.call(MATERIAL_PRESETS, materialPreset)) {
      throw new Error(
        `Preset de material desconocido '${materialPreset}'. Disponibles: ${Object.keys(MATERIAL_PRESETS).join(', ')}`
      );
    }
    const obj = this.requireEditable(objectId);
    obj.materialPreset = materialPreset;
    return summarizeObject(obj);
  }

  /** Extruye los contornos reales del SVG con `extrudeSvgToMesh` del motor. */
  async importSvg(input: {
    svgContent: string;
    name?: string;
    depth?: number;
    targetWidth?: number;
    curveSegments?: number;
    placement?: HeadlessPlacement;
  }): Promise<SceneObjectSummary> {
    const name = input.name ?? 'SVG_Extruded';
    const obj = await ops.importSvg(this.ctx, {
      svgContent: input.svgContent,
      name,
      depth: input.depth ?? 4,
      targetWidth: input.targetWidth ?? 50,
      curveSegments: input.curveSegments ?? 16,
    }, { name, color: '#f97316', place: this.placer(input.placement) });
    this.objects.set(obj.id, obj);
    return summarizeObject(obj);
  }

  /** Actualiza el sistema de unidades de la escena. */
  setUnits(units: UnitSystem): { units: UnitSystem } {
    this.units = units;
    return { units: this.units };
  }

  /** Selecciona el perfil de impresora 3D activo por su identificador. */
  setPrinterProfile(profileId: string): { printerProfile: PrinterProfile } {
    const found = DEFAULT_PRINTER_PROFILES.find((p) => p.id === profileId);
    if (!found) {
      const available = DEFAULT_PRINTER_PROFILES.map((p) => p.id).join(', ');
      throw new Error(`Perfil de impresora desconocido '${profileId}'. Disponibles: ${available}`);
    }
    this.printerProfile = { ...found };
    return { printerProfile: { ...this.printerProfile } };
  }

  /** Analiza imprimibilidad con `analyzePrintability` del motor frente al perfil activo. */
  analyzePrintability(
    objectId: string,
    options: { materialPreset?: MaterialPresetId; infillPercent?: number; overhangAngleDeg?: number } = {}
  ): PrintabilityReport {
    const obj = this.requireObject(objectId);
    const materialPreset = options.materialPreset ?? obj.materialPreset ?? 'pla_matte';
    const infillPercent = options.infillPercent ?? OPERATION_DEFAULTS.printability.infillPercent;
    const report = engine.analyzePrintability(
      obj,
      this.printerProfile,
      materialPreset,
      infillPercent,
      options.overhangAngleDeg ?? OPERATION_DEFAULTS.printability.overhangAngleDeg
    );
    const world = engine.applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
    const { overhangFaceIndices: _omitted, ...rest } = report;
    return {
      ...rest,
      // `warnings` (español) se mantiene por compatibilidad; `issues` trae código y parámetros.
      warnings: report.issues.map((w) => engine.localizePrintWarning('es', w)),
      issues: report.issues.map((w) => ({ code: w.code, params: { ...w.params } })),
      dimensionsMm: engine.computeMeshStats(world).dimensionsMm,
      materialPreset,
      infillPercent,
      printerProfileId: this.printerProfile.id,
    };
  }

  /** Alinea o distribuye en grilla con `computeAlignmentPositions` del motor. */
  alignObjects(
    objectIds: string[],
    mode: AlignMode,
    spacingMm?: number
  ): { objects: SceneObjectSummary[]; mode: AlignMode; spacingMm?: number } {
    if (objectIds.length === 0) {
      throw new Error('Se requiere al menos un objeto en `objectIds` para alinear.');
    }
    if (spacingMm !== undefined && spacingMm !== ENGINE_GRID_SPACING_MM) {
      throw new Error(
        `spacingMm=${spacingMm} no soportado: el motor de Kura3D distribuye con separación fija de ${ENGINE_GRID_SPACING_MM} mm. Omite el parámetro.`
      );
    }
    // Operación pura compartida con el store; los bloqueados no se mueven.
    const targets = objectIds.map((id) => this.requireObject(id));
    this.apply(ops.alignObjects([...this.objects.values()], targets, mode, this.printerProfile).change);
    return {
      mode,
      ...(mode === 'arrange_grid' ? { spacingMm: ENGINE_GRID_SPACING_MM } : {}),
      objects: targets.filter((o) => !o.locked).map(summarizeObject),
    };
  }

  /** Genera una rosca métrica ISO helicoidal real con `createMetricThread` del motor. */
  async createThread(options: ThreadOptions, placement?: HeadlessPlacement): Promise<SceneObjectSummary> {
    const obj = await ops.createThread(this.ctx, options, { name: options.name, place: this.placer(placement) });
    this.objects.set(obj.id, obj);
    return summarizeObject(obj);
  }

  /** Genera moldes con cavidad booleana real mediante `generateMold` del motor. */
  async generateMold(
    objectId: string,
    options: MoldOptions,
    placement: HeadlessPlacement = 'free'
  ): Promise<{ parts: SceneObjectSummary[]; mode: MoldOptions['mode']; note: string }> {
    const master = this.requireObject(objectId);
    const { parts, change } = await ops.generateMold(this.ctx, master, {
      ...options,
      pourSpoutRadiusMm: options.pourSpoutRadiusMm ?? OPERATION_DEFAULTS.mold.pourSpoutRadiusMm,
    });
    if (parts.length === 0) {
      throw new Error('El motor no generó piezas de molde para este objeto.');
    }
    const placed = placement === 'origin' ? parts : this.spread(parts, change.removedIds);
    this.apply({ ...change, added: placed });
    return { parts: placed.map(summarizeObject), mode: options.mode, note: ENGINE_NOTE };
  }

  /** Proyecta texto o SVG con `projectGraphicOntoSurface` del motor (modifica el objeto). */
  async projectOnSurface(
    objectId: string,
    options: SurfaceProjectionOptions
  ): Promise<{ object: SceneObjectSummary; mode: SurfaceProjectionOptions['mode']; note: string }> {
    const target = this.requireEditable(objectId);
    if (options.kind === 'svg' && !options.svgContent) {
      throw new Error('kind="svg" requiere `svgContent`.');
    }
    this.apply(await ops.projectOnSurface(this.ctx, target, options));
    return { object: summarizeObject(target), mode: options.mode, note: ENGINE_NOTE };
  }

  /** Decima la malla con `simplifyMesh` del motor (Manifold `simplify`). */
  async simplifyMesh(
    objectId: string,
    toleranceMm: number
  ): Promise<{ object: SceneObjectSummary; toleranceMm: number; trianglesBefore: number }> {
    const obj = this.requireEditable(objectId);
    const trianglesBefore = obj.stats.triangles;
    this.apply(await ops.simplifyObject(this.ctx, obj, toleranceMm));
    return { object: summarizeObject(obj), toleranceMm, trianglesBefore };
  }

  /** Refina (y suaviza opcionalmente) con `refineMesh` del motor. */
  async refineMesh(
    objectId: string,
    targetEdgeLengthMm: number,
    smooth: boolean
  ): Promise<{ object: SceneObjectSummary; targetEdgeLengthMm: number; smooth: boolean }> {
    const obj = this.requireEditable(objectId);
    this.apply(await ops.refineObject(this.ctx, obj, targetEdgeLengthMm, smooth));
    return { object: summarizeObject(obj), targetEdgeLengthMm, smooth };
  }

  /** Calcula la envolvente convexa real con `computeConvexHull` del motor. */
  async convexHull(
    objectIds: string[],
    name?: string
  ): Promise<{ object: SceneObjectSummary; sourceObjectIds: string[] }> {
    if (objectIds.length === 0) {
      throw new Error('Se requiere al menos un objeto en `objectIds` para generar la envolvente.');
    }
    const targets = objectIds.map((id) => this.requireObject(id));
    const { result, change } = await ops.convexHull(this.ctx, targets, name);
    this.apply(change);
    return { object: summarizeObject(result), sourceObjectIds: objectIds };
  }

  /** Detecta sub-estructuras con `detectStructuralRegions` del motor. */
  async detectStructures(
    objectId: string,
    options: SegmentationOptions = {}
  ): Promise<StructuralSegmentationResult> {
    const obj = this.requireObject(objectId);
    return engine.detectStructuralRegions(obj, stripUndefined(options));
  }

  /** Colorea por cara cada sub-estructura detectada (`applyStructureColorsToMesh`). */
  async colorizeStructures(
    objectId: string,
    options: { creaseAngleDeg?: number } = {}
  ): Promise<{ object: SceneObjectSummary; regions: DetectedStructureRegion[]; regionCount: number }> {
    const obj = this.requireEditable(objectId);
    const segmentation = await this.detectStructures(objectId, options);
    if (segmentation.regions.length === 0) {
      throw new Error('No se detectaron sub-estructuras para colorear en el objeto.');
    }
    this.apply(ops.colorizeStructures(this.ctx, obj, segmentation));
    return { object: summarizeObject(obj), regions: segmentation.regions, regionCount: segmentation.regions.length };
  }

  /** Extrae una sub-estructura detectada como pieza cerrada con `extractStructuralRegion`. */
  async extractStructure(
    objectId: string,
    regionId: string,
    removeFromSource = false
  ): Promise<{
    extractedObject: SceneObjectSummary;
    sourceObjectId: string;
    removedFromSource: boolean;
    sourceDeleted: boolean;
    region: DetectedStructureRegion;
  }> {
    const obj = removeFromSource ? this.requireEditable(objectId) : this.requireObject(objectId);
    const segmentation = await this.detectStructures(objectId);
    const region = segmentation.regions.find((r) => r.id === regionId);
    if (!region) {
      const available = segmentation.regions.map((r) => r.id).join(', ') || 'ninguna';
      throw new Error(
        `Región estructural '${regionId}' no encontrada en el objeto '${objectId}'. Disponibles: ${available}`
      );
    }

    const { extracted, sourceDeleted, change } = await ops.extractStructure(
      this.ctx, obj, segmentation, region, removeFromSource, { isHole: obj.isHole },
    );
    this.apply(change);
    return {
      extractedObject: summarizeObject(extracted),
      sourceObjectId: obj.id,
      removedFromSource: removeFromSource,
      sourceDeleted,
      region,
    };
  }

  /** Refleja la malla en un eje con `mirrorMeshAxis` del motor (winding corregido). */
  mirrorObject(objectId: string, axis: 'x' | 'y' | 'z'): SceneObjectSummary {
    const obj = this.requireEditable(objectId);
    this.apply(ops.mirrorObject(this.ctx, obj, axis));
    return summarizeObject(obj);
  }

  /** Exporta los objetos indicados (o la escena visible) a STL binario o ASCII. */
  async exportStl(input: { outputPath: string; objectIds?: string[]; binary?: boolean }): Promise<ExportFileResult> {
    return writeStlFile(input.outputPath, this.resolveExportTargets(input.objectIds), input.binary ?? true);
  }

  /** Exporta a 3MF Multi-Slicer con materiales y colores por triángulo (`exportSceneTo3MF`). */
  async export3mf(input: {
    outputPath: string;
    objectIds?: string[];
    slicerTarget?: SlicerTarget;
  }): Promise<ExportFileResult> {
    const slicerTarget: SlicerTarget = input.slicerTarget ?? this.printerProfile.brand ?? 'generic';
    return write3mfFile(input.outputPath, this.resolveExportTargets(input.objectIds), this.units, slicerTarget);
  }

  private resolveExportTargets(objectIds?: string[]): HeadlessSceneObject[] {
    if (objectIds && objectIds.length > 0) {
      return objectIds.map((id) => this.requireObject(id));
    }
    return Array.from(this.objects.values());
  }

  /** Regenera una primitiva o rosca paramétrica con parámetros nuevos (misma operación que la app). */
  async updatePrimitiveParams(
    objectId: string,
    values: PrimitiveParams & Partial<Omit<ThreadOptions, 'kind'>>,
  ): Promise<SceneObjectSummary> {
    const obj = this.requireEditable(objectId);
    const state = parametricStateOf(obj);
    const { diameterMm, pitchMm, lengthMm, clearanceMm, includeHead, ...params } = values;
    let edit: ops.ParametricEdit;
    if (state.status === 'primitive') edit = { kind: 'primitive', params: stripUndefined(params) };
    else if (state.status === 'thread') {
      edit = { kind: 'thread', options: stripUndefined({ diameterMm, pitchMm, lengthMm, clearanceMm, includeHead }) as ThreadOptions };
    } else throw new Error(`El objeto '${obj.name}' ya no es paramétrico: una operación cambió su malla.`);
    this.apply(await ops.regenerateParametric(this.ctx, obj, edit));
    return summarizeObject(this.requireObject(objectId));
  }

  private bed() {
    return { width: this.printerProfile.bedWidthMm, depth: this.printerProfile.bedDepthMm };
  }

  /** Colocador de piezas nuevas (hueco libre por defecto) frente a la escena actual. */
  private placer(placement?: HeadlessPlacement, rotation?: Vec3, scale?: Vec3) {
    return freePlacer([...this.objects.values()], this.bed(), placement, rotation, scale);
  }

  /** Reparte piezas resultantes en huecos libres, sin contar los objetos que la operación quita. */
  private spread<T extends HeadlessSceneObject>(parts: T[], removedIds: string[]): T[] {
    const removed = new Set(removedIds);
    return spreadPartsInFreeSpace([...this.objects.values()].filter((o) => !removed.has(o.id)), parts, this.bed());
  }

  /** Aplica un `SceneChange` en el mapa: parches in situ, bajas y altas al final (orden de inserción). */
  private apply(change: SceneChange): void {
    for (const { id, patch } of change.patches) {
      const obj = this.objects.get(id);
      if (obj) Object.assign(obj, patch);
    }
    for (const id of change.removedIds) this.objects.delete(id);
    for (const obj of change.added) this.objects.set(obj.id, obj);
  }

  private requireEditable(id: string): HeadlessSceneObject {
    return assertUnlocked(this.requireObject(id));
  }

  private requireObject(id: string): HeadlessSceneObject {
    const obj = this.objects.get(id);
    if (!obj) {
      throw new Error(`Objeto no encontrado en escena headless: '${id}'.`);
    }
    return obj;
  }
}

/** Quita claves `undefined` para que el motor aplique sus valores por defecto. */
function stripUndefined<T extends object>(value: T): Partial<{ [K in keyof T]: Exclude<T[K], undefined> }> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<{
    [K in keyof T]: Exclude<T[K], undefined>;
  }>;
}
