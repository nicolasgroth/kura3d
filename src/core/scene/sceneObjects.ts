/**
 * @file src/core/scene/sceneObjects.ts
 * @description Modelo de escena compartido por la app y el servidor MCP: construcción de
 * `SceneObject` desde resultados del motor, apoyo en cama, centros de malla y copias. Sin React,
 * Zustand ni i18n. Las diferencias históricas entre app y MCP headless (estadísticas locales o de
 * mundo, posición por defecto) quedan explícitas en `ObjectBuildPolicy`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { computeMeshStats, computeWorldStats, EngineError } from '../../engine';
import {
  PRINT_COLOR_PALETTE,
  type MaterialPresetId,
  type MeshData,
  type ObjectSourceType,
  type PrimitiveParams,
  type ParametricOrigin,
  type PrimitiveType,
  type SceneObject,
  type Vec3,
} from '../../types/kura';

/** Generador de IDs cortos y únicos sin dependencias externas. */
export function makeId(prefix = 'obj'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Parámetros para construir un objeto de escena a partir de una malla del motor. */
export interface BuildObjectParams {
  id?: string;
  name: string;
  source: ObjectSourceType;
  mesh: MeshData;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  color?: string;
  materialPreset?: MaterialPresetId;
  isHole?: boolean;
  primitiveType?: PrimitiveType;
  primitiveParams?: PrimitiveParams;
  parametric?: ParametricOrigin;
}

/**
 * Cómo construye objetos cada adaptador. La app guarda estadísticas locales y apoya en la cama
 * por defecto; el MCP headless guarda estadísticas de mundo, parte del origen y rechaza mallas vacías.
 */
export interface ObjectBuildPolicy {
  stats: 'local' | 'world';
  defaultPosition: 'bed' | 'origin';
  rejectEmpty: boolean;
}

export const APP_BUILD_POLICY: ObjectBuildPolicy = { stats: 'local', defaultPosition: 'bed', rejectEmpty: false };
export const HEADLESS_BUILD_POLICY: ObjectBuildPolicy = { stats: 'world', defaultPosition: 'origin', rejectEmpty: true };

/** Función que construye un objeto de escena (cada adaptador fija su política e IDs). */
export type ObjectBuilder = (params: BuildObjectParams) => SceneObject;

/** Calcula la altura mínima (minY) real de una malla en espacio de mundo aplicando rotación y escala. */
export function computeTransformedMinY(mesh: MeshData, rotation: Vec3, scale: Vec3): number {
  const pos = mesh.positions;
  if (pos.length < 3) return 0;
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
  const vec = new THREE.Vector3();
  let minY = Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    vec.set(pos[i] * scale[0], pos[i + 1] * scale[1], pos[i + 2] * scale[2]);
    vec.applyQuaternion(quat);
    if (vec.y < minY) minY = vec.y;
  }
  return Number.isFinite(minY) ? minY : 0;
}

/** Calcula la posición Y para apoyar el objeto exactamente sobre Y = 0 (evita -0). */
export function computeBedPositionY(mesh: MeshData, rotation: Vec3, scale: Vec3): number {
  const minY = computeTransformedMinY(mesh, rotation, scale);
  return minY === 0 || Math.abs(minY) < 1e-12 ? 0 : -minY;
}

/** Construye un `SceneObject` válido a partir de una malla calculando sus métricas. */
export function buildSceneObject(params: BuildObjectParams, policy: ObjectBuildPolicy = APP_BUILD_POLICY): SceneObject {
  if (policy.rejectEmpty && params.mesh.indices.length === 0) {
    throw new EngineError('MESH_EMPTY', { operation: params.name });
  }
  const rotation: Vec3 = params.rotation ? [...params.rotation] : [0, 0, 0];
  const scale: Vec3 = params.scale ? [...params.scale] : [1, 1, 1];
  const stats = policy.stats === 'world'
    ? computeWorldStats(params.mesh, rotation, scale)
    : computeMeshStats(params.mesh);
  const defaultPosition: Vec3 = policy.defaultPosition === 'bed'
    ? [0, computeBedPositionY(params.mesh, rotation, scale), 0]
    : [0, 0, 0];
  return {
    id: params.id ?? makeId('mesh'),
    name: params.name,
    source: params.source,
    primitiveType: params.primitiveType,
    primitiveParams: params.primitiveParams ? { ...params.primitiveParams } : undefined,
    ...(params.parametric ? { parametric: { ...params.parametric, ...(params.parametric.thread ? { thread: { ...params.parametric.thread } } : {}) } } : {}),
    position: params.position ? [...params.position] : defaultPosition,
    rotation,
    scale,
    color: params.color ?? PRINT_COLOR_PALETTE[0],
    materialPreset: params.materialPreset ?? 'pla_matte',
    isHole: Boolean(params.isHole),
    visible: true,
    locked: false,
    mesh: params.mesh,
    stats,
  };
}

/** Calcula el centro geométrico local [cx, cy, cz] de una malla. */
export function computeLocalMeshCenter(mesh: MeshData): Vec3 {
  const pos = mesh.positions;
  if (pos.length < 3) return [0, 0, 0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = pos[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5];
}

/** Calcula el centro mundial real de un objeto para posicionar módulos sobre él. */
export function computeObjectWorldCenter(obj: SceneObject): Vec3 {
  const c = computeLocalMeshCenter(obj.mesh);
  const v = new THREE.Vector3(c[0] * obj.scale[0], c[1] * obj.scale[1], c[2] * obj.scale[2]);
  v.applyEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ'));
  return [obj.position[0] + v.x, obj.position[1] + v.y, obj.position[2] + v.z];
}

/** Copia de un objeto con vectores propios (la malla inmutable se comparte). */
export function copySceneObject(src: SceneObject, patch: Partial<SceneObject> = {}): SceneObject {
  return {
    ...src,
    position: [...src.position] as Vec3,
    rotation: [...src.rotation] as Vec3,
    scale: [...src.scale] as Vec3,
    stats: { ...src.stats, dimensionsMm: [...src.stats.dimensionsMm] as Vec3 },
    ...patch,
  };
}

/** Transformación neutra para mallas que el motor ya devolvió en espacio mundial. */
export function worldBaked(): { rotation: Vec3; scale: Vec3 } {
  return { rotation: [0, 0, 0], scale: [1, 1, 1] };
}
