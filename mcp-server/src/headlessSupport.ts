/**
 * @file mcp-server/src/headlessSupport.ts
 * @description Utilidades de la capa de escena headless del servidor MCP de Kura3D: alias de
 * tipos, construcción de objetos con la política headless de `src/core/scene`, resúmenes
 * serializables y el error explícito "no soportado en headless".
 * No contiene geometría propia: toda malla proviene de `src/engine` (Manifold WASM).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { randomUUID } from 'node:crypto';
import { computeWorldStats, EngineError } from '../../src/engine/index';
import { t } from '../../src/i18n/index';
import type { MeshData, SceneObject } from '../../src/types/kura';
import {
  buildSceneObject as buildCoreSceneObject,
  HEADLESS_BUILD_POLICY,
  type BuildObjectParams as CoreBuildObjectParams,
} from '../../src/core/scene/sceneObjects';
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

/** Resumen serializable de un objeto (fuente única en `src/core/scene/sceneSummary`). */
export { summarizeObject, type SceneObjectSummary } from '../../src/core/scene/sceneSummary';

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
    readonly code: 'locked' | 'not-found' | 'invalid-params' | 'precondition',
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
export type BuildObjectParams = CoreBuildObjectParams & { id: string; color: string };

/** Construye un `SceneObject` con la política headless (estadísticas de mundo, origen, sin mallas vacías). */
export function buildSceneObject(params: BuildObjectParams): HeadlessSceneObject {
  return buildCoreSceneObject(params, HEADLESS_BUILD_POLICY);
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
