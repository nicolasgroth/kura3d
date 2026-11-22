/**
 * @file src/engine/segmentation/detection.ts
 * @description Detección determinística de sub-estructuras: cáscaras topológicas, crecimiento de regiones por costuras cóncavas y diedros agudos, fusión de ruido, límite de regiones y absorción de regiones de grosor cero.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type {
  SceneObject,
  SegmentationOptions,
  StructuralSegmentationResult,
  Vec3,
} from '../../types/kura';
import { computeMeshFingerprint } from '../meshFingerprint';
import { requireOperationRange } from '../engineErrors';
import { OPERATION_RANGES } from '../operationLimits';
import {
  buildRegionAdjacency,
  buildTriangleAdjacencyGraph,
  mergeRegionsInto,
  type MutableRegion,
} from './adjacency';
import { DEFAULT_SEGMENTATION_OPTIONS } from './constants';
import { labelStructuralRegions } from './labeling';
import { absorbNegligibleRegions } from './negligibleRegions';

/**
 * Detecta y clasifica de forma 100 % determinística local las sub-estructuras geométricas
 * de un modelo 3D (cuerpo principal, tanques cilíndricos, tubos, cúpulas/cascos, placas, etc.)
 * combinando análisis de cáscaras topológicas y crecimiento de regiones delimitado por
 * costuras cóncavas y pliegues diedros agudos.
 *
 * @param obj Objeto de escena a analizar (opera sobre su malla local en mm).
 * @param options Opciones opcionales de sensibilidad angular, tamaño mínimo y máximo de regiones.
 * @returns Resultado completo con regiones etiquetadas, coloreadas e índices de triángulos.
 */
export async function detectStructuralRegions(
  obj: SceneObject,
  options?: Partial<SegmentationOptions>
): Promise<StructuralSegmentationResult> {
  // Rangos de la fuente única: un valor fuera de rango es error tipado, no un recorte silencioso.
  const R = OPERATION_RANGES.detect;
  const D = DEFAULT_SEGMENTATION_OPTIONS;
  const creaseAngleDeg = requireOperationRange('creaseAngleDeg', options?.creaseAngleDeg, R.creaseAngleDeg, D.creaseAngleDeg);
  const minRegionPercent = requireOperationRange('minRegionPercent', options?.minRegionPercent, R.minRegionPercent, D.minRegionPercent);
  const maxRegions = requireOperationRange('maxRegions', options?.maxRegions, R.maxRegions, D.maxRegions);

  const mesh = obj.mesh;
  const totalTriangles = Math.floor(mesh.indices.length / 3);
  if (totalTriangles === 0 || mesh.positions.length === 0) {
    return {
      objectId: obj.id,
      method: 'shells_and_creases',
      totalTriangles: 0,
      regions: [],
      meshFingerprint: computeMeshFingerprint(mesh),
    };
  }

  // 1. Grafo de adyacencia de triángulos con soldado de vértices a 1e-4 mm
  const graph = buildTriangleAdjacencyGraph(mesh, creaseAngleDeg);

  // 2. Identificación de cáscaras topológicas desconectadas (BFS sin bloqueo angular)
  const shellOfTri = new Int32Array(totalTriangles).fill(-1);
  const shellTriangles: number[][] = [];
  const queue = new Int32Array(totalTriangles);

  for (let seed = 0; seed < totalTriangles; seed++) {
    if (shellOfTri[seed] !== -1) continue;
    const sId = shellTriangles.length;
    const list: number[] = [];
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    shellOfTri[seed] = sId;

    while (head < tail) {
      const cur = queue[head++];
      list.push(cur);
      const nbrs = graph.adjNeighbors[cur];
      for (let k = 0; k < nbrs.length; k++) {
        const nxt = nbrs[k];
        if (shellOfTri[nxt] === -1) {
          shellOfTri[nxt] = sId;
          queue[tail++] = nxt;
        }
      }
    }
    shellTriangles.push(list);
  }

  // 3. Crecimiento de regiones por costuras cóncavas y diedros agudos dentro de cada cáscara
  const triRegion = new Int32Array(totalTriangles).fill(-1);
  const regionsMap = new Map<number, MutableRegion>();
  let nextRegionId = 0;

  for (let sId = 0; sId < shellTriangles.length; sId++) {
    const trisInShell = shellTriangles[sId];
    for (const seed of trisInShell) {
      if (triRegion[seed] !== -1) continue;
      const rId = nextRegionId++;
      const rTris: number[] = [];
      let head = 0;
      let tail = 0;
      queue[tail++] = seed;
      triRegion[seed] = rId;

      let sumArea = 0;
      let cx = 0;
      let cy = 0;
      let cz = 0;
      let sumNx = 0;
      let sumNy = 0;
      let sumNz = 0;

      while (head < tail) {
        const cur = queue[head++];
        rTris.push(cur);
        const w = Math.max(graph.areas[cur], 1e-6);
        sumArea += w;
        cx += graph.centroids[cur * 3] * w;
        cy += graph.centroids[cur * 3 + 1] * w;
        cz += graph.centroids[cur * 3 + 2] * w;
        sumNx += graph.normals[cur * 3] * w;
        sumNy += graph.normals[cur * 3 + 1] * w;
        sumNz += graph.normals[cur * 3 + 2] * w;

        const nbrs = graph.adjNeighbors[cur];
        const blocked = graph.adjBlocked[cur];
        for (let k = 0; k < nbrs.length; k++) {
          if (blocked[k]) continue;
          const nxt = nbrs[k];
          if (triRegion[nxt] === -1) {
            triRegion[nxt] = rId;
            queue[tail++] = nxt;
          }
        }
      }

      // Evaluar si este parche inicial es plano (todas las normales alineadas)
      const nLen = Math.hypot(sumNx, sumNy, sumNz) || 1;
      const mnx = sumNx / nLen;
      const mny = sumNy / nLen;
      const mnz = sumNz / nLen;
      let coherenceSum = 0;
      for (const t of rTris) {
        const w = Math.max(graph.areas[t], 1e-6);
        const dot =
          graph.normals[t * 3] * mnx +
          graph.normals[t * 3 + 1] * mny +
          graph.normals[t * 3 + 2] * mnz;
        coherenceSum += dot * w;
      }
      const normalCoherence = coherenceSum / Math.max(sumArea, 1e-6);

      regionsMap.set(rId, {
        id: rId,
        shellId: sId,
        tris: rTris,
        fromPlanarPatches: normalCoherence >= 0.96,
        area: sumArea,
        centerMm: [cx / sumArea, cy / sumArea, cz / sumArea],
      });
    }
  }

  // 3b. Reensamblaje limpio de caras planas puramente convexas (cajas, bloques y tapas de cilindros)
  // Pass A: Unir parches planos adyacentes cuyas fronteras compartidas NO contengan costura cóncava
  {
    let changed = true;
    while (changed) {
      changed = false;
      const adj = buildRegionAdjacency(triRegion, graph);
      for (const [rA, nbrMap] of adj.entries()) {
        const regA = regionsMap.get(rA);
        if (!regA || !regA.fromPlanarPatches) continue;
        for (const [rB, edgeStats] of nbrMap.entries()) {
          if (rB <= rA) continue;
          const regB = regionsMap.get(rB);
          if (!regB || !regB.fromPlanarPatches) continue;
          if (edgeStats.concaveLen <= 0.02 * edgeStats.totalLen) {
            mergeRegionsInto(regionsMap, triRegion, rB, rA);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
  }

  // Pass B: Unir tapas planas terminales (discos superior/inferior de cilindros o tubos) a su barril envolvente.
  // Una tapa de cilindro puede tocar al cuerpo principal por una costura cóncava y a su barril por un borde convexo,
  // por lo que evaluamos que siga siendo un único plano y tenga un único vecino convexo curvo dominante.
  {
    const isCurrentlySinglePlane = (reg: MutableRegion): boolean => {
      let snx = 0;
      let sny = 0;
      let snz = 0;
      let sa = 0;
      for (const t of reg.tris) {
        const w = Math.max(graph.areas[t], 1e-6);
        sa += w;
        snx += graph.normals[t * 3] * w;
        sny += graph.normals[t * 3 + 1] * w;
        snz += graph.normals[t * 3 + 2] * w;
      }
      const len = Math.hypot(snx, sny, snz) || 1;
      const mx = snx / len;
      const my = sny / len;
      const mz = snz / len;
      let coh = 0;
      for (const t of reg.tris) {
        const w = Math.max(graph.areas[t], 1e-6);
        coh +=
          (graph.normals[t * 3] * mx +
            graph.normals[t * 3 + 1] * my +
            graph.normals[t * 3 + 2] * mz) *
          w;
      }
      return coh / Math.max(sa, 1e-6) >= 0.96;
    };

    let changed = true;
    while (changed) {
      changed = false;
      const adj = buildRegionAdjacency(triRegion, graph);
      for (const [rCap, nbrMap] of adj.entries()) {
        const regCap = regionsMap.get(rCap);
        if (!regCap || !regCap.fromPlanarPatches || !isCurrentlySinglePlane(regCap)) {
          continue;
        }

        let totalBoundary = 0;
        let totalConvexBoundary = 0;
        let bestTarget = -1;
        let bestConvexLen = 0;

        for (const [rNbr, stats] of nbrMap.entries()) {
          totalBoundary += stats.totalLen;
          const convexLen = Math.max(0, stats.totalLen - stats.concaveLen);
          if (stats.concaveLen <= 0.02 * stats.totalLen) {
            totalConvexBoundary += convexLen;
            const targetReg = regionsMap.get(rNbr);
            if (targetReg && !targetReg.fromPlanarPatches && convexLen > bestConvexLen) {
              bestConvexLen = convexLen;
              bestTarget = rNbr;
            }
          }
        }

        if (
          bestTarget !== -1 &&
          bestConvexLen >= 0.9 * Math.max(totalConvexBoundary, 1e-6) &&
          bestConvexLen >= 0.45 * Math.max(totalBoundary, 1e-6)
        ) {
          mergeRegionsInto(regionsMap, triRegion, rCap, bestTarget);
          changed = true;
          break;
        }
      }
    }
  }

  // 4. Fusión de ruido: absorber regiones pequeñas bajo el umbral en su vecino adyacente más grande
  const minTris = Math.max(4, Math.floor(totalTriangles * (minRegionPercent / 100)));
  {
    let merged = true;
    while (merged) {
      merged = false;
      const adj = buildRegionAdjacency(triRegion, graph);
      let smallestId = -1;
      let smallestTris = Infinity;

      for (const [rId, reg] of regionsMap.entries()) {
        if (reg.tris.length >= minTris) continue;
        const nbrs = adj.get(rId);
        if (!nbrs || nbrs.size === 0) continue;
        if (reg.tris.length < smallestTris) {
          smallestTris = reg.tris.length;
          smallestId = rId;
        }
      }

      if (smallestId !== -1) {
        const nbrs = adj.get(smallestId)!;
        let largestNbr = -1;
        let largestCount = -1;
        for (const nbrId of nbrs.keys()) {
          const nbrReg = regionsMap.get(nbrId);
          if (nbrReg && nbrReg.tris.length > largestCount) {
            largestCount = nbrReg.tris.length;
            largestNbr = nbrId;
          }
        }
        if (largestNbr !== -1) {
          mergeRegionsInto(regionsMap, triRegion, smallestId, largestNbr);
          merged = true;
        }
      }
    }
  }

  // Limitar cantidad máxima de regiones fusionando primero vecinos adyacentes más pequeños
  while (regionsMap.size > maxRegions) {
    const adj = buildRegionAdjacency(triRegion, graph);
    let candidateId = -1;
    let candidateTris = Infinity;

    for (const [rId, reg] of regionsMap.entries()) {
      const nbrs = adj.get(rId);
      if (nbrs && nbrs.size > 0 && reg.tris.length < candidateTris) {
        candidateTris = reg.tris.length;
        candidateId = rId;
      }
    }

    if (candidateId !== -1) {
      const nbrs = adj.get(candidateId)!;
      let largestNbr = -1;
      let largestCount = -1;
      for (const nbrId of nbrs.keys()) {
        const nbrReg = regionsMap.get(nbrId);
        if (nbrReg && nbrReg.tris.length > largestCount) {
          largestCount = nbrReg.tris.length;
          largestNbr = nbrId;
        }
      }
      if (largestNbr !== -1) {
        mergeRegionsInto(regionsMap, triRegion, candidateId, largestNbr);
        continue;
      }
    }

    // Respaldo si existen más de maxRegions cáscaras totalmente desconectadas
    const sorted = Array.from(regionsMap.values()).sort(
      (a, b) => a.tris.length - b.tris.length
    );
    const smallest = sorted[0];
    let nearestId = sorted[1].id;
    let bestDist = Infinity;
    for (let i = 1; i < sorted.length; i++) {
      const other = sorted[i];
      const d = Math.hypot(
        other.centerMm[0] - smallest.centerMm[0],
        other.centerMm[1] - smallest.centerMm[1],
        other.centerMm[2] - smallest.centerMm[2]
      );
      if (d < bestDist) {
        bestDist = d;
        nearestId = other.id;
      }
    }
    mergeRegionsInto(regionsMap, triRegion, smallest.id, nearestId);
  }

  // Calcular bounding box global local del modelo
  let mMinX = Infinity;
  let mMinY = Infinity;
  let mMinZ = Infinity;
  let mMaxX = -Infinity;
  let mMaxY = -Infinity;
  let mMaxZ = -Infinity;
  const vertCount = Math.floor(mesh.positions.length / 3);
  for (let v = 0; v < vertCount; v++) {
    const x = mesh.positions[v * 3];
    const y = mesh.positions[v * 3 + 1];
    const z = mesh.positions[v * 3 + 2];
    if (x < mMinX) mMinX = x;
    if (y < mMinY) mMinY = y;
    if (z < mMinZ) mMinZ = z;
    if (x > mMaxX) mMaxX = x;
    if (y > mMaxY) mMaxY = y;
    if (z > mMaxZ) mMaxZ = z;
  }

  const modelBounds = {
    min: [mMinX, mMinY, mMinZ] as Vec3,
    max: [mMaxX, mMaxY, mMaxZ] as Vec3,
    center: [
      (mMinX + mMaxX) * 0.5,
      (mMinY + mMaxY) * 0.5,
      (mMinZ + mMaxZ) * 0.5,
    ] as Vec3,
    span: [mMaxX - mMinX, mMaxY - mMinY, mMaxZ - mMinZ] as Vec3,
  };

  // 5. Sin partes de grosor cero ni volumen despreciable (caras planas sueltas): se funden en su vecina.
  absorbNegligibleRegions(mesh, graph, regionsMap, triRegion, modelBounds.span);

  const finalRegions = labelStructuralRegions(
    obj,
    mesh,
    graph,
    modelBounds,
    regionsMap,
    shellTriangles.length,
    totalTriangles
  );

  return {
    objectId: obj.id,
    method: 'shells_and_creases',
    totalTriangles,
    regions: finalRegions,
    meshFingerprint: computeMeshFingerprint(mesh),
  };
}
