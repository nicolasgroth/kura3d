/**
 * @file src/core/operations/creationOperations.ts
 * @description Operaciones puras que crean objetos nuevos: primitivas, módulos (+/−) sobre un
 * objetivo, roscas ISO, SVG extruido y relieves de imagen. Llaman al motor y devuelven el objeto.
 * La generación de malla está separada (`primitiveMesh`, `svgMesh`, `imageReliefMesh`) para que el
 * store la corra en el Worker del motor y luego construya el objeto con la colocación de la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as engine from '../../engine';
import type {
  ImageTo3DOptions,
  MaterialPresetId,
  MeshData,
  PrimitiveParams,
  PrimitiveType,
  SceneObject,
  SvgImportOptions,
  ThreadOptions,
  Vec3,
} from '../../types/kura';
import type { ObjectRole } from '../../types/kura';
import { parametricOrigin, parametricStateOf } from '../scene/parametric';
import { computeLocalMeshCenter, computeObjectWorldCenter } from '../scene/sceneObjects';
import { buildWith, change, meshPatch, type OperationContext, type SceneChange } from './operationTypes';

/** Decide la posición de una malla recién generada (p. ej. el primer hueco libre de la cama). */
export type PlaceMesh = (mesh: MeshData) => Vec3;

/** Color de los objetos hueco (negativos) creados como ayuda. */
export const HOLE_HELPER_COLOR = '#f97316';

/** Crea una primitiva paramétrica apoyada en la cama. */
export async function createPrimitive(
  ctx: OperationContext,
  input: {
    type: PrimitiveType;
    params?: PrimitiveParams;
    name: string;
    color: string;
    position?: Vec3;
    /** Se usa si no hay `position`. */
    place?: PlaceMesh;
    rotation?: Vec3;
    scale?: Vec3;
    role?: ObjectRole;
    materialPreset?: MaterialPresetId;
    /** Malla ya generada con `primitiveMesh` (p. ej. en el Worker); si falta se genera aquí. */
    mesh?: MeshData;
  },
): Promise<SceneObject> {
  const mesh = input.mesh ?? (await primitiveMesh(input.type, input.params));
  return buildWith(ctx, {
    name: input.name,
    source: 'primitive',
    mesh,
    position: input.position ?? input.place?.(mesh),
    rotation: input.rotation,
    scale: input.scale,
    color: input.color,
    materialPreset: input.materialPreset,
    role: input.role,
    primitiveType: input.type,
    primitiveParams: input.params,
    parametric: parametricOrigin('primitive', mesh),
  });
}

/** Malla de una primitiva apoyada en la cama (texto 3D incluido). */
export async function primitiveMesh(type: PrimitiveType, params?: PrimitiveParams): Promise<MeshData> {
  return engine.normalizeMeshToBed(await engine.createPrimitiveMesh(type, params));
}

/** Parámetros de un módulo dimensionado respecto del objetivo (escala incluida). */
export function moduleParamsFor(type: PrimitiveType, target: SceneObject): { params: PrimitiveParams; scaledY: number } {
  const [sx, sy, sz] = [0, 1, 2].map((k) => Math.max(4, target.stats.dimensionsMm[k] * target.scale[k]));
  let params: PrimitiveParams;
  if (type === 'sphere') {
    params = { radius: Math.max(4, Math.min(sx, sy, sz) * 0.65) * 0.5, segments: 28 };
  } else if (type === 'cylinder' || type === 'cone' || type === 'prism') {
    params = { radius: Math.max(4, Math.min(sx, sz) * 0.6) * 0.5, height: Math.max(4, sy * 0.65), segments: 32, sides: 6 };
  } else if (type === 'tube') {
    const outer = Math.max(4, Math.min(sx, sz) * 0.35);
    params = { outerRadius: outer, innerRadius: Math.max(1.5, outer * 0.6), height: Math.max(4, sy * 0.65), segments: 32 };
  } else if (type === 'torus') {
    const outer = Math.max(4, Math.min(sx, sz) * 0.35);
    params = { outerRadius: outer, tubeRadius: Math.max(1.5, outer * 0.3), segments: 28 };
  } else if (type === 'text') {
    params = { text: 'KURA', fontSize: Math.max(6, sx * 0.32), height: Math.max(3, sy * 0.25) };
  } else {
    params = { width: Math.max(4, sx * 0.62), height: Math.max(4, sy * 0.62), depth: Math.max(4, sz * 0.62) };
  }
  return { params, scaledY: sy };
}

/** Posición que centra una malla local sobre el centro mundial del objetivo (Y ≥ 0). */
export function positionOnTarget(target: SceneObject, mesh: MeshData, yOffset = 0): Vec3 {
  const world = computeObjectWorldCenter(target);
  const local = computeLocalMeshCenter(mesh);
  return [world[0] - local[0], Math.max(0, world[1] - local[1] + yOffset), world[2] - local[2]];
}

/** Módulo primitivo positivo (unión) o negativo (hueco) centrado sobre `target`. */
export async function createModulePrimitive(
  ctx: OperationContext,
  type: PrimitiveType,
  mode: 'positive' | 'negative',
  target: SceneObject,
): Promise<SceneObject> {
  const isHole = mode === 'negative';
  const { params, scaledY } = moduleParamsFor(type, target);
  const mesh = engine.normalizeMeshToBed(await engine.createPrimitiveMesh(type, params));
  // En modo positivo se sube un poco para que se una al sólido.
  const position = positionOnTarget(target, mesh, mode === 'positive' ? scaledY * 0.35 : 0);
  return buildWith(ctx, {
    name: `${ctx.naming.modulePrefix(isHole)} ${ctx.naming.primitiveLabel(type)}`,
    source: 'primitive',
    mesh,
    position,
    color: isHole ? HOLE_HELPER_COLOR : target.color,
    materialPreset: target.materialPreset,
    role: isHole ? 'negative' : 'solid',
    primitiveType: type,
    primitiveParams: params,
    parametric: parametricOrigin('primitive', mesh),
  });
}

/** Rosca métrica ISO (perno, tuerca o cavidad). */
export async function createThread(
  ctx: OperationContext,
  options: ThreadOptions,
  placement: { name?: string; position?: Vec3; place?: PlaceMesh } = {},
): Promise<SceneObject> {
  const mesh = engine.normalizeMeshToBed(await engine.createMetricThread(options));
  const isHole = options.kind === 'hole';
  return buildWith(ctx, {
    name: placement.name ?? ctx.naming.thread(options),
    source: 'thread',
    mesh,
    position: placement.position ?? placement.place?.(mesh),
    color: isHole ? HOLE_HELPER_COLOR : '#94a3b8',
    materialPreset: isHole ? 'pla_matte' : 'metallic',
    role: isHole ? 'negative' : 'solid',
    parametric: parametricOrigin('thread', mesh, options),
  });
}

/** Parámetros nuevos para regenerar un objeto paramétrico. */
export type ParametricEdit =
  | { kind: 'primitive'; params: PrimitiveParams }
  | { kind: 'thread'; options: ThreadOptions };

/**
 * Regenera la malla de una primitiva o rosca con parámetros nuevos. Conserva id, nombre,
 * transformación, color, material y banderas; la pintura por caras se pierde (malla nueva).
 * Lanza `INVALID_PARAMETER` si el objeto ya no es paramétrico o el tipo de edición no calza.
 */
export async function regenerateParametric(ctx: OperationContext, obj: SceneObject, edit: ParametricEdit): Promise<SceneChange> {
  const state = parametricStateOf(obj);
  if (state.status === 'primitive' && edit.kind === 'primitive') {
    const params: PrimitiveParams = { ...state.params, ...edit.params };
    const mesh = engine.normalizeMeshToBed(await engine.createPrimitiveMesh(state.type, params));
    return change({
      patches: [{ id: obj.id, patch: { ...meshPatch(ctx, obj, mesh, keepBase(obj, mesh)), primitiveParams: params, parametric: parametricOrigin('primitive', mesh) } }],
    });
  }
  if (state.status === 'thread' && edit.kind === 'thread') {
    const options: ThreadOptions = { ...state.options, ...edit.options };
    const mesh = engine.normalizeMeshToBed(await engine.createMetricThread(options));
    return change({ patches: [{ id: obj.id, patch: { ...meshPatch(ctx, obj, mesh, keepBase(obj, mesh)), parametric: parametricOrigin('thread', mesh, options) } }] });
  }
  throw new engine.EngineError('INVALID_PARAMETER', { name: 'parametric', value: state.status, min: 0, max: 0 });
}

/** Tolerancia (mm) para considerar que un objeto está apoyado en la cama. */
const ON_BED_EPS_MM = 0.01;

/** Y mínima en mundo de `mesh` con la transformación de `obj`. */
function worldMinY(obj: SceneObject, mesh: MeshData): number {
  const world = engine.applyTransformToMesh(mesh, obj.position, obj.rotation, obj.scale);
  let min = Infinity;
  for (let i = 1; i < world.positions.length; i += 3) if (world.positions[i] < min) min = world.positions[i];
  return Number.isFinite(min) ? min : 0;
}

/**
 * Posición que conserva la base tras regenerar: si el objeto estaba apoyado (|minY| < 0,01 mm)
 * vuelve a quedar apoyado; si estaba elevado, su punto más bajo queda a la misma altura. Con
 * rotación, el punto más bajo depende de las medidas nuevas, por eso se recalcula.
 */
function keepBase(obj: SceneObject, mesh: MeshData): { position: Vec3 } | Record<string, never> {
  const before = worldMinY(obj, obj.mesh);
  const target = Math.abs(before) < ON_BED_EPS_MM ? 0 : before;
  const dy = target - worldMinY(obj, mesh);
  if (Math.abs(dy) < 1e-9) return {};
  return { position: [obj.position[0], obj.position[1] + dy, obj.position[2]] };
}

/** Contornos de un SVG empaquetados para el Worker (se leen donde haya `DOMParser`). */
export function readSvgContours(options: SvgImportOptions): engine.PackedSvgContours {
  return engine.packSvgContours(engine.extractSvgElementGroups(options.svgContent, engine.svgCurveSegments(options)));
}

/** Malla extruida de un SVG; con `contours` usa los contornos ya leídos en el hilo principal. */
export async function svgMesh(options: SvgImportOptions, contours?: engine.PackedSvgContours): Promise<MeshData> {
  const groups = contours ? engine.unpackSvgContours(contours) : undefined;
  return engine.normalizeMeshToBed(await engine.extrudeSvgToMesh(options, groups));
}

/** Extruye los contornos de un SVG. `mesh` permite pasar la malla ya generada con `svgMesh`. */
export async function importSvg(
  ctx: OperationContext,
  options: SvgImportOptions,
  look: { name: string; color: string; place?: PlaceMesh },
  generated?: MeshData,
): Promise<SceneObject> {
  const mesh = generated ?? (await svgMesh(options));
  return buildWith(ctx, { name: look.name, source: 'svg', mesh, position: look.place?.(mesh), color: look.color });
}

/** Malla (apoyada en la cama) de un relieve, litofanía cilíndrica, silueta o cortador. */
export function imageReliefMesh(options: ImageTo3DOptions): MeshData | Promise<MeshData> {
  if (options.shapeMode === 'silhouette' || options.shapeMode === 'cutter') {
    return engine.generateSilhouetteOrCutterFromImage(options).then(engine.normalizeMeshToBed);
  }
  const mesh = options.shapeMode === 'cylindrical'
    ? engine.generateCylindricalLithophane(options)
    : engine.generateReliefFromImage(options);
  return engine.normalizeMeshToBed(mesh);
}

/**
 * Relieve, litofanía cilíndrica, silueta o cortador a partir de una imagen. `generated` permite
 * pasar la malla ya calculada con `imageReliefMesh` (p. ej. en el Worker).
 */
export async function imageRelief(
  ctx: OperationContext,
  options: ImageTo3DOptions,
  look: { name: string; color: string; place?: PlaceMesh },
  generated?: MeshData,
): Promise<SceneObject> {
  const normalized = generated ?? (await imageReliefMesh(options));
  return buildWith(ctx, { name: look.name, source: 'image', mesh: normalized, position: look.place?.(normalized), color: look.color, materialPreset: 'pla_matte' });
}
