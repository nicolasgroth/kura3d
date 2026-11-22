/**
 * @file src/core/scene/replaceGeometry.ts
 * @description Reemplazar la geometría de un objeto por otra malla: devuelve el parche con la malla nueva y sus
 * métricas, sin tocar nombre, posición, rotación, escala, color, material ni tipo (Sólido/Negativo), y el
 * porcentaje en que cambió el tamaño (la mayor variación entre las tres dimensiones). Descarta lo que dependía
 * de la malla anterior: origen paramétrico, ahuecado, textura y datos de división.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, SceneObject } from '../../types/kura';
import { buildSceneObject } from './sceneObjects';

export interface ReplacedGeometry {
  patch: Partial<SceneObject>;
  /** Mayor variación relativa (en %) entre las dimensiones anteriores y las nuevas. */
  sizeChangePct: number;
}

export function replacedGeometryPatch(target: SceneObject, mesh: MeshData): ReplacedGeometry {
  const fresh = buildSceneObject({ name: target.name, source: 'imported', mesh, position: target.position, rotation: target.rotation, scale: target.scale });
  const before = target.stats.dimensionsMm;
  const after = fresh.stats.dimensionsMm;
  let sizeChangePct = 0;
  for (let k = 0; k < 3; k++) {
    const base = Math.max(before[k], 1e-6);
    sizeChangePct = Math.max(sizeChangePct, (Math.abs(after[k] - before[k]) / base) * 100);
  }
  return {
    sizeChangePct,
    patch: {
      source: 'imported',
      mesh: fresh.mesh,
      stats: fresh.stats,
      primitiveType: undefined,
      primitiveParams: undefined,
      parametric: undefined,
      hollow: undefined,
      texture: undefined,
      metadata: undefined,
    },
  };
}
