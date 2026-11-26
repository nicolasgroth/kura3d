/**
 * @file src/core/operations/patternOperations.ts
 * @description Operaciones puras del «Patrón»: copias de unas piezas en las poses que dan los pasos de
 * `core/scene/patterns.ts` (fila, rejilla, circular) y reflejo de una pieza respecto de un plano del mundo (espejo con
 * copia). Las copias comparten la malla inmutable de su original y heredan color, material, rol (sólido o negativo) y
 * placa. No tocan estado, avisos ni i18n: los nombres llegan por `nameOf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { computeVertexNormals } from '../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { patternPoses, type PatternPose, type PatternStep } from '../scene/patterns';
import { copySceneObject } from '../scene/sceneObjects';
import { change, statsFor, type OperationContext, type SceneChange } from './operationTypes';

export interface PatternCopiesInput {
  sources: readonly SceneObject[];
  /** Pasos del patrón; el 0 es la identidad (la original) y no genera copia. */
  steps: readonly PatternStep[];
  /** Nombre de la copia de `src` en la celda `cell` (1 = primera copia). */
  nameOf: (src: SceneObject, cell: number) => string;
}

export interface PatternCopiesResult {
  change: SceneChange;
  /** Copias en orden de celda y, dentro de ella, de pieza de origen. */
  copies: SceneObject[];
  /** Copia de cada pieza de origen por celda (`cells[k][i]`; la celda 0 son las originales). */
  cells: SceneObject[][];
}

/** Copias de las piezas en cada paso del patrón. */
export function patternCopies(ctx: OperationContext, input: PatternCopiesInput): PatternCopiesResult {
  const poses = patternPoses(input.sources, input.steps);
  const cells: SceneObject[][] = [[...input.sources]];
  const copies: SceneObject[] = [];
  for (let k = 1; k < poses.length; k++) {
    const row = input.sources.map((src, i) => {
      const { restPose: _restPose, ...rest } = src;
      void _restPose;
      return copySceneObject(rest as SceneObject, {
        id: ctx.newId(),
        name: input.nameOf(src, k),
        position: poses[k][i].position,
        rotation: poses[k][i].rotation,
        // La copia no hereda una pose de «otro modo de vista» que ya no le corresponde.
      });
    });
    cells.push(row);
    copies.push(...row);
  }
  return { change: change({ added: copies }), copies, cells };
}

/** Pose resultante de aplicar la reflexión (para las pruebas: vértices de mundo reflejados). */
export function reflectMeshInWorld(
  obj: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>,
  plane: { index: 0 | 1 | 2; coord: number },
): { mesh: MeshData; origin: Vec3 } {
  const src = obj.mesh;
  const vertCount = Math.floor(src.positions.length / 3);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...obj.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ')),
    new THREE.Vector3(...obj.scale),
  );
  const world = new Float32Array(src.positions.length);
  const v = new THREE.Vector3();
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertCount; i++) {
    v.set(src.positions[i * 3], src.positions[i * 3 + 1], src.positions[i * 3 + 2]).applyMatrix4(matrix);
    const w: Vec3 = [v.x, v.y, v.z];
    w[plane.index] = 2 * plane.coord - w[plane.index];
    for (let k = 0; k < 3; k++) {
      world[i * 3 + k] = w[k];
      if (w[k] < min[k]) min[k] = w[k];
      if (w[k] > max[k]) max[k] = w[k];
    }
  }
  // Origen de la pieza reflejada: centro en X y Z, base en Y (como una pieza apoyada), para que el gizmo quede a mano.
  const origin: Vec3 = vertCount === 0 ? [0, 0, 0] : [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  for (let i = 0; i < vertCount; i++) {
    world[i * 3] -= origin[0];
    world[i * 3 + 1] -= origin[1];
    world[i * 3 + 2] -= origin[2];
  }
  // Una reflexión invierte el devanado: se corrige para que las normales sigan saliendo.
  const indices = new Uint32Array(src.indices);
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const tmp = indices[t + 1];
    indices[t + 1] = indices[t + 2];
    indices[t + 2] = tmp;
  }
  return {
    mesh: {
      positions: world,
      indices,
      normals: computeVertexNormals(world, indices),
      ...(src.faceColors ? { faceColors: [...src.faceColors] } : {}),
    },
    origin,
  };
}

export interface MirrorAcrossInput {
  sources: readonly SceneObject[];
  plane: { index: 0 | 1 | 2; coord: number };
  keepOriginal: boolean;
  nameOf: (src: SceneObject) => string;
}

/** Espejo respecto de un plano del mundo: agrega el reflejo (y conserva la original) o reemplaza la malla de la original. */
export function mirrorAcrossPlane(ctx: OperationContext, input: MirrorAcrossInput): PatternCopiesResult {
  const copies: SceneObject[] = [];
  const patches: SceneChange['patches'] = [];
  for (const src of input.sources) {
    const { mesh, origin } = reflectMeshInWorld(src, input.plane);
    const rotation: Vec3 = [0, 0, 0];
    const scale: Vec3 = [1, 1, 1];
    const stats = statsFor(ctx, { mesh, rotation, scale });
    if (input.keepOriginal) {
      const { restPose: _restPose, ...rest } = src;
      void _restPose;
      copies.push(copySceneObject(rest as SceneObject, { id: ctx.newId(), name: input.nameOf(src), mesh, position: origin, rotation, scale, stats }));
    } else {
      patches.push({ id: src.id, patch: { mesh, position: origin, rotation, scale, stats } });
    }
  }
  return {
    change: change({ added: copies, patches }),
    copies,
    cells: [[...input.sources], copies],
  };
}

export type { PatternPose };
