/**
 * @file mcp-server/src/headlessEngine.ts
 * @description Capa delgada de estado de escena para el modo Headless del servidor MCP de Kura3D.
 * Mantiene objetos, unidades y perfil de impresora en memoria. Las operaciones de escena son las
 * mismas funciones puras que usa la app (`src/core/operations`, sobre el motor Manifold de
 * `src/engine`), con la política de construcción y los nombres del headless. Este archivo solo
 * valida entradas, aplica el `SceneChange` y arma la respuesta MCP. La escena se guarda en ejes
 * internos (Y arriba); la entrada y la salida públicas usan los del usuario (Z arriba), como el Command
 * Bus, con las conversiones de `headlessUserAxes`.
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
import { headlessPrintabilityReport, type PrintabilityInput } from './headlessPrintability.js';
import { SerialQueue } from './headlessQueue.js';
import {
  assertUnlocked,
  HeadlessCommandError,
  makeObjectId,
  worldStatsOf,
  type HeadlessSceneObject,
  type SceneObjectSummary,
} from './headlessSupport.js';
import * as ua from './headlessUserAxes.js';
import { userSummary } from './headlessUserAxes.js';
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
const ENGINE_NOTE = 'Computed with the shared Kura3D Manifold engine (src/engine).';

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
    const objects = Array.from(this.objects.values()).map(userSummary);
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
    const rotation = ua.rotationFromUser(input.rotation);
    const scale = ua.scaleFromUser(input.scale);
    const obj = await ops.createPrimitive(this.ctx, {
      place: this.placer(input.placement, rotation, scale),
      type: input.primitiveType,
      params,
      name: input.name ?? this.ctx.naming.primitive(input.primitiveType, this.counter),
      color: input.color ?? '#38bdf8',
      position: ua.vecFromUser(input.position),
      rotation,
      scale,
      materialPreset: input.materialPreset,
      isHole: input.isHole,
    });
    this.objects.set(obj.id, obj);
    return userSummary(obj);
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
    if (patch.position) obj.position = ua.vecFromUser(patch.position)!;
    if (patch.rotation) obj.rotation = ua.rotationFromUser(patch.rotation)!;
    if (patch.scale) obj.scale = ua.scaleFromUser(patch.scale)!;
    if (patch.name !== undefined) obj.name = patch.name;
    if (patch.isHole !== undefined) obj.isHole = patch.isHole;
    if (patch.visible !== undefined) obj.visible = patch.visible;
    if (patch.locked !== undefined) obj.locked = patch.locked;
    obj.stats = worldStatsOf(obj);
    return userSummary(obj);
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
    return userSummary(obj);
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
    warnings: ua.UserWarning[];
  }> {
    const target = this.requireEditable(input.targetId);
    if (input.toolIds.length === 0) {
      throw new Error('At least one tool object is required in `toolIds`.');
    }
    const tools = input.toolIds.map((id) => this.requireEditable(id));
    if (tools.some((t) => t.id === target.id)) {
      throw new Error('The target object cannot also be a tool of the boolean operation.');
    }

    const { result, change } = await ops.booleanOperation(this.ctx, {
      target,
      tools,
      op: input.operation,
      keepTools: input.keepTools,
      name: input.resultName ?? this.ctx.naming.booleanResult(input.operation, [target]),
    });
    // Piezas que no se tocan: la escena no cambia y se devuelve el aviso BOOLEAN_NO_EFFECT.
    if (!result) return { object: null, resultId: null, consumedIds: [], note: ENGINE_NOTE, warnings: ua.userWarnings(change.warnings) };
    this.apply(change);
    return { object: userSummary(result), resultId: result.id, consumedIds: change.removedIds, note: ENGINE_NOTE, warnings: [] };
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
    const axes = input.plan.axes?.map(ua.axisFromUser);
    const plan = await ops.planSplitForBed(this.ctx, obj, bed, { ...input.plan, axes });
    const userPlan = ua.splitPlanToUser(plan);
    if (input.dryRun || plan.fitsWithoutCuts) return { dryRun: input.dryRun, plan: userPlan, parts: [], joints: [], plateCount: 0, note: ENGINE_NOTE, warnings: [] };
    const { result, change } = await ops.executeBedSplit(this.ctx, obj, plan, { ...input.execute, bed });
    this.apply(change);
    return {
      dryRun: false,
      plan: userPlan,
      parts: result.parts.map((o) => ({ ...userSummary(o), code: o.metadata?.split?.code, plate: o.metadata?.split?.print.plate })),
      joints: ua.userSplitJoints(result.joints),
      ...(result.looseDowels.length > 0 ? { looseDowels: result.looseDowels } : {}),
      plateCount: result.plateCount,
      assembly: result.assembly,
      volumes: { source: result.sourceVolumeMm3, clearance: result.clearanceVolumeMm3, engraved: result.engravedVolumeMm3 },
      note: ENGINE_NOTE,
      warnings: ua.userWarnings(change.warnings),
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
    return { ...ua.assemblyResponseToUser(engine.storedAssemblyResponse(targets)), note: ENGINE_NOTE };
  }

  /** Corta por plano con `planeCutWithConnectors` del motor (conectores reales incluidos). */
  async planeCut(
    objectId: string,
    options: PlaneCutOptions
  ): Promise<{ parts: SceneObjectSummary[]; note: string; warnings: ua.UserWarning[] }> {
    const obj = this.requireEditable(objectId);
    const internal = { ...options, ...ua.planeFromUser(options.axis, options.offset), keepMode: ua.keepModeFromUser(options.axis, options.keepMode) };
    const { parts, change } = await ops.planeCut(this.ctx, obj, internal);
    if (parts.length === 0) {
      throw new Error('The cut plane does not intersect the object: no pieces were generated.');
    }
    // Las mitades se separan sobre la cama para que sus cajas envolventes (y los conectores) no se solapen.
    const placed = this.spread(parts, change.removedIds);
    this.apply({ ...change, added: placed });
    return { parts: placed.map(userSummary), note: ENGINE_NOTE, warnings: ua.userWarnings(change.warnings) };
  }

  /** Separa islas desconectadas con `splitDisconnectedParts` del motor. */
  async splitDisconnected(objectId: string): Promise<{ parts: SceneObjectSummary[]; note: string }> {
    const obj = this.requireEditable(objectId);
    const { parts, change } = await ops.splitDisconnected(this.ctx, obj);
    if (parts.length === 0) {
      return { parts: [userSummary(obj)], note: 'The object is a single connected body; there is nothing to split.' };
    }
    this.apply(change);
    return { parts: parts.map(userSummary), note: ENGINE_NOTE };
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
      return { parts: [userSummary(obj)], note: 'The object has a single color; there is nothing to split.' };
    }
    this.apply(change);
    const summaries = parts.map(userSummary);
    if (change.warnings.length === 0) return { parts: summaries, note: ENGINE_NOTE };
    return {
      parts: summaries,
      note: ENGINE_NOTE,
      warnings: ua.userWarnings(change.warnings),
    };
  }

  /** Desplaza la superficie con `applyProceduralTexture` del motor. */
  applyTexture(objectId: string, texture: TextureOptions): SceneObjectSummary {
    const obj = this.requireEditable(objectId);
    this.apply(ops.textureObject(this.ctx, obj, texture));
    return userSummary(obj);
  }

  /**
   * Pinta el objeto completo (`paintEntireMesh`: color base y color por cara para 3MF) o, con
   * `localPoint` (coordenadas locales del usuario), una pincelada del radio por defecto de la app.
   */
  paintObject(objectId: string, color: string, localPoint?: Vec3): SceneObjectSummary {
    const obj = this.requireEditable(objectId);
    const change = localPoint
      ? ops.paintBrushSample(this.ctx, obj, ua.vecFromUser(localPoint)!, ua.PAINT_BRUSH_RADIUS_MM, color, { refineEdge: true })
      : ops.paintWholeObject(this.ctx, obj, color, OPERATION_DEFAULTS.paint.wholeSetsBaseColor);
    if (change) this.apply(change);
    return userSummary(obj);
  }

  /** Asigna un preset de material físico/visual PBR. */
  setMaterial(objectId: string, materialPreset: MaterialPresetId): SceneObjectSummary {
    if (!Object.prototype.hasOwnProperty.call(MATERIAL_PRESETS, materialPreset)) {
      throw new Error(
        `Unknown material preset '${materialPreset}'. Available: ${Object.keys(MATERIAL_PRESETS).join(', ')}`
      );
    }
    const obj = this.requireEditable(objectId);
    obj.materialPreset = materialPreset;
    return userSummary(obj);
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
    return userSummary(obj);
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
      throw new Error(`Unknown printer profile '${profileId}'. Available: ${available}`);
    }
    this.printerProfile = { ...found };
    return { printerProfile: { ...this.printerProfile } };
  }

  /** Analiza imprimibilidad con `analyzePrintability` del motor frente al perfil activo. */
  analyzePrintability(
    objectId: string,
    options: PrintabilityInput = {}
  ): PrintabilityReport {
    return headlessPrintabilityReport(this.requireObject(objectId), this.printerProfile, options);
  }

  /** Alinea o distribuye en grilla con `computeAlignmentPositions` del motor. */
  alignObjects(
    objectIds: string[],
    mode: AlignMode,
    spacingMm?: number
  ): { objects: SceneObjectSummary[]; mode: AlignMode; spacingMm?: number } {
    if (objectIds.length === 0) {
      throw new Error('At least one object is required in `objectIds` to align.');
    }
    if (spacingMm !== undefined && spacingMm !== ENGINE_GRID_SPACING_MM) {
      throw new Error(
        `spacingMm=${spacingMm} not supported: the Kura3D engine distributes with a fixed spacing of ${ENGINE_GRID_SPACING_MM} mm. Omit the parameter.`
      );
    }
    // Operación pura compartida con el store; los bloqueados no se mueven.
    const targets = objectIds.map((id) => this.requireObject(id));
    this.apply(ops.alignObjects([...this.objects.values()], targets, ua.alignModeFromUser(mode), this.printerProfile).change);
    return {
      mode,
      ...(mode === 'arrange_grid' ? { spacingMm: ENGINE_GRID_SPACING_MM } : {}),
      objects: targets.filter((o) => !o.locked).map(userSummary),
    };
  }

  /** Genera una rosca métrica ISO helicoidal real con `createMetricThread` del motor. */
  async createThread(options: ThreadOptions, placement?: HeadlessPlacement): Promise<SceneObjectSummary> {
    const obj = await ops.createThread(this.ctx, options, { name: options.name, place: this.placer(placement) });
    this.objects.set(obj.id, obj);
    return userSummary(obj);
  }

  /** Genera moldes con cavidad booleana real mediante `generateMold` del motor. */
  async generateMold(
    objectId: string,
    options: Omit<MoldOptions, 'splitAxis'> & { splitAxis: 'x' | 'y' },
    placement: HeadlessPlacement = 'free'
  ): Promise<{ parts: SceneObjectSummary[]; mode: MoldOptions['mode']; note: string }> {
    const master = this.requireObject(objectId);
    const { parts, change } = await ops.generateMold(this.ctx, master, {
      ...options,
      splitAxis: ua.moldSplitAxisFromUser(options.splitAxis),
      pourSpoutRadiusMm: options.pourSpoutRadiusMm ?? OPERATION_DEFAULTS.mold.pourSpoutRadiusMm,
    });
    if (parts.length === 0) {
      throw new Error('The engine did not generate mold parts for this object.');
    }
    const placed = placement === 'origin' ? parts : this.spread(parts, change.removedIds);
    this.apply({ ...change, added: placed });
    return { parts: placed.map(userSummary), mode: options.mode, note: ENGINE_NOTE };
  }

  /** Proyecta texto o SVG con `projectGraphicOntoSurface` del motor (modifica el objeto). */
  async projectOnSurface(
    objectId: string,
    options: SurfaceProjectionOptions
  ): Promise<{ object: SceneObjectSummary; mode: SurfaceProjectionOptions['mode']; note: string }> {
    const target = this.requireEditable(objectId);
    if (options.kind === 'svg' && !options.svgContent) {
      throw new Error('kind="svg" requires `svgContent`.');
    }
    this.apply(await ops.projectOnSurface(this.ctx, target, { ...options, axis: ua.projectionAxisFromUser(options.axis) }));
    return { object: userSummary(target), mode: options.mode, note: ENGINE_NOTE };
  }

  /** Decima la malla con `simplifyMesh` del motor (Manifold `simplify`). */
  async simplifyMesh(
    objectId: string,
    toleranceMm: number
  ): Promise<{ object: SceneObjectSummary; toleranceMm: number; trianglesBefore: number }> {
    const obj = this.requireEditable(objectId);
    const trianglesBefore = obj.stats.triangles;
    this.apply(await ops.simplifyObject(this.ctx, obj, toleranceMm));
    return { object: userSummary(obj), toleranceMm, trianglesBefore };
  }

  /** Refina (y suaviza opcionalmente) con `refineMesh` del motor. */
  async refineMesh(
    objectId: string,
    targetEdgeLengthMm: number,
    smooth: boolean
  ): Promise<{ object: SceneObjectSummary; targetEdgeLengthMm: number; smooth: boolean }> {
    const obj = this.requireEditable(objectId);
    this.apply(await ops.refineObject(this.ctx, obj, targetEdgeLengthMm, smooth));
    return { object: userSummary(obj), targetEdgeLengthMm, smooth };
  }

  /** Calcula la envolvente convexa real con `computeConvexHull` del motor. */
  async convexHull(
    objectIds: string[],
    name?: string
  ): Promise<{ object: SceneObjectSummary; sourceObjectIds: string[] }> {
    if (objectIds.length === 0) {
      throw new Error('At least one object is required in `objectIds` to generate the hull.');
    }
    const targets = objectIds.map((id) => this.requireObject(id));
    const { result, change } = await ops.convexHull(this.ctx, targets, name);
    this.apply(change);
    return { object: userSummary(result), sourceObjectIds: objectIds };
  }

  /** Detecta sub-estructuras con `detectStructuralRegions` del motor (medidas y centros del usuario). */
  async detectStructures(
    objectId: string,
    options: SegmentationOptions = {}
  ): Promise<StructuralSegmentationResult> {
    return ua.userSegmentation(await this.segment(objectId, options));
  }

  /** Segmentación en ejes internos (la que consumen colorear y extraer). */
  private segment(objectId: string, options: SegmentationOptions = {}): Promise<StructuralSegmentationResult> {
    return engine.detectStructuralRegions(this.requireObject(objectId), stripUndefined(options));
  }

  /** Colorea por cara cada sub-estructura detectada (`applyStructureColorsToMesh`). */
  async colorizeStructures(
    objectId: string,
    options: { creaseAngleDeg?: number } = {}
  ): Promise<{ object: SceneObjectSummary; regions: DetectedStructureRegion[]; regionCount: number }> {
    const obj = this.requireEditable(objectId);
    const segmentation = await this.segment(objectId, options);
    if (segmentation.regions.length === 0) {
      throw new Error('No sub-structures were detected to color on the object.');
    }
    this.apply(ops.colorizeStructures(this.ctx, obj, segmentation));
    return { object: userSummary(obj), regions: ua.userSegmentation(segmentation).regions, regionCount: segmentation.regions.length };
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
    const segmentation = await this.segment(objectId);
    const region = segmentation.regions.find((r) => r.id === regionId);
    if (!region) {
      const available = segmentation.regions.map((r) => r.id).join(', ') || 'none';
      throw new Error(
        `Structural region '${regionId}' not found on object '${objectId}'. Available: ${available}`
      );
    }

    const { extracted, sourceDeleted, change } = await ops.extractStructure(
      this.ctx, obj, segmentation, region, removeFromSource, { isHole: obj.isHole },
    );
    this.apply(change);
    return {
      extractedObject: userSummary(extracted),
      sourceObjectId: obj.id,
      removedFromSource: removeFromSource,
      sourceDeleted,
      region: ua.structureRegionToUser(region),
    };
  }

  /** Refleja la malla en un eje con `mirrorMeshAxis` del motor (winding corregido). */
  mirrorObject(objectId: string, axis: 'x' | 'y' | 'z'): SceneObjectSummary {
    const obj = this.requireEditable(objectId);
    this.apply(ops.mirrorObject(this.ctx, obj, ua.axisFromUser(axis)));
    return userSummary(obj);
  }

  /** Exporta los objetos indicados (o la escena visible) a STL binario o ASCII. */
  async exportStl(input: { outputPath: string; objectIds?: string[]; binary?: boolean }): Promise<ExportFileResult> {
    return writeStlFile(input.outputPath, this.resolveExportTargets(input.objectIds), input.binary ?? true);
  }

  /** Exporta un único 3MF estándar con materiales y colores por triángulo (`exportSceneTo3MF`), como la app. */
  async export3mf(input: { outputPath: string; objectIds?: string[] }): Promise<ExportFileResult> {
    return write3mfFile(input.outputPath, this.resolveExportTargets(input.objectIds), this.units);
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
    } else throw new Error(`Object '${obj.name}' is no longer parametric: an operation changed its mesh.`);
    this.apply(await ops.regenerateParametric(this.ctx, obj, edit));
    return userSummary(this.requireObject(objectId));
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
      throw new Error(`Object not found in headless scene: '${id}'.`);
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
