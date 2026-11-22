/**
 * @file src/engine/paint/fill.ts
 * @description Relleno por región (estilo OrcaSlicer / Bambu Studio) y pintar todo. Ambos devuelven
 * la misma malla si ningún color cambia, así el store no agrega pasos de historial vacíos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import { getFaceAdjacency } from './faceAdjacency';
import { DEFAULT_UNPAINTED_COLOR, FaceColorWriter, hasFaceColors, triangleCount, withFaceColors } from './faceColors';

/**
 * Propaga `colorHex` desde `seedFaceIndex` a las caras conectadas por arista cuyo ángulo entre
 * normales vecinas no supere `angleThresholdDeg`. Las caras sin pintar toman `baseColorHex`.
 * Comparte la geometría con la malla original.
 */
export function paintFloodFillConnectedFaces(
  mesh: MeshData,
  seedFaceIndex: number,
  colorHex: string,
  angleThresholdDeg = 30,
  baseColorHex: string = DEFAULT_UNPAINTED_COLOR,
): MeshData {
  const triCount = triangleCount(mesh);
  if (seedFaceIndex < 0 || seedFaceIndex >= triCount) return mesh;
  const { sideEdge, edgeStart, edgeTris, normals } = getFaceAdjacency(mesh);
  const writer = new FaceColorWriter(mesh, baseColorHex.toLowerCase());
  const hex = colorHex.toLowerCase();
  const cosThreshold = Math.cos((angleThresholdDeg * Math.PI) / 180);
  const visited = new Uint8Array(triCount);
  const queue = new Uint32Array(triCount);
  let tail = 0;
  queue[tail++] = seedFaceIndex;
  visited[seedFaceIndex] = 1;
  for (let head = 0; head < tail; head++) {
    const curr = queue[head];
    writer.set(curr, hex);
    const cnx = normals[curr * 3], cny = normals[curr * 3 + 1], cnz = normals[curr * 3 + 2];
    for (let k = 0; k < 3; k++) {
      const e = sideEdge[curr * 3 + k];
      for (let j = edgeStart[e]; j < edgeStart[e + 1]; j++) {
        const nb = edgeTris[j];
        if (visited[nb]) continue;
        if (cnx * normals[nb * 3] + cny * normals[nb * 3 + 1] + cnz * normals[nb * 3 + 2] >= cosThreshold) {
          visited[nb] = 1;
          queue[tail++] = nb;
        }
      }
    }
  }
  return withFaceColors(mesh, writer.result());
}

/**
 * Asigna `colorHex` a todos los triángulos. Si la malla ya es de ese color (o no está pintada y
 * `baseColorHex` coincide), devuelve la misma malla.
 */
export function paintEntireMesh(mesh: MeshData, colorHex: string, baseColorHex?: string): MeshData {
  const hex = colorHex.toLowerCase();
  const n = triangleCount(mesh);
  if (hasFaceColors(mesh)) {
    if (mesh.faceColors!.every((c) => c === hex)) return mesh;
  } else if (baseColorHex !== undefined && baseColorHex.toLowerCase() === hex) {
    return mesh;
  }
  return { ...mesh, faceColors: new Array<string>(n).fill(hex) };
}
