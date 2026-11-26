/**
 * @file src/project/codecLimits.ts
 * @description Topes compartidos por el códec `.kura` y el borrador de recuperación (defensa en profundidad: un
 * archivo o un borrador dañado no puede pedir trabajo sin cota): objetos por escena, pasos de historial, mallas y
 * geometría por malla y total.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { FILE_HISTORY_MAX_STEPS } from './historyBudget';
import { check, limit } from './projectSchema';

/** Pasos de historial (pasado + futuro). */
export const MAX_HISTORY = FILE_HISTORY_MAX_STEPS;
export const MAX_OBJECTS = 10000;
export const MAX_MESHES = 20000;
export const MAX_TRIANGLES_PER_MESH = 1_000_000;
export const MAX_VERTICES_PER_MESH = 3_000_000;
/** Geometría total que se valida en una lectura (cuenta cada referencia, aunque repita bloque). */
export const MAX_TOTAL_VERTICES = 16_000_000;
export const MAX_TOTAL_TRIANGLES = 8_000_000;

export interface PerMeshLimits { triangles: number; vertices: number }

/**
 * Presupuesto de geometría de una lectura: valida cada malla (tope por malla e índices en rango) y acumula el
 * total. Acota el trabajo aunque un manifiesto chico referencie muchas veces el mismo bloque grande.
 */
export function geometryBudget(perMesh: PerMeshLimits = { triangles: MAX_TRIANGLES_PER_MESH, vertices: MAX_VERTICES_PER_MESH }) {
  let vertices = 0;
  let triangles = 0;
  return (positions: Float32Array, indices: Uint32Array) => {
    const n = positions.length / 3, t = indices.length / 3;
    check(Number.isInteger(n) && Number.isInteger(t));
    limit(n <= perMesh.vertices && t <= perMesh.triangles);
    vertices += n;
    triangles += t;
    limit(vertices <= MAX_TOTAL_VERTICES && triangles <= MAX_TOTAL_TRIANGLES);
    for (const vertex of indices) check(vertex < n);
  };
}
