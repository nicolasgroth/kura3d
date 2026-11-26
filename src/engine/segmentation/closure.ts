/**
 * @file src/engine/segmentation/closure.ts
 * @description Compactado de un subconjunto de triángulos en un sólido cerrado (soldado, tapas en abanico al centroide, orientación saliente) y saneado opcional con Manifold.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import type { MeshData } from '../../types/kura';
import { computeVertexNormals, initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { WELD_INV_TOL } from './constants';
import { directedEdgeKey } from './geometryUtils';

/**
 * Compacta un subconjunto de triángulos soldando sus vértices por posición (1e-4 mm)
 * y cierra automáticamente cualquier bucle de aristas abiertas mediante abanico al centroide
 * (centroid-fan boundary capping) para generar un sólido 3D cerrado y con volumen positivo.
 */
export function buildClosedSubMesh(
  sourceMesh: MeshData,
  triIndices: number[],
  capColor: string,
  preserveOriginalFaceColors: boolean,
  fallbackFaceColor: string
): MeshData {
  const posMap = new Map<string, number>();
  const newPositions: number[] = [];
  const newIndices: number[] = [];
  const newFaceColors: string[] = [];

  const getWeldedIndex = (origVertIdx: number): number => {
    const x = sourceMesh.positions[origVertIdx * 3];
    const y = sourceMesh.positions[origVertIdx * 3 + 1];
    const z = sourceMesh.positions[origVertIdx * 3 + 2];
    const key = `${Math.round(x * WELD_INV_TOL)},${Math.round(y * WELD_INV_TOL)},${Math.round(z * WELD_INV_TOL)}`;
    let mapped = posMap.get(key);
    if (mapped === undefined) {
      mapped = newPositions.length / 3;
      posMap.set(key, mapped);
      newPositions.push(x, y, z);
    }
    return mapped;
  };

  // 1. Remapear triángulos seleccionados a vértices soldados
  const halfEdgeCounts = new Map<number, number>();
  const halfEdgeList: Array<[number, number]> = [];

  for (const t of triIndices) {
    const a = getWeldedIndex(sourceMesh.indices[t * 3]);
    const b = getWeldedIndex(sourceMesh.indices[t * 3 + 1]);
    const c = getWeldedIndex(sourceMesh.indices[t * 3 + 2]);
    if (a === b || b === c || c === a) continue;

    newIndices.push(a, b, c);
    const col = preserveOriginalFaceColors
      ? sourceMesh.faceColors?.[t] ?? fallbackFaceColor
      : capColor;
    newFaceColors.push(col);

    const edges: [number, number][] = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [u, v] of edges) {
      const k = directedEdgeKey(u, v);
      halfEdgeCounts.set(k, (halfEdgeCounts.get(k) ?? 0) + 1);
      halfEdgeList.push([u, v]);
    }
  }

  // 2. Detectar semi-aristas de frontera abierta (u -> v sin opuesta v -> u)
  const openAdj = new Map<number, number[]>();
  let openEdgeCount = 0;

  for (const [u, v] of halfEdgeList) {
    const fwd = halfEdgeCounts.get(directedEdgeKey(u, v)) ?? 0;
    const rev = halfEdgeCounts.get(directedEdgeKey(v, u)) ?? 0;
    if (fwd > rev) {
      // Consumimos una ocurrencia para no duplicar si hubiera bordes múltiples
      halfEdgeCounts.set(directedEdgeKey(u, v), fwd - 1);
      let list = openAdj.get(u);
      if (!list) {
        list = [];
        openAdj.set(u, list);
      }
      list.push(v);
      openEdgeCount++;
    }
  }

  // 3. Cerrar cada bucle abierto con tapa en abanico al centroide del bucle
  if (openEdgeCount > 0) {
    for (const [startU, outList] of openAdj.entries()) {
      while (outList.length > 0) {
        const firstV = outList.pop()!;
        const loopVerts: number[] = [startU, firstV];
        let curr = firstV;
        let guard = 0;

        while (curr !== startU && guard <= openEdgeCount + 2) {
          guard++;
          const nexts = openAdj.get(curr);
          if (!nexts || nexts.length === 0) break;
          curr = nexts.pop()!;
          loopVerts.push(curr);
        }

        const isClosedLoop = loopVerts.length >= 4 && loopVerts[loopVerts.length - 1] === startU;
        const uniqueVerts = isClosedLoop ? loopVerts.slice(0, -1) : loopVerts;
        if (uniqueVerts.length < 3) continue;

        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (const vid of uniqueVerts) {
          cx += newPositions[vid * 3];
          cy += newPositions[vid * 3 + 1];
          cz += newPositions[vid * 3 + 2];
        }
        const invN = 1 / uniqueVerts.length;
        const centerIdx = newPositions.length / 3;
        newPositions.push(cx * invN, cy * invN, cz * invN);

        const segCount = isClosedLoop ? uniqueVerts.length : uniqueVerts.length - 1;
        for (let k = 0; k < segCount; k++) {
          const u = uniqueVerts[k];
          const v = uniqueVerts[(k + 1) % uniqueVerts.length];
          if (u === v || u === centerIdx || v === centerIdx) continue;
          // La malla existente tiene arista u -> v; la tapa usa v -> u para mantener orientación saliente
          newIndices.push(centerIdx, v, u);
          newFaceColors.push(capColor);
        }
      }
    }
  }

  // 4. Verificar volumen con signo positivo (corrigiendo devanado si la malla venía invertida)
  let signedVol6 = 0;
  const finalTriCount = Math.floor(newIndices.length / 3);
  for (let t = 0; t < finalTriCount; t++) {
    const i0 = newIndices[t * 3] * 3;
    const i1 = newIndices[t * 3 + 1] * 3;
    const i2 = newIndices[t * 3 + 2] * 3;
    const x0 = newPositions[i0];
    const y0 = newPositions[i0 + 1];
    const z0 = newPositions[i0 + 2];
    const x1 = newPositions[i1];
    const y1 = newPositions[i1 + 1];
    const z1 = newPositions[i1 + 2];
    const x2 = newPositions[i2];
    const y2 = newPositions[i2 + 1];
    const z2 = newPositions[i2 + 2];
    signedVol6 +=
      x0 * (y1 * z2 - z1 * y2) +
      y0 * (z1 * x2 - x1 * z2) +
      z0 * (x1 * y2 - y1 * x2);
  }

  const indicesArr = new Uint32Array(newIndices);
  if (signedVol6 < 0) {
    for (let t = 0; t < finalTriCount; t++) {
      const tmp = indicesArr[t * 3 + 1];
      indicesArr[t * 3 + 1] = indicesArr[t * 3 + 2];
      indicesArr[t * 3 + 2] = tmp;
    }
  }

  const positionsArr = new Float32Array(newPositions);
  const normalsArr = computeVertexNormals(positionsArr, indicesArr);

  return {
    positions: positionsArr,
    indices: indicesArr,
    normals: normalsArr,
    faceColors: newFaceColors,
  };
}

/**
 * Intenta validar y normalizar una malla cerrada a través de Manifold WASM para garantizar
 * limpieza topológica cuando es posible, devolviendo la malla original si Manifold la rechaza.
 */
export async function sanitizeWithManifoldIfValid(mesh: MeshData): Promise<MeshData> {
  if (mesh.indices.length < 12) return mesh;
  const wasm = await initManifoldEngine();
  let manifold: Manifold | null = null;
  try {
    manifold = meshDataToManifold(wasm, mesh);
    if (!manifold.isEmpty() && manifold.numTri() > 0) {
      const clean = manifoldToMeshData(manifold);
      if (mesh.faceColors && mesh.faceColors.length > 0) {
        const unique = new Set(mesh.faceColors);
        if (unique.size === 1) {
          const singleColor = mesh.faceColors[0];
          clean.faceColors = new Array(Math.floor(clean.indices.length / 3)).fill(
            singleColor
          );
        }
      }
      return clean;
    }
  } catch {
    // Respaldo seguro: si la geometría cerrada por abanico tiene auto-intersecciones menores,
    // devolvemos directamente la malla ya cerrada sin interrumpir al usuario.
  } finally {
    manifold?.delete();
  }
  return mesh;
}
