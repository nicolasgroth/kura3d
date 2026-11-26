/**
 * @file src/engine/measure/objectMeasure.ts
 * @description Mediciones de un objeto de escena en mundo (posición, rotación y escala aplicadas):
 * malla de mundo, área total, volumen (la misma semántica que las estadísticas) y caja; y la
 * capacidad como recipiente en su orientación actual. Ejes internos; la conversión al usuario se
 * hace en el borde (bus, MCP, interfaz).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, SceneObject } from '../../types/kura';
import { applyTransformToMesh } from '../primitives';
import { computeWorldStats } from '../worldStats';
import { measureCapacity, type CapacityOptions, type CapacityResult } from './capacity';
import { meshBox, surfaceArea, type MeshBox } from './measureGeometry';

type Placed = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>;

/** Malla del objeto en coordenadas de mundo (internas). */
export function worldMeshOf(obj: Placed): MeshData {
  return applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
}

export interface ObjectMeasure {
  surfaceAreaMm2: number;
  volumeMm3: number;
  /** Caja en mundo (ejes internos). */
  box: MeshBox;
  isClosed: boolean;
}

/** Área total, volumen y caja del objeto en mundo. */
export function measureObject(obj: Placed): ObjectMeasure {
  const world = worldMeshOf(obj);
  const stats = computeWorldStats(obj.mesh, obj.rotation, obj.scale);
  return {
    surfaceAreaMm2: surfaceArea(world),
    volumeMm3: Math.abs(stats.volumeMm3),
    box: meshBox(world) ?? { min: [0, 0, 0], max: [0, 0, 0] },
    isClosed: stats.isManifold,
  };
}

/** Capacidad del objeto como recipiente, tal como está ubicado y girado ahora. */
export function measureObjectCapacity(obj: Placed, options: CapacityOptions = {}): Promise<CapacityResult> {
  return measureCapacity(worldMeshOf(obj), options);
}
