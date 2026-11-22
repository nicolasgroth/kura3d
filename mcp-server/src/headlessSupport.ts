/**
 * @file mcp-server/src/headlessSupport.ts
 * @description Utilidades de la capa de escena headless del servidor MCP de Kura3D: alias de
 * tipos del motor compartido (`src/engine`), construcción de objetos de escena a partir de
 * resultados del motor, resúmenes serializables y el error explícito "no soportado en headless".
 * No contiene geometría propia: toda malla proviene de `src/engine` (Manifold WASM).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { randomUUID } from 'node:crypto';
import { computeWorldStats, EngineError } from '../../src/engine/index';
import { t } from '../../src/i18n/index';
import type { MeshData, SceneObject } from '../../src/types/kura';
import type {
  HollowOptions,
  MaterialPresetId,
  ObjectSourceType,
  PrimitiveParams,
  PrimitiveType,
  TextureOptions,
  Vec3,
} from './types.js';

/** Malla indexada del motor compartido (Y-up, mm). */
export type HeadlessMeshData = MeshData;

/** Objeto de escena headless: mismo contrato que `SceneObject` de la app. */
export type HeadlessSceneObject = SceneObject;

/** Estadísticas de malla tal como las calcula `src/engine`. */
export type ObjectStats = SceneObject['stats'];

/** Resumen serializable de un objeto de escena para respuestas MCP. */
export interface SceneObjectSummary {
  id: string;
  name: string;
  source: ObjectSourceType;
  primitiveType?: PrimitiveType;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  materialPreset: MaterialPresetId;
  isHole: boolean;
  visible: boolean;
  locked: boolean;
  hollow?: HollowOptions;
  texture?: TextureOptions;
  /** Cantidad de colores distintos pintados por cara (0 si la malla no tiene `faceColors`). */
  faceColorCount: number;
  stats: ObjectStats;
}

/**
 * Error explícito para operaciones que dependen de APIs de navegador (WebGL, canvas, DOM)
 * y no pueden ejecutarse en Node. Nunca se devuelve un resultado simulado en su lugar.
 */
export class HeadlessUnsupportedError extends Error {
  constructor(operation: string, reason: string) {
    super(
      `Operación '${operation}' no soportada en headless: ${reason} Abre la UI de Kura3D y conéctala al puente MCP.`
    );
    this.name = 'HeadlessUnsupportedError';
  }
}

/** Genera un identificador único de objeto headless. */
export function makeObjectId(counter: number): string {
  return `kura_${counter}_${randomUUID().slice(0, 6)}`;
}

/** Error de comando headless con el mismo código que el Command Bus (p. ej. `locked`). */
export class HeadlessCommandError extends Error {
  constructor(
    readonly code: 'locked',
    message: string,
    readonly params: Record<string, string | number> = {},
  ) {
    super(message);
    this.name = 'HeadlessCommandError';
  }
}

/** Lanza `locked` (mismo código y mensaje que el bus) si el objeto está bloqueado. */
export function assertUnlocked<T extends Pick<HeadlessSceneObject, 'locked' | 'name'>>(obj: T): T {
  if (obj.locked) {
    throw new HeadlessCommandError('locked', t('es', 'bus.error.locked', { name: obj.name }), { name: obj.name });
  }
  return obj;
}

/** Estadísticas en dimensiones de mundo (rotación y escala aplicadas), igual que el Command Bus. */
export function worldStatsOf(obj: Pick<HeadlessSceneObject, 'mesh' | 'rotation' | 'scale'>): ObjectStats {
  return computeWorldStats(obj.mesh, obj.rotation, obj.scale);
}

/** Parámetros para construir un objeto de escena desde un resultado del motor. */
export interface BuildObjectParams {
  id: string;
  name: string;
  source: ObjectSourceType;
  mesh: MeshData;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  color: string;
  materialPreset?: MaterialPresetId;
  isHole?: boolean;
  primitiveType?: PrimitiveType;
  primitiveParams?: PrimitiveParams;
}

/** Construye un `SceneObject` con estadísticas calculadas por el motor compartido. */
export function buildSceneObject(params: BuildObjectParams): HeadlessSceneObject {
  if (params.mesh.indices.length === 0) {
    throw new EngineError('MESH_EMPTY', { operation: params.name });
  }
  const scale: Vec3 = params.scale ? [...params.scale] : [1, 1, 1];
  return {
    id: params.id,
    name: params.name,
    source: params.source,
    primitiveType: params.primitiveType,
    primitiveParams: params.primitiveParams ? { ...params.primitiveParams } : undefined,
    position: params.position ? [...params.position] : [0, 0, 0],
    rotation: params.rotation ? [...params.rotation] : [0, 0, 0],
    scale,
    color: params.color,
    materialPreset: params.materialPreset ?? 'pla_matte',
    isHole: Boolean(params.isHole),
    visible: true,
    locked: false,
    mesh: params.mesh,
    stats: computeWorldStats(params.mesh, params.rotation ?? [0, 0, 0], scale),
  };
}

/** Reemplaza la malla (y opcionalmente la posición) de un objeto recalculando sus estadísticas. */
export function replaceMesh(obj: HeadlessSceneObject, mesh: MeshData, position?: Vec3): void {
  if (mesh.indices.length === 0) {
    throw new EngineError('MESH_EMPTY', { operation: obj.name });
  }
  obj.mesh = mesh;
  if (position) obj.position = [...position];
  obj.stats = worldStatsOf(obj);
}

/** Resumen serializable (sin buffers de malla) de un objeto de escena. */
export function summarizeObject(obj: HeadlessSceneObject): SceneObjectSummary {
  return {
    id: obj.id,
    name: obj.name,
    source: obj.source,
    primitiveType: obj.primitiveType,
    position: [...obj.position],
    rotation: [...obj.rotation],
    scale: [...obj.scale],
    color: obj.color,
    materialPreset: obj.materialPreset ?? 'pla_matte',
    isHole: obj.isHole,
    visible: obj.visible,
    locked: obj.locked,
    hollow: obj.hollow ? { ...obj.hollow } : undefined,
    texture: obj.texture ? { ...obj.texture } : undefined,
    faceColorCount: obj.mesh.faceColors ? new Set(obj.mesh.faceColors).size : 0,
    stats: { ...obj.stats, dimensionsMm: [...obj.stats.dimensionsMm] },
  };
}
