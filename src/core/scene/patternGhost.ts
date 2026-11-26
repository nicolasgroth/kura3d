/**
 * @file src/core/scene/patternGhost.ts
 * @description Datos de la vista previa fantasma de un patrón (funciones puras): por cada pieza de origen, su malla y la
 * matriz de mundo de cada copia (las originales no se dibujan). El espejo usa la matriz de la pieza reflejada por el
 * plano (determinante negativo: el visor dibuja el fantasma a doble cara). Más de `MAX_GHOST_TRIANGLES` triángulos en
 * total: sin fantasma (el panel lo dice).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { MeshData, SceneObject } from '../../types/kura';
import { MAX_GHOST_TRIANGLES, type PatternPose } from './patterns';

export interface PatternGhostEntry {
  sourceId: string;
  mesh: MeshData;
  /** Matrices 4×4 (16 números por copia, columnas) de las copias. */
  matrices: Float32Array;
  count: number;
}

export interface PatternGhost {
  entries: PatternGhostEntry[];
}

type Source = Pick<SceneObject, 'id' | 'mesh' | 'scale' | 'position' | 'rotation' | 'stats'>;

const matrixOf = (scale: SceneObject['scale'], pose: PatternPose): THREE.Matrix4 =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...pose.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ')),
    new THREE.Vector3(...scale),
  );

function entries(sources: readonly Source[], cells: number, matrixFor: (cell: number, i: number) => THREE.Matrix4): PatternGhost | null {
  const triangles = sources.reduce((sum, s) => sum + s.stats.triangles, 0) * Math.max(0, cells - 1);
  if (triangles > MAX_GHOST_TRIANGLES || cells < 2) return null;
  return {
    entries: sources.map((src, i) => {
      const matrices = new Float32Array(16 * (cells - 1));
      for (let k = 1; k < cells; k++) matrixFor(k, i).toArray(matrices, 16 * (k - 1));
      return { sourceId: src.id, mesh: src.mesh, matrices, count: cells - 1 };
    }),
  };
}

/** Fantasma de un patrón de fila, rejilla o circular. */
export function ghostOfPoses(sources: readonly Source[], poses: readonly PatternPose[][]): PatternGhost | null {
  return entries(sources, poses.length, (k, i) => matrixOf(sources[i].scale, poses[k][i]));
}

/** Fantasma del reflejo (una celda más: el reflejo de cada pieza respecto del plano). */
export function ghostOfMirror(sources: readonly Source[], plane: { index: 0 | 1 | 2; coord: number }): PatternGhost | null {
  const reflect = new THREE.Matrix4().identity();
  reflect.elements[plane.index * 5] = -1;
  reflect.elements[12 + plane.index] = 2 * plane.coord;
  return entries(sources, 2, (_k, i) => reflect.clone().multiply(matrixOf(sources[i].scale, { position: sources[i].position, rotation: sources[i].rotation })));
}
