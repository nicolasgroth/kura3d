/**
 * @file mcp-server/src/headlessEngine.ts
 * @description Capa delgada de estado de escena para el modo Headless del servidor MCP de Kura3D.
 * Mantiene objetos, unidades y perfil de impresora en memoria y delega TODA la geometría en el
 * mismo motor de la app (`src/engine`, Manifold WASM): primitivas, CSG, corte, ahuecado, moldes,
 * roscas, proyección, simplificación, segmentación y exportación STL/3MF. No reimplementa
 * algoritmos; si una operación no puede correr en Node responde con error explícito.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../src/engine/index';
import { write3mfFile, writeStlFile, type ExportFileResult } from './headlessExport.js';
import {
  assertUnlocked,
  buildSceneObject,
  makeObjectId,
  replaceMesh,
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

/** Separación fija entre piezas que usa `computeAlignmentPositions` del motor en `arrange_grid`. */
export const ENGINE_GRID_SPACING_MM = 8;

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

  /** Crea una primitiva paramétrica con `createPrimitiveMesh` del motor, apoyada en la cama. */
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
  }): Promise<SceneObjectSummary> {
    const params: PrimitiveParams = input.params ?? {};
    const mesh = engine.normalizeMeshToBed(await engine.createPrimitiveMesh(input.primitiveType, params));
    const obj = this.add({
      name: input.name ?? `${capitalize(input.primitiveType)} ${this.counter + 1}`,
      source: 'primitive',
      mesh,
      position: input.position,
      rotation: input.rotation,
      scale: input.scale,
      color: input.color ?? '#38bdf8',
      materialPreset: input.materialPreset,
      isHole: input.isHole,
      primitiveType: input.primitiveType,
      primitiveParams: params,
    });
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
    replaceMesh(obj, await engine.hollowMesh(obj, hollow));
    obj.hollow = hollow;
    return summarizeObject(obj);
  }

  /** Booleana CSG exacta encadenando `runBooleanOperation` del motor sobre cada herramienta. */
  async booleanOperation(input: {
    targetId: string;
    toolIds: string[];
    operation: BooleanOpType;
    keepTools?: boolean;
    resultName?: string;
  }): Promise<{ object: SceneObjectSummary; resultId: string; consumedIds: string[]; note: string }> {
    const target = this.requireEditable(input.targetId);
    if (input.toolIds.length === 0) {
      throw new Error('Se requiere al menos un objeto herramienta en `toolIds`.');
    }
    const tools = input.toolIds.map((id) => this.requireEditable(id));
    if (tools.some((t) => t.id === target.id)) {
      throw new Error('El objeto objetivo no puede ser también herramienta de la operación booleana.');
    }

    let current: HeadlessSceneObject = target;
    for (const tool of tools) {
      const res = await engine.runBooleanOperation(current, tool, input.operation);
      current = buildSceneObject({
        id: 'pending',
        name: input.resultName ?? `${target.name} (${input.operation})`,
        source: 'boolean',
        mesh: res.mesh,
        position: res.position,
        color: target.color,
        materialPreset: target.materialPreset,
      });
    }

    const consumedIds = input.keepTools ? [] : [target.id, ...tools.map((t) => t.id)];
    for (const id of consumedIds) this.objects.delete(id);
    current.id = makeObjectId(++this.counter);
    this.objects.set(current.id, current);
    return { object: summarizeObject(current), resultId: current.id, consumedIds, note: ENGINE_NOTE };
  }

  /** Corta por plano con `planeCutWithConnectors` del motor (conectores reales incluidos). */
  async planeCut(
    objectId: string,
    options: PlaneCutOptions
  ): Promise<{ parts: SceneObjectSummary[]; note: string; warnings: engine.EngineWarning[] }> {
    const obj = this.requireEditable(objectId);
    const result = await engine.planeCutWithConnectors(obj, options);
    const halves = [
      { part: result.positive, suffix: 'mitad A' },
      { part: result.negative, suffix: 'mitad B' },
    ].filter((h) => h.part !== null);
    if (halves.length === 0) {
      throw new Error('El plano de corte no intersecta el objeto: no se generaron piezas.');
    }

    this.objects.delete(obj.id);
    const parts = halves.map(({ part, suffix }) =>
      summarizeObject(
        this.add({
          name: `${obj.name} — ${suffix}`,
          source: 'cut_part',
          mesh: part!.mesh,
          position: part!.position,
          color: obj.color,
          materialPreset: obj.materialPreset,
        })
      )
    );
    return { parts, note: ENGINE_NOTE, warnings: [...(result.warnings ?? [])] };
  }

  /** Separa islas desconectadas con `splitDisconnectedParts` del motor. */
  async splitDisconnected(objectId: string): Promise<{ parts: SceneObjectSummary[]; note: string }> {
    const obj = this.requireEditable(objectId);
    const pieces = await engine.splitDisconnectedParts(obj);
    if (pieces.length <= 1) {
      return { parts: [summarizeObject(obj)], note: 'El objeto es un único cuerpo conexo; no hay nada que separar.' };
    }
    this.objects.delete(obj.id);
    const parts = pieces.map((piece, idx) =>
      summarizeObject(
        this.add({
          name: `${obj.name} #${idx + 1}`,
          source: 'cut_part',
          mesh: piece.mesh,
          position: piece.position,
          color: obj.color,
          materialPreset: obj.materialPreset,
        })
      )
    );
    return { parts, note: ENGINE_NOTE };
  }

  /** Separa por color de cara con `splitMeshByColor` del motor. */
  splitByColor(objectId: string): {
    parts: SceneObjectSummary[];
    note: string;
    warnings?: Array<{ code: string; message: string }>;
  } {
    const obj = this.requireEditable(objectId);
    const { parts: pieces, warnings } = engine.splitMeshByColorDetailed(obj);
    if (pieces.length <= 1) {
      return { parts: [summarizeObject(obj)], note: 'El objeto tiene un solo color; no hay nada que separar.' };
    }
    this.objects.delete(obj.id);
    const parts = pieces.map((piece, idx) =>
      summarizeObject(
        this.add({
          name: `${obj.name} (${piece.color}) #${idx + 1}`,
          source: 'color_split',
          mesh: piece.mesh,
          position: piece.position,
          color: piece.color,
          materialPreset: obj.materialPreset,
        })
      )
    );
    if (warnings.length === 0) return { parts, note: ENGINE_NOTE };
    return {
      parts,
      note: ENGINE_NOTE,
      warnings: warnings.map((w) => ({ code: w.code, message: engine.localizeEngineWarning('es', w) })),
    };
  }

  /** Desplaza la superficie con `applyProceduralTexture` del motor. */
  applyTexture(objectId: string, texture: TextureOptions): SceneObjectSummary {
    const obj = this.requireEditable(objectId);
    replaceMesh(obj, engine.applyProceduralTexture(obj.mesh, texture));
    obj.texture = { ...texture };
    return summarizeObject(obj);
  }

  /** Pinta el objeto completo (`paintEntireMesh`): color base y color por cara para 3MF. */
  paintObject(objectId: string, color: string): SceneObjectSummary {
    const obj = this.requireEditable(objectId);
    replaceMesh(obj, engine.paintEntireMesh(obj.mesh, color));
    obj.color = color;
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
  }): Promise<SceneObjectSummary> {
    const name = input.name ?? 'SVG_Extruded';
    const mesh = await engine.extrudeSvgToMesh({
      svgContent: input.svgContent,
      name,
      depth: input.depth ?? 4,
      targetWidth: input.targetWidth ?? 50,
      curveSegments: input.curveSegments ?? 16,
    });
    const obj = this.add({ name, source: 'svg', mesh: engine.normalizeMeshToBed(mesh), color: '#f97316' });
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
    const infillPercent = options.infillPercent ?? 20;
    const report = engine.analyzePrintability(
      obj,
      this.printerProfile,
      materialPreset,
      infillPercent,
      options.overhangAngleDeg ?? 45
    );
    const world = engine.applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
    const { overhangFaceIndices: _omitted, ...rest } = report;
    return {
      ...rest,
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
    // Los bloqueados no se mueven (misma regla que el store).
    const targets = objectIds.map((id) => this.requireObject(id)).filter((o) => !o.locked);
    const positions = engine.computeAlignmentPositions(targets, mode, this.printerProfile);
    for (const obj of targets) {
      if (positions[obj.id]) obj.position = [...positions[obj.id]];
    }
    return {
      mode,
      ...(mode === 'arrange_grid' ? { spacingMm: ENGINE_GRID_SPACING_MM } : {}),
      objects: targets.map(summarizeObject),
    };
  }

  /** Genera una rosca métrica ISO helicoidal real con `createMetricThread` del motor. */
  async createThread(options: ThreadOptions): Promise<SceneObjectSummary> {
    const mesh = engine.normalizeMeshToBed(await engine.createMetricThread(options));
    const isHole = options.kind === 'hole';
    const kindLabel = options.kind === 'bolt' ? 'Perno' : options.kind === 'nut' ? 'Tuerca' : 'Cavidad';
    const obj = this.add({
      name: options.name ?? `${kindLabel} M${options.diameterMm}x${options.pitchMm}`,
      source: 'thread',
      mesh,
      color: isHole ? '#f97316' : '#94a3b8',
      materialPreset: isHole ? 'pla_matte' : 'metallic',
      isHole,
    });
    return summarizeObject(obj);
  }

  /** Genera moldes con cavidad booleana real mediante `generateMold` del motor. */
  async generateMold(
    objectId: string,
    options: MoldOptions
  ): Promise<{ parts: SceneObjectSummary[]; mode: MoldOptions['mode']; note: string }> {
    const master = this.requireObject(objectId);
    const generated = await engine.generateMold(master, {
      ...options,
      pourSpoutRadiusMm: options.pourSpoutRadiusMm ?? 5,
    });
    if (generated.length === 0) {
      throw new Error('El motor no generó piezas de molde para este objeto.');
    }
    const parts = generated.map((part) =>
      summarizeObject(
        this.add({
          name: `${part.nameSuffix} — ${master.name}`,
          source: 'mold',
          mesh: part.mesh,
          position: part.position,
          color: part.color,
          materialPreset: part.materialPreset,
        })
      )
    );
    return { parts, mode: options.mode, note: ENGINE_NOTE };
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
    const res = await engine.projectGraphicOntoSurface(target, options);
    replaceMesh(target, res.mesh, res.position);
    target.rotation = [0, 0, 0];
    target.scale = [1, 1, 1];
    target.stats = worldStatsOf(target);
    target.source = 'projected';
    return { object: summarizeObject(target), mode: options.mode, note: ENGINE_NOTE };
  }

  /** Decima la malla con `simplifyMesh` del motor (Manifold `simplify`). */
  async simplifyMesh(
    objectId: string,
    toleranceMm: number
  ): Promise<{ object: SceneObjectSummary; toleranceMm: number; trianglesBefore: number }> {
    const obj = this.requireEditable(objectId);
    const trianglesBefore = obj.stats.triangles;
    replaceMesh(obj, await engine.simplifyMesh(obj, toleranceMm));
    return { object: summarizeObject(obj), toleranceMm, trianglesBefore };
  }

  /** Refina (y suaviza opcionalmente) con `refineMesh` del motor. */
  async refineMesh(
    objectId: string,
    targetEdgeLengthMm: number,
    smooth: boolean
  ): Promise<{ object: SceneObjectSummary; targetEdgeLengthMm: number; smooth: boolean }> {
    const obj = this.requireEditable(objectId);
    replaceMesh(obj, await engine.refineMesh(obj, targetEdgeLengthMm, smooth));
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
    const res = await engine.computeConvexHull(targets);
    const obj = this.add({
      name: name ?? `ConvexHull_${this.counter + 1}`,
      source: 'hull',
      mesh: res.mesh,
      position: res.position,
      color: targets[0].color,
      materialPreset: targets[0].materialPreset,
    });
    return { object: summarizeObject(obj), sourceObjectIds: objectIds };
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
    replaceMesh(obj, engine.applyStructureColorsToMesh(obj.mesh, segmentation));
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

    const res = await engine.extractStructuralRegion(obj, region, removeFromSource);
    const extracted = this.add({
      name: `${obj.name}_${region.labelEn}`,
      source: 'segmented_part',
      mesh: res.extracted.mesh,
      position: res.extracted.position,
      color: region.color,
      materialPreset: obj.materialPreset,
      isHole: obj.isHole,
    });

    let sourceDeleted = false;
    if (removeFromSource) {
      if (res.remainder) {
        // El remanente viene en espacio mundial: la transformación del origen ya está aplicada
        obj.rotation = [0, 0, 0];
        obj.scale = [1, 1, 1];
        replaceMesh(obj, res.remainder.mesh, res.remainder.position);
      } else {
        this.objects.delete(obj.id);
        sourceDeleted = true;
      }
    }

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
    replaceMesh(obj, engine.mirrorMeshAxis(obj.mesh, axis));
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

  private add(params: Omit<BuildObjectParams, 'id'>): HeadlessSceneObject {
    const obj = buildSceneObject({ ...params, id: makeObjectId(++this.counter) });
    this.objects.set(obj.id, obj);
    return obj;
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

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

/** Quita claves `undefined` para que el motor aplique sus valores por defecto. */
function stripUndefined<T extends object>(value: T): Partial<{ [K in keyof T]: Exclude<T[K], undefined> }> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<{
    [K in keyof T]: Exclude<T[K], undefined>;
  }>;
}
