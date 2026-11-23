/**
 * @file src/core/scene/sceneSummary.ts
 * @description Resumen serializable (sin buffers de malla) de un objeto de escena, usado en las
 * respuestas del servidor MCP y disponible para cualquier adaptador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type {
  HollowOptions,
  MaterialPresetId,
  ObjectSourceType,
  PrimitiveType,
  SceneObject,
  TextureOptions,
  Vec3,
} from '../../types/kura';
import type { ObjectRole } from '../../types/kura';
import { isNegative } from './objectRole';

/** Resumen serializable de un objeto de escena. */
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
  role: ObjectRole;
  /** Obsoleto: `role === 'negative'`. Se mantiene una versión para clientes MCP antiguos. */
  isHole: boolean;
  /** Opacidad propia de una referencia (si la tiene). */
  referenceOpacity?: number;
  visible: boolean;
  locked: boolean;
  hollow?: HollowOptions;
  texture?: TextureOptions;
  /** Cantidad de colores distintos pintados por cara (0 si la malla no tiene `faceColors`). */
  faceColorCount: number;
  stats: SceneObject['stats'];
}

/** Resumen serializable (sin buffers de malla) de un objeto de escena. */
export function summarizeObject(obj: SceneObject): SceneObjectSummary {
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
    role: obj.role,
    isHole: isNegative(obj),
    ...(obj.referenceOpacity !== undefined ? { referenceOpacity: obj.referenceOpacity } : {}),
    visible: obj.visible,
    locked: obj.locked,
    hollow: obj.hollow ? { ...obj.hollow } : undefined,
    texture: obj.texture ? { ...obj.texture } : undefined,
    faceColorCount: obj.mesh.faceColors ? new Set(obj.mesh.faceColors).size : 0,
    stats: { ...obj.stats, dimensionsMm: [...obj.stats.dimensionsMm] },
  };
}
