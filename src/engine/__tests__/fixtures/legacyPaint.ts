/**
 * @file src/engine/__tests__/fixtures/legacyPaint.ts
 * @description Copia congelada de la pintura por caras anterior a `src/engine/paint/` (recorrido lineal y adyacencia con claves de texto). Solo para pruebas de equivalencia y de tiempos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, SceneObject, Vec3 } from '../../../types/kura';
import { pointToTriangleDistanceSq } from '../../paint/triangleDistance';

export function legacyPaintSphere(
  obj: SceneObject,
  localCenter: Vec3,
  radiusMm: number,
  colorHex: string
): MeshData {
  const triCount = Math.floor(obj.mesh.indices.length / 3);
  const hadColors = Boolean(obj.mesh.faceColors && obj.mesh.faceColors.length === triCount);
  const faceColors = hadColors
    ? [...obj.mesh.faceColors!]
    : new Array<string>(triCount).fill(obj.color.toLowerCase());

  const [sx, sy, sz] = (obj.scale ?? [1, 1, 1]).map((v) => Math.abs(v) || 1);
  const rSq = radiusMm * radiusMm;
  const cx = localCenter[0] * sx;
  const cy = localCenter[1] * sy;
  const cz = localCenter[2] * sz;
  const normalizedHex = colorHex.toLowerCase();
  let changed = false;

  for (let t = 0; t < triCount; t++) {
    const i0 = obj.mesh.indices[t * 3] * 3;
    const i1 = obj.mesh.indices[t * 3 + 1] * 3;
    const i2 = obj.mesh.indices[t * 3 + 2] * 3;

    const ax = obj.mesh.positions[i0] * sx;
    const ay = obj.mesh.positions[i0 + 1] * sy;
    const az = obj.mesh.positions[i0 + 2] * sz;
    const bx = obj.mesh.positions[i1] * sx;
    const by = obj.mesh.positions[i1 + 1] * sy;
    const bz = obj.mesh.positions[i1 + 2] * sz;
    const d0x = obj.mesh.positions[i2] * sx;
    const d0y = obj.mesh.positions[i2 + 1] * sy;
    const d0z = obj.mesh.positions[i2 + 2] * sz;

    const distSq = pointToTriangleDistanceSq(
      cx,
      cy,
      cz,
      ax,
      ay,
      az,
      bx,
      by,
      bz,
      d0x,
      d0y,
      d0z
    );
    if (distSq <= rSq && faceColors[t] !== normalizedHex) {
      faceColors[t] = normalizedHex;
      changed = true;
    }
  }

  return (changed ? { ...obj.mesh, faceColors } : obj.mesh);
}

/**
 * Asigna un color uniforme `colorHex` a todos los triángulos de una malla.
 */
export function legacyPaintEntire(mesh: MeshData, colorHex: string): MeshData {
  const triCount = Math.floor(mesh.indices.length / 3);
  return { ...mesh, faceColors: new Array<string>(triCount).fill(colorHex.toLowerCase()) };
}

/**
 * Pintado inteligente por inundación (smart flood-fill, estilo OrcaSlicer / Bambu Studio):
 * propaga el color `colorHex` desde `seedFaceIndex` a todas las caras conectadas por
 * arista cuyo ángulo entre normales adyacentes no supere `angleThresholdDeg`.
 *
 * @param mesh Malla origen.
 * @param seedFaceIndex Índice del triángulo semilla.
 * @param colorHex Color objetivo en hexadecimal '#rrggbb'.
 * @param angleThresholdDeg Ángulo máximo permitido entre caras adyacentes (por defecto 30°).
 * @param baseColorHex Color del objeto para las caras aún sin pintar (si la malla no tiene `faceColors`).
 * @returns Malla con `faceColors` actualizado (comparte la geometría con la original).
 */
export function legacyFloodFill(
  mesh: MeshData,
  seedFaceIndex: number,
  colorHex: string,
  angleThresholdDeg = 30,
  baseColorHex: string = '#94a3b8'
): MeshData {
  const triCount = Math.floor(mesh.indices.length / 3);
  if (seedFaceIndex < 0 || seedFaceIndex >= triCount) {
    return mesh;
  }

  const faceColors =
    mesh.faceColors && mesh.faceColors.length === triCount
      ? [...mesh.faceColors]
      : new Array<string>(triCount).fill(baseColorHex.toLowerCase());

  // Mapear vértices por posición cuantizada para conectar también mallas con costuras duplicadas
  const vertCount = Math.floor(mesh.positions.length / 3);
  const invTol = 1e4;
  const posMap = new Map<string, number>();
  const vertWeld = new Uint32Array(vertCount);
  for (let v = 0; v < vertCount; v++) {
    const key = `${Math.round(mesh.positions[v * 3] * invTol)},${Math.round(
      mesh.positions[v * 3 + 1] * invTol
    )},${Math.round(mesh.positions[v * 3 + 2] * invTol)}`;
    let id = posMap.get(key);
    if (id === undefined) {
      id = posMap.size;
      posMap.set(key, id);
    }
    vertWeld[v] = id;
  }

  // Calcular normales unitarias por triángulo y grafo de adyacencia por arista no dirigida
  const triNormals = new Float32Array(triCount * 3);
  const edgeToTris = new Map<string, number[]>();

  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3];
    const i1 = mesh.indices[t * 3 + 1];
    const i2 = mesh.indices[t * 3 + 2];

    const ax = mesh.positions[i0 * 3];
    const ay = mesh.positions[i0 * 3 + 1];
    const az = mesh.positions[i0 * 3 + 2];

    const e1x = mesh.positions[i1 * 3] - ax;
    const e1y = mesh.positions[i1 * 3 + 1] - ay;
    const e1z = mesh.positions[i1 * 3 + 2] - az;

    const e2x = mesh.positions[i2 * 3] - ax;
    const e2y = mesh.positions[i2 * 3 + 1] - ay;
    const e2z = mesh.positions[i2 * 3 + 2] - az;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz) || 1;
    triNormals[t * 3] = nx / len;
    triNormals[t * 3 + 1] = ny / len;
    triNormals[t * 3 + 2] = nz / len;

    const w0 = vertWeld[i0];
    const w1 = vertWeld[i1];
    const w2 = vertWeld[i2];
    const pairs: [number, number][] = [
      [w0, w1],
      [w1, w2],
      [w2, w0],
    ];
    for (const [u, v] of pairs) {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      let list = edgeToTris.get(key);
      if (!list) {
        list = [];
        edgeToTris.set(key, list);
      }
      list.push(t);
    }
  }

  const cosThreshold = Math.cos((angleThresholdDeg * Math.PI) / 180);
  const visited = new Uint8Array(triCount);
  const queue: number[] = [seedFaceIndex];
  visited[seedFaceIndex] = 1;
  const normalizedHex = colorHex.toLowerCase();

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    faceColors[curr] = normalizedHex;

    const cnx = triNormals[curr * 3];
    const cny = triNormals[curr * 3 + 1];
    const cnz = triNormals[curr * 3 + 2];

    const w0 = vertWeld[mesh.indices[curr * 3]];
    const w1 = vertWeld[mesh.indices[curr * 3 + 1]];
    const w2 = vertWeld[mesh.indices[curr * 3 + 2]];
    const pairs: [number, number][] = [
      [w0, w1],
      [w1, w2],
      [w2, w0],
    ];

    for (const [u, v] of pairs) {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      const neighbors = edgeToTris.get(key);
      if (!neighbors) continue;
      for (const nb of neighbors) {
        if (visited[nb]) continue;
        const dot =
          cnx * triNormals[nb * 3] +
          cny * triNormals[nb * 3 + 1] +
          cnz * triNormals[nb * 3 + 2];
        if (dot >= cosThreshold) {
          visited[nb] = 1;
          queue.push(nb);
        }
      }
    }
  }

  return (true ? { ...mesh, faceColors } : mesh);
}
