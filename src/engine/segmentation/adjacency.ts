/**
 * @file src/engine/segmentation/adjacency.ts
 * @description Grafo de adyacencia de triángulos (soldado de vértices, pliegues y costuras cóncavas) y adyacencia/fusión entre regiones de la segmentación estructural.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { EDGE_KEY_STRIDE, WELD_INV_TOL } from './constants';
import { undirectedEdgeKey } from './geometryUtils';

/** Datos geométricos precalculados por triángulo para acelerar grafos y clasificación. */
export interface TriangleGraphData {
  triCount: number;
  weldedIds: Uint32Array;
  normals: Float64Array;
  centroids: Float64Array;
  areas: Float64Array;
  /** Lista de vecinos por triángulo: cada entrada es [triVecino, estaBloqueado, esConcavo, longArista]. */
  adjNeighbors: Int32Array[];
  adjBlocked: Uint8Array[];
  adjConcave: Uint8Array[];
  adjEdgeLen: Float64Array[];
}

/**
 * Construye el mapa de soldado de vértices (tolerancia 1e-4 mm), calcula normales,
 * centroides, áreas y construye el grafo de adyacencia de triángulos con detección
 * de costuras cóncavas y pliegues diedros agudos.
 */
export function buildTriangleAdjacencyGraph(
  mesh: MeshData,
  creaseAngleDeg: number
): TriangleGraphData {
  const positions = mesh.positions;
  const indices = mesh.indices;
  const vertCount = Math.floor(positions.length / 3);
  const triCount = Math.floor(indices.length / 3);

  const weldedIds = new Uint32Array(vertCount);
  const posMap = new Map<string, number>();

  for (let v = 0; v < vertCount; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    const key = `${Math.round(x * WELD_INV_TOL)},${Math.round(y * WELD_INV_TOL)},${Math.round(z * WELD_INV_TOL)}`;
    let id = posMap.get(key);
    if (id === undefined) {
      id = posMap.size;
      posMap.set(key, id);
    }
    weldedIds[v] = id;
  }

  const normals = new Float64Array(triCount * 3);
  const centroids = new Float64Array(triCount * 3);
  const areas = new Float64Array(triCount);

  // Mapa arista no dirigida -> lista compacta de triángulos incidentes
  const edgeToTris = new Map<number, number[]>();

  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];

    const ax = positions[i0 * 3];
    const ay = positions[i0 * 3 + 1];
    const az = positions[i0 * 3 + 2];
    const bx = positions[i1 * 3];
    const by = positions[i1 * 3 + 1];
    const bz = positions[i1 * 3 + 2];
    const cx = positions[i2 * 3];
    const cy = positions[i2 * 3 + 1];
    const cz = positions[i2 * 3 + 2];

    centroids[t * 3] = (ax + bx + cx) / 3;
    centroids[t * 3 + 1] = (ay + by + cy) / 3;
    centroids[t * 3 + 2] = (az + bz + cz) / 3;

    const e1x = bx - ax;
    const e1y = by - ay;
    const e1z = bz - az;
    const e2x = cx - ax;
    const e2y = cy - ay;
    const e2z = cz - az;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const crossLen = Math.hypot(nx, ny, nz);

    if (crossLen > 1e-12) {
      areas[t] = 0.5 * crossLen;
      normals[t * 3] = nx / crossLen;
      normals[t * 3 + 1] = ny / crossLen;
      normals[t * 3 + 2] = nz / crossLen;
    } else {
      areas[t] = 0;
      normals[t * 3 + 1] = 1;
    }

    const w0 = weldedIds[i0];
    const w1 = weldedIds[i1];
    const w2 = weldedIds[i2];

    const edges: [number, number][] = [
      [w0, w1],
      [w1, w2],
      [w2, w0],
    ];
    for (const [u, v] of edges) {
      if (u === v) continue;
      const eKey = undirectedEdgeKey(u, v);
      let list = edgeToTris.get(eKey);
      if (!list) {
        list = [t];
        edgeToTris.set(eKey, list);
      } else {
        list.push(t);
      }
    }
  }

  const rawNeighbors: number[][] = Array.from({ length: triCount }, () => []);
  const rawBlocked: number[][] = Array.from({ length: triCount }, () => []);
  const rawConcave: number[][] = Array.from({ length: triCount }, () => []);
  const rawEdgeLen: number[][] = Array.from({ length: triCount }, () => []);

  const sharpConvexDeg = Math.min(82, creaseAngleDeg * 1.95);

  for (const [eKey, tris] of edgeToTris.entries()) {
    if (tris.length < 2) continue;

    // Recuperar longitud aproximada de la arista compartida usando la raíz de los triángulos
    const wLo = Math.floor(eKey / EDGE_KEY_STRIDE);
    const wHi = eKey - wLo * EDGE_KEY_STRIDE;
    let edgeLength = 1;
    const tSample = tris[0];
    for (let c = 0; c < 3; c++) {
      const idxA = indices[tSample * 3 + c];
      const idxB = indices[tSample * 3 + ((c + 1) % 3)];
      const wa = weldedIds[idxA];
      const wb = weldedIds[idxB];
      if ((wa === wLo && wb === wHi) || (wa === wHi && wb === wLo)) {
        edgeLength = Math.hypot(
          positions[idxB * 3] - positions[idxA * 3],
          positions[idxB * 3 + 1] - positions[idxA * 3 + 1],
          positions[idxB * 3 + 2] - positions[idxA * 3 + 2]
        );
        break;
      }
    }

    // Emparejar triángulos incidentes (en mallas 2-manifold siempre son exactamente 2)
    for (let i = 0; i < tris.length - 1; i++) {
      const tA = tris[i];
      const nAx = normals[tA * 3];
      const nAy = normals[tA * 3 + 1];
      const nAz = normals[tA * 3 + 2];
      const cAx = centroids[tA * 3];
      const cAy = centroids[tA * 3 + 1];
      const cAz = centroids[tA * 3 + 2];

      for (let j = i + 1; j < tris.length; j++) {
        const tB = tris[j];
        const nBx = normals[tB * 3];
        const nBy = normals[tB * 3 + 1];
        const nBz = normals[tB * 3 + 2];
        const cBx = centroids[tB * 3];
        const cBy = centroids[tB * 3 + 1];
        const cBz = centroids[tB * 3 + 2];

        const dot = Math.max(-1, Math.min(1, nAx * nBx + nAy * nBy + nAz * nBz));
        const angleDeg = Math.acos(dot) * (180 / Math.PI);

        // Concavidad simétrica: (cB - cA)·nA + (cA - cB)·nB = (cB - cA)·(nA - nB) > 0
        // Indica que cada cara apunta hacia el semiespacio exterior donde yace su vecina (junta cóncava)
        const dx = cBx - cAx;
        const dy = cBy - cAy;
        const dz = cBz - cAz;
        const concDot = dx * (nAx - nBx) + dy * (nAy - nBy) + dz * (nAz - nBz);
        const isConcave = concDot > 1e-6;

        const isBlocked =
          (isConcave && angleDeg >= creaseAngleDeg) || angleDeg >= sharpConvexDeg;

        rawNeighbors[tA].push(tB);
        rawBlocked[tA].push(isBlocked ? 1 : 0);
        rawConcave[tA].push(isConcave && angleDeg >= creaseAngleDeg ? 1 : 0);
        rawEdgeLen[tA].push(edgeLength);

        rawNeighbors[tB].push(tA);
        rawBlocked[tB].push(isBlocked ? 1 : 0);
        rawConcave[tB].push(isConcave && angleDeg >= creaseAngleDeg ? 1 : 0);
        rawEdgeLen[tB].push(edgeLength);
      }
    }
  }

  return {
    triCount,
    weldedIds,
    normals,
    centroids,
    areas,
    adjNeighbors: rawNeighbors.map((a) => new Int32Array(a)),
    adjBlocked: rawBlocked.map((a) => new Uint8Array(a)),
    adjConcave: rawConcave.map((a) => new Uint8Array(a)),
    adjEdgeLen: rawEdgeLen.map((a) => new Float64Array(a)),
  };
}

/** Información intermedia de una región durante las fases de fusión y clasificación. */
export interface MutableRegion {
  id: number;
  shellId: number;
  tris: number[];
  fromPlanarPatches: boolean;
  area: number;
  centerMm: Vec3;
}

/**
 * Construye el mapa de adyacencia entre regiones activas acumulando la longitud
 * de frontera cóncava vs convexa compartida dentro de la misma cáscara topológica.
 */
export function buildRegionAdjacency(
  triRegion: Int32Array,
  graph: TriangleGraphData
): Map<number, Map<number, { concaveLen: number; totalLen: number }>> {
  const adj = new Map<number, Map<number, { concaveLen: number; totalLen: number }>>();

  for (let t = 0; t < graph.triCount; t++) {
    const rA = triRegion[t];
    const nbrs = graph.adjNeighbors[t];
    const concaves = graph.adjConcave[t];
    const lens = graph.adjEdgeLen[t];

    for (let k = 0; k < nbrs.length; k++) {
      const tB = nbrs[k];
      if (tB <= t) continue;
      const rB = triRegion[tB];
      if (rA === rB) continue;

      const len = lens[k];
      const conc = concaves[k] ? len : 0;

      let mapA = adj.get(rA);
      if (!mapA) {
        mapA = new Map();
        adj.set(rA, mapA);
      }
      const prevA = mapA.get(rB) ?? { concaveLen: 0, totalLen: 0 };
      prevA.concaveLen += conc;
      prevA.totalLen += len;
      mapA.set(rB, prevA);

      let mapB = adj.get(rB);
      if (!mapB) {
        mapB = new Map();
        adj.set(rB, mapB);
      }
      const prevB = mapB.get(rA) ?? { concaveLen: 0, totalLen: 0 };
      prevB.concaveLen += conc;
      prevB.totalLen += len;
      mapB.set(rA, prevB);
    }
  }

  return adj;
}

/**
 * Fusiona la región `srcId` dentro de `dstId` actualizando `triRegion` y las estadísticas de área/centroide.
 */
export function mergeRegionsInto(
  regionsMap: Map<number, MutableRegion>,
  triRegion: Int32Array,
  srcId: number,
  dstId: number
): void {
  if (srcId === dstId) return;
  const src = regionsMap.get(srcId);
  const dst = regionsMap.get(dstId);
  if (!src || !dst) return;

  for (const t of src.tris) {
    triRegion[t] = dstId;
    dst.tris.push(t);
  }
  const totalArea = dst.area + src.area;
  if (totalArea > 1e-12) {
    dst.centerMm = [
      (dst.centerMm[0] * dst.area + src.centerMm[0] * src.area) / totalArea,
      (dst.centerMm[1] * dst.area + src.centerMm[1] * src.area) / totalArea,
      (dst.centerMm[2] * dst.area + src.centerMm[2] * src.area) / totalArea,
    ];
  }
  dst.area = totalArea;
  dst.fromPlanarPatches = dst.fromPlanarPatches && src.fromPlanarPatches;
  regionsMap.delete(srcId);
}

