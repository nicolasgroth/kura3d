/**
 * @file src/engine/io/threeMfKuraScene.ts
 * @description Lectura de un 3MF exportado por Kura3D con sus metadatos de escena: cada `<object>` que
 * nombran los metadatos (impreso, oculto o hueco) vuelve con su malla LOCAL (se deshace la
 * transformación mundial con la que se escribió), su transformación exacta y su estado; el árbol de
 * grupos viaja en `ImportedModel.kuraScene`. Si algo no calza (objeto ausente, conteos distintos porque
 * otro programa editó el archivo) devuelve null y el 3MF se lee de la forma normal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { ModelImportError, type ModelImportLimits } from './importErrors';
import type { ImportedModel, ImportedPart } from './importTypes';
import type { KuraSceneMeta } from './kuraSceneMeta';
import { finishMesh } from './meshBuffers';

/** Geometría de un `<object>` del modelo raíz, en unidades y ejes del archivo (Z arriba). */
export interface KuraObjectGeometry {
  positions: Float32Array;
  indices: Uint32Array;
  colors: (string | undefined)[];
  baseColor?: string;
}

/** Matriz inversa (columna mayor, three) de la transformación mundial de Kura3D. */
function inverseWorld(position: readonly number[], rotation: readonly number[], scale: readonly number[]): number[] | null {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(position[0], position[1], position[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ')),
    new THREE.Vector3(scale[0], scale[1], scale[2]),
  );
  if (!Number.isFinite(m.determinant()) || Math.abs(m.determinant()) < 1e-12) return null;
  return m.invert().elements;
}

/**
 * Piezas de la escena Kura3D, en el orden de los metadatos. `geometryOf(id)` devuelve la geometría del
 * objeto o null si no existe o no tiene malla.
 */
export function readKuraScene(
  meta: KuraSceneMeta,
  geometryOf: (objectId: string) => KuraObjectGeometry | null,
  unitScale: number,
  fileName: string,
  limits: ModelImportLimits,
): ImportedModel | null {
  // Primera pasada: todo calza (objetos presentes, conteos iguales) antes de reservar mallas.
  const geometries: KuraObjectGeometry[] = [];
  const inverses: number[][] = [];
  let triangles = 0;
  for (const entry of meta.objects) {
    const geometry = geometryOf(entry.objectId);
    if (!geometry) return null;
    if (geometry.positions.length / 3 !== entry.vertices || geometry.indices.length / 3 !== entry.triangles) return null;
    const inv = inverseWorld(entry.position, entry.rotation, entry.scale);
    if (!inv) return null;
    inverses.push(inv);
    triangles += entry.triangles;
    if (triangles > limits.maxTriangles) throw new ModelImportError('too-many-triangles');
    geometries.push(geometry);
  }
  if (meta.objects.length > limits.maxParts) throw new ModelImportError('too-many-parts');

  const parts: ImportedPart[] = [];
  meta.objects.forEach((entry, index) => {
    const geometry = geometries[index];
    const inv = inverses[index];
    const src = geometry.positions;
    const positions = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      // Archivo (Z arriba, unidad del 3MF) -> mundo Kura3D (Y arriba, mm) -> local del objeto.
      const x = src[i] * unitScale, y = src[i + 2] * unitScale, z = -src[i + 1] * unitScale;
      positions[i] = inv[0] * x + inv[4] * y + inv[8] * z + inv[12];
      positions[i + 1] = inv[1] * x + inv[5] * y + inv[9] * z + inv[13];
      positions[i + 2] = inv[2] * x + inv[6] * y + inv[10] * z + inv[14];
    }
    const indices = new Uint32Array(geometry.indices);
    const color = entry.color || geometry.baseColor;
    const varied = geometry.colors.some((c) => c !== undefined && c !== geometry.baseColor);
    const faceColors = varied ? geometry.colors.map((c) => c ?? color ?? '#38bdf8') : undefined;
    const finished = finishMesh(positions, indices, faceColors, geometry.baseColor);
    parts.push({
      name: entry.name,
      color: color || undefined,
      mesh: finished.mesh,
      isHole: entry.isHole || undefined,
      group: index,
      openEdges: finished.openEdges,
      kura: entry,
    });
  });
  if (parts.length === 0) return null;
  return {
    fileName,
    format: '3mf',
    parts,
    hasPlacement: true,
    kuraScene: { groups: meta.groups },
  };
}
