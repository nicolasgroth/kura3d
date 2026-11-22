/**
 * @file src/store/commandSchemas.ts
 * @description Validación por comando del Command Bus (UI, IA y MCP). Cada función convierte los
 * parámetros crudos en opciones tipadas: tipos estrictos, vectores 3D finitos, rangos, enumeraciones
 * e IDs existentes. Los defaults solo cubren opciones ausentes e inocuas; nunca el objeto objetivo.
 * Funciones puras sobre una vista de la escena: no tocan el store.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import {
  DEFAULT_PRINTER_PROFILES,
  MATERIAL_PRESETS,
  type AlignMode,
  type BooleanOpType,
  type MaterialPresetId,
  type MoldOptions,
  type PlaneCutOptions,
  type PrimitiveParams,
  type PrimitiveType,
  type SceneObject,
  type SurfaceProjectionOptions,
  type TextureOptions,
  type ThreadOptions,
  type UnitSystem,
  type Vec3,
} from '../types/kura';
import {
  PRIMITIVE_LIMITS, PRIMITIVE_PARAM_RANGES, TEXT_ALIGN_OPTIONS, primitiveRangeFor, type PrimitiveRangeKey,
} from '../engine/primitiveLimits';
import { OPERATION_DEFAULTS, OPERATION_RANGES as OR } from '../engine/operationLimits';
import { CommandError } from './commandErrors';

const CUT_DEFAULTS = OPERATION_DEFAULTS.cut;
import {
  findObject, resolveIdsOrSelection, resolveObjects, resolveTarget, selectedObjects, type SceneView,
} from './commandTargets';
import {
  nonNegative, pick, readBoolean, readColor, readEnum, readId, readIds, readNumber, readRange,
  readScale, readString, readVec3, type RawParams,
} from './commandValidation';

const NAME_MAX = 200;
const TEXT_MAX = 500;
const SVG_MAX = 5_000_000;
const AXES = ['x', 'y', 'z'] as const;
const PRIMITIVES: readonly PrimitiveType[] = ['box', 'cylinder', 'tube', 'sphere', 'cone', 'torus', 'prism', 'text'];
const MATERIALS = Object.keys(MATERIAL_PRESETS) as MaterialPresetId[];
const BOOLEAN_OPS: readonly BooleanOpType[] = ['union', 'subtract', 'intersect'];
const UNITS: readonly UnitSystem[] = ['mm', 'cm', 'm', 'in', 'ft'];
const ALIGN_MODES: readonly AlignMode[] = [
  'minX', 'centerX', 'maxX', 'minY', 'centerY', 'maxY', 'minZ', 'centerZ', 'maxZ', 'arrange_grid',
];

function missing(param: string, expected: string): CommandError {
  return new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });
}

function isPlainObject(value: unknown): value is RawParams {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

// ---------------------------------------------------------------- creación

export interface CreatePrimitiveInput {
  type: PrimitiveType;
  params: PrimitiveParams;
  name?: string;
  color?: string;
  position?: Vec3;
  /** Ejes del usuario: grados (Euler XYZ) y factores por eje. */
  rotation?: Vec3;
  scale?: Vec3;
  isHole?: boolean;
  materialPreset?: MaterialPresetId;
  placement: 'free' | 'origin';
}

/** Lee los parámetros de una primitiva con los rangos del motor (`primitiveLimits`) para `type`. */
export function readPrimitiveParams(raw: RawParams, type: PrimitiveType): PrimitiveParams {
  const out: PrimitiveParams = {};
  const set = <K extends keyof PrimitiveParams>(key: K, value: PrimitiveParams[K] | undefined) => {
    if (value !== undefined) out[key] = value;
  };
  for (const key of Object.keys(PRIMITIVE_PARAM_RANGES) as PrimitiveRangeKey[]) {
    set(key, readNumber(raw, primitiveRangeFor(type, key), key));
  }
  set('text', readString(raw, PRIMITIVE_LIMITS.maxTextLength, 'text'));
  set('textAlign', readEnum(raw, TEXT_ALIGN_OPTIONS, 'textAlign'));
  return out;
}

export function parseCreatePrimitive(p: RawParams): CreatePrimitiveInput {
  const nested = pick(p, 'params');
  if (nested && !isPlainObject(nested[1])) throw missing('params', 'object');
  const type = readEnum(p, PRIMITIVES, 'type', 'primitiveType') ?? 'box';
  return {
    type,
    // Los parámetros planos tienen prioridad sobre el objeto anidado `params`.
    params: { ...(nested ? readPrimitiveParams(nested[1] as RawParams, type) : {}), ...readPrimitiveParams(p, type) },
    name: readString(p, NAME_MAX, 'name'),
    color: readColor(p, 'color'),
    position: readVec3(p, 'position'),
    // Giro (grados) y escala en ejes del usuario (Z = altura), como `transform_object` y el modo sin interfaz.
    rotation: readVec3(p, 'rotation'),
    scale: readScale(p, 'scale'),
    isHole: readBoolean(p, 'isHole'),
    materialPreset: readEnum(p, MATERIALS, 'materialPreset'),
    // Por defecto 'origin' (comportamiento previo del bus); 'free' busca el primer hueco libre.
    placement: readEnum(p, ['free', 'origin'] as const, 'placement') ?? 'origin',
  };
}

export function parseThread(p: RawParams): ThreadOptions {
  return {
    kind: readEnum(p, ['bolt', 'nut', 'hole'] as const, 'kind') ?? 'bolt',
    diameterMm: readRange(p, OR.thread.diameterMm, 'diameterMm') ?? 8,
    pitchMm: readRange(p, OR.thread.pitchMm, 'pitchMm') ?? 1.25,
    lengthMm: readRange(p, OR.thread.lengthMm, 'lengthMm') ?? 20,
    clearanceMm: readRange(p, OR.thread.clearanceMm, 'clearanceMm'),
    includeHead: readBoolean(p, 'includeHead') ?? true,
  };
}

export interface SvgImportInput {
  svgContent: string;
  name: string;
  depth: number;
  targetWidth: number;
  curveSegments: number;
}

export function parseImportSvg(p: RawParams): SvgImportInput {
  const svgContent = readString(p, SVG_MAX, 'svgContent') ?? '';
  if (!svgContent.trim()) throw new CommandError('invalid-params', 'bus.error.missingSvg');
  return {
    svgContent,
    name: readString(p, NAME_MAX, 'name') ?? 'SVG',
    depth: readRange(p, OR.svg.depth, 'depth') ?? 6,
    targetWidth: readRange(p, OR.svg.targetWidth, 'targetWidth') ?? 60,
    curveSegments: readRange(p, OR.svg.curveSegments, 'curveSegments') ?? 12,
  };
}

// ---------------------------------------------------------------- escena

export interface TransformInput {
  target: SceneObject;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  dropToBed: boolean;
  centerOnBed: boolean;
}

export function parseTransform(scene: SceneView, p: RawParams): TransformInput {
  const input: TransformInput = {
    target: resolveTarget(scene, p, { unlocked: true }),
    position: readVec3(p, 'position'),
    rotation: readVec3(p, 'rotation'),
    scale: readScale(p, 'scale'),
    dropToBed: readBoolean(p, 'dropToBed') ?? false,
    centerOnBed: readBoolean(p, 'centerOnBed') ?? false,
  };
  if (!input.position && !input.rotation && !input.scale && !input.dropToBed && !input.centerOnBed) {
    throw missing('position | rotation | scale | dropToBed | centerOnBed', 'at least one');
  }
  return input;
}

/** Borrar exige IDs explícitos o un único objeto seleccionado: nunca una selección múltiple implícita. */
export function parseDelete(scene: SceneView, p: RawParams): SceneObject[] {
  const ids = readIds(p, 'ids', 'objectIds');
  const targets = ids ? resolveObjects(scene, ids) : [resolveTarget(scene, p)];
  const removable = targets.filter((o) => !o.locked);
  if (removable.length === 0) throw new CommandError('locked', 'bus.error.locked', { name: targets[0].name });
  return removable;
}

export function parseDuplicate(scene: SceneView, p: RawParams): SceneObject[] {
  const id = readId(p, 'id', 'objectId');
  return id ? [findObject(scene, id)] : resolveIdsOrSelection(scene, p);
}

export interface BooleanInput {
  op: BooleanOpType;
  target: SceneObject;
  tools: SceneObject[];
}

export function parseBoolean(scene: SceneView, p: RawParams): BooleanInput {
  const op = readEnum(p, BOOLEAN_OPS, 'op', 'operation');
  if (!op) throw missing('op', BOOLEAN_OPS.join(' | '));
  const targetId = readId(p, 'targetId', 'id', 'objectId');
  const toolIds = readIds(p, 'toolIds') ?? (readId(p, 'toolId') ? [readId(p, 'toolId')!] : undefined);
  let objects: SceneObject[];
  if (targetId || toolIds) {
    if (!targetId) throw missing('targetId', 'id');
    if (!toolIds) throw missing('toolId | toolIds', 'id');
    objects = resolveObjects(scene, [targetId, ...toolIds], true);
  } else {
    objects = resolveObjects(scene, selectedObjects(scene).map((o) => o.id), true);
  }
  if (objects.length < 2 || new Set(objects.map((o) => o.id)).size !== objects.length) {
    throw new CommandError('precondition', 'bus.error.booleanNeedsTwo');
  }
  return { op, target: objects[0], tools: objects.slice(1) };
}

export function parseUnit(p: RawParams): UnitSystem {
  const unit = readEnum(p, UNITS, 'unit', 'unitSystem', 'units');
  if (!unit) throw missing('unit', UNITS.join(' | '));
  return unit;
}

export function parsePrinterProfile(p: RawParams): string {
  const profileId = readString(p, NAME_MAX, 'profileId');
  if (!profileId) throw missing('profileId', 'string');
  if (!DEFAULT_PRINTER_PROFILES.some((profile) => profile.id === profileId)) {
    throw new CommandError('not-found', 'bus.error.unknownProfile', { id: profileId });
  }
  return profileId;
}

export function parseMaterial(scene: SceneView, p: RawParams): { target: SceneObject; materialPreset: MaterialPresetId } {
  const materialPreset = readEnum(p, MATERIALS, 'materialPreset', 'material');
  if (!materialPreset) throw missing('materialPreset', MATERIALS.join(' | '));
  return { target: resolveTarget(scene, p, { unlocked: true }), materialPreset };
}

export function parseAlign(scene: SceneView, p: RawParams): { mode: AlignMode; objects?: SceneObject[] } {
  const ids = readIds(p, 'objectIds', 'ids');
  return {
    mode: readEnum(p, ALIGN_MODES, 'mode') ?? 'arrange_grid',
    objects: ids ? resolveObjects(scene, ids) : undefined,
  };
}

export interface ExportInput {
  onlySelected: boolean;
  wantsBytes: boolean;
}

/** `slicerTarget` (obsoleto) se acepta en `p` pero se ignora: hay un único 3MF estándar. */
export function parseExport(p: RawParams): ExportInput {
  return {
    onlySelected: readBoolean(p, 'onlySelected') ?? false,
    wantsBytes: Boolean(readBoolean(p, 'returnBytes')) || Boolean(readString(p, 4096, 'outputPath')),
  };
}

// ---------------------------------------------------------------- mallas

/** Objetivo único modificable (separar partes, separar por color). */
export function parseEditableTarget(scene: SceneView, p: RawParams): SceneObject {
  return resolveTarget(scene, p, { unlocked: true });
}

export function parseHollow(scene: SceneView, p: RawParams) {
  return {
    target: resolveTarget(scene, p, { unlocked: true }),
    wallThickness: readRange(p, OR.hollow.wallThickness, 'wallThickness') ?? 2,
    drainHole: readBoolean(p, 'drainHole') ?? false,
    drainHoleRadius: readRange(p, OR.hollow.drainHoleRadius, 'drainHoleRadius') ?? 4,
  };
}

export function parsePlaneCut(scene: SceneView, p: RawParams): { target: SceneObject; options: PlaneCutOptions } {
  return {
    target: resolveTarget(scene, p, { unlocked: true }),
    options: {
      // Ejes del usuario (Z = altura): el bus convierte a internos con `planeFromUser`.
      axis: readEnum(p, AXES, 'axis') ?? 'z',
      offset: readRange(p, OR.cut.offset, 'offset') ?? 0,
      // Valores por defecto de la fuente única (`OPERATION_DEFAULTS.cut`), los mismos del MCP.
      connectorType: readEnum(p, ['none', 'dowel', 'peg', 'dovetail'] as const, 'connectorType') ?? CUT_DEFAULTS.connectorType,
      connectorSize: readRange(p, OR.cut.connectorSize, 'connectorSize') ?? CUT_DEFAULTS.connectorSize,
      connectorDepth: readRange(p, OR.cut.connectorDepth, 'connectorDepth') ?? CUT_DEFAULTS.connectorDepth,
      tolerance: readRange(p, OR.cut.tolerance, 'tolerance') ?? CUT_DEFAULTS.tolerance,
      connectorCount: readRange(p, OR.cut.connectorCount, 'connectorCount') ?? CUT_DEFAULTS.connectorCount,
      keepMode: readEnum(p, ['both', 'positive', 'negative'] as const, 'keepMode') ?? 'both',
    },
  };
}

export function parseTexture(scene: SceneView, p: RawParams): { target: SceneObject; options: TextureOptions } {
  return {
    target: resolveTarget(scene, p, { unlocked: true }),
    options: {
      pattern: readEnum(p, ['none', 'fuzzy', 'knurling', 'waves', 'honeycomb', 'grid'] as const, 'pattern') ?? 'fuzzy',
      depth: readRange(p, OR.texture.depth, 'depth') ?? 0.4,
      scale: readRange(p, OR.texture.scale, 'scale') ?? 4,
    },
  };
}

export function parsePaint(scene: SceneView, p: RawParams) {
  return {
    target: resolveTarget(scene, p, { unlocked: true }),
    color: readColor(p, 'color'),
    localPoint: readVec3(p, 'localPoint'),
  };
}

export function parseMold(scene: SceneView, p: RawParams): { target: SceneObject; options: MoldOptions } {
  return {
    target: resolveTarget(scene, p),
    options: {
      mode: readEnum(p, ['direct_1part', 'direct_2part', 'silicone_master', 'core_cavity'] as const, 'mode') ?? 'silicone_master',
      wallMarginMm: readRange(p, OR.mold.wallMarginMm, 'wallMarginMm') ?? 6,
      boxWallMm: readRange(p, OR.mold.boxWallMm, 'boxWallMm') ?? 3,
      // Eje de partición horizontal en ejes del usuario ('x' | 'y'); se devuelve en ejes internos.
      splitAxis: readEnum(p, ['x', 'y'] as const, 'splitAxis') === 'y' ? 'z' : 'x',
      pourSpout: readBoolean(p, 'pourSpout') ?? true,
      pourSpoutRadiusMm: readRange(p, OR.mold.pourSpoutRadiusMm, 'pourSpoutRadiusMm') ?? 5,
      keyToleranceMm: readRange(p, OR.mold.keyToleranceMm, 'keyToleranceMm') ?? 0.25,
      cavityWallMm: readRange(p, OR.mold.cavityWallMm, 'cavityWallMm') ?? 3,
    },
  };
}

export function parseProjection(
  scene: SceneView,
  p: RawParams,
): { target: SceneObject; options: SurfaceProjectionOptions } {
  return {
    target: resolveTarget(scene, p, { unlocked: true }),
    options: {
      kind: readEnum(p, ['text', 'svg'] as const, 'kind') ?? 'text',
      text: readString(p, TEXT_MAX, 'text') ?? 'KURA3D',
      svgContent: readString(p, SVG_MAX, 'svgContent'),
      mode: readEnum(p, ['emboss', 'deboss', 'flush_inlay'] as const, 'mode') ?? 'emboss',
      // Dirección en ejes del usuario ('+z' = arriba); el bus la convierte. Por defecto, la cara frontal.
      axis: readEnum(p, ['+z', '-z', '+x', '-x', '+y', '-y', 'cylindrical'] as const, 'axis') ?? '-y',
      widthMm: readRange(p, OR.projection.widthMm, 'widthMm') ?? 18,
      depthMm: readRange(p, OR.projection.depthMm, 'depthMm') ?? 1.2,
      colorHex: readColor(p, 'colorHex') ?? '#f97316',
      offsetU: readRange(p, OR.projection.offsetU, 'offsetU') ?? 0,
      offsetV: readRange(p, OR.projection.offsetV, 'offsetV') ?? 0,
    },
  };
}

export function parsePrintability(scene: SceneView, p: RawParams) {
  return {
    target: resolveTarget(scene, p),
    infillPercent: readRange(p, OR.printability.infillPercent, 'infillPercent') ?? OPERATION_DEFAULTS.printability.infillPercent,
    overhangAngleDeg: readRange(p, OR.printability.overhangAngleDeg, 'overhangAngleDeg') ?? OPERATION_DEFAULTS.printability.overhangAngleDeg,
  };
}

export function parseSimplify(scene: SceneView, p: RawParams) {
  return {
    target: resolveTarget(scene, p, { unlocked: true }),
    toleranceMm: readRange(p, OR.simplify.toleranceMm, 'toleranceMm') ?? 0.15,
  };
}

/** `split_by_color`: objeto editable y profundidad opcional del color (mm). */
export function parseSplitByColor(scene: SceneView, p: RawParams) {
  return {
    target: resolveTarget(scene, p, { unlocked: true }),
    depthMm: readRange(p, OR.colorSplit.depthMm, 'depthMm'),
  };
}

export function parseRefine(scene: SceneView, p: RawParams) {
  return {
    target: resolveTarget(scene, p, { unlocked: true }),
    targetEdgeLengthMm: readRange(p, OR.refine.targetEdgeLengthMm, 'targetEdgeLengthMm') ?? 1.5,
    smooth: readBoolean(p, 'smooth') ?? false,
  };
}

export function parseHull(scene: SceneView, p: RawParams): SceneObject[] {
  return resolveIdsOrSelection(scene, p);
}

export function parseMirror(scene: SceneView, p: RawParams) {
  return {
    target: resolveTarget(scene, p, { unlocked: true }),
    axis: readEnum(p, AXES, 'axis') ?? 'x',
  };
}

export function parseDetect(scene: SceneView, p: RawParams) {
  return {
    target: resolveTarget(scene, p),
    creaseAngleDeg: readRange(p, OR.detect.creaseAngleDeg, 'creaseAngleDeg'),
  };
}

export function parseColorize(scene: SceneView, p: RawParams, activeObjectId?: string): SceneObject {
  return resolveTarget(scene, p, { unlocked: true, fallbackId: activeObjectId });
}

export function parseExtract(scene: SceneView, p: RawParams) {
  const objectId = readId(p, 'objectId');
  if (objectId) findObject(scene, objectId);
  return {
    objectId,
    regionId: readString(p, NAME_MAX, 'regionId') ?? (typeof p.id === 'string' ? readId(p, 'id') : undefined),
    regionIndex: readNumber(p, { min: 0, max: 100_000, integer: true }, 'regionIndex'),
    removeFromSource: readBoolean(p, 'removeFromSource') ?? false,
  };
}
