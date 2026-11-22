/**
 * @file src/engine/structuralSegmentation.ts
 * @description Motor determinístico 100 % local (sin IA externa) de detección, clasificación
 * geométrica, coloreado, extracción sólida con cierre de bucles abiertos, división completa
 * y simetría especular (mirror) para modelos 3D en Kura3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type {
  DetectedStructureRegion,
  MeshData,
  SceneObject,
  SegmentationOptions,
  StructuralArchetype,
  StructuralSegmentationResult,
  Vec3,
} from '../types/kura';
import {
  computeVertexNormals,
  initManifoldEngine,
  manifoldToMeshData,
  meshDataToManifold,
} from './manifoldKernel';
import {
  applyTransformToMesh,
  computeMeshStats,
  normalizeMeshToBed,
} from './primitives';
import { computeMeshFingerprint } from './meshFingerprint';
import { assertRegionFitsMesh, assertSegmentationMatchesMesh } from './segmentationGuards';

/** Paleta de 12 colores de alto contraste para distinguir sub-estructuras y exportar 3MF multicolor. */
export const STRUCTURAL_COLOR_PALETTE: string[] = [
  '#38bdf8', // Azul Kura
  '#f97316', // Naranja PLA
  '#22c55e', // Verde Esmeralda
  '#a855f7', // Violeta
  '#eab308', // Amarillo
  '#ef4444', // Rojo Coral
  '#06b6d4', // Cian
  '#ec4899', // Magenta
  '#84cc16', // Lima
  '#f59e0b', // Ámbar
  '#6366f1', // Índigo
  '#14b8a6', // Turquesa
];

/** Opciones por defecto del algoritmo de detección estructural. */
const DEFAULT_SEGMENTATION_OPTIONS: SegmentationOptions = {
  creaseAngleDeg: 28,
  minRegionPercent: 1.5,
  maxRegions: 12,
};

/** Tolerancia espacial de soldado de vértices en milímetros (1e-4 mm). */
const WELD_TOLERANCE_MM = 1e-4;
const WELD_INV_TOL = 1 / WELD_TOLERANCE_MM;

/** Multiplicador seguro para empaquetar aristas no dirigidas (hasta 67M vértices soldados). */
const EDGE_KEY_STRIDE = 67108864; // 2^26

/**
 * Extrae el centro-base mundial `[cx, minY, cz]` de una malla y devuelve la malla
 * normalizada con centro horizontal (0, 0) y base apoyada en Y = 0.
 */
function extractPositionAndNormalize(mesh: MeshData): {
  mesh: MeshData;
  position: Vec3;
} {
  const vertCount = Math.floor(mesh.positions.length / 3);
  if (vertCount === 0) {
    return { mesh, position: [0, 0, 0] };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }

  return {
    mesh: normalizeMeshToBed(mesh),
    position: [(minX + maxX) * 0.5, minY, (minZ + maxZ) * 0.5],
  };
}

/**
 * Empaqueta dos IDs de vértice soldados en una clave numérica única para aristas no dirigidas.
 */
function undirectedEdgeKey(a: number, b: number): number {
  return a < b ? a * EDGE_KEY_STRIDE + b : b * EDGE_KEY_STRIDE + a;
}

/**
 * Empaqueta dos IDs de vértice soldados en una clave numérica única para semi-aristas dirigidas.
 */
function directedEdgeKey(u: number, v: number): number {
  return u * EDGE_KEY_STRIDE + v;
}

/**
 * Calcula los 3 ejes principales ortonormales (PCA) de una nube ponderada de puntos 3D
 * mediante diagonalización iterativa de Jacobi sobre la matriz de covarianza simétrica 3×3.
 * Permite medir cilindricidad y planaridad de forma invariante a la rotación.
 */
function computePrincipalAxes(
  points: Float64Array,
  weights: Float64Array,
  count: number,
  center: Vec3
): [Vec3, Vec3, Vec3] {
  let cxx = 0;
  let cxy = 0;
  let cxz = 0;
  let cyy = 0;
  let cyz = 0;
  let czz = 0;
  let totalW = 0;

  for (let i = 0; i < count; i++) {
    const w = weights[i];
    if (w <= 0) continue;
    const dx = points[i * 3] - center[0];
    const dy = points[i * 3 + 1] - center[1];
    const dz = points[i * 3 + 2] - center[2];
    cxx += w * dx * dx;
    cxy += w * dx * dy;
    cxz += w * dx * dz;
    cyy += w * dy * dy;
    cyz += w * dy * dz;
    czz += w * dz * dz;
    totalW += w;
  }

  if (totalW <= 1e-12) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  // Matriz simétrica 3x3 A y matriz de autovectores V = I
  const a = [
    [cxx / totalW, cxy / totalW, cxz / totalW],
    [cxy / totalW, cyy / totalW, cyz / totalW],
    [cxz / totalW, cyz / totalW, czz / totalW],
  ];
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  // 15 barridos de rotaciones de Jacobi garantizan convergencia exacta para 3x3
  for (let iter = 0; iter < 15; iter++) {
    let p = 0;
    let q = 1;
    let maxOff = Math.abs(a[0][1]);
    if (Math.abs(a[0][2]) > maxOff) {
      maxOff = Math.abs(a[0][2]);
      p = 0;
      q = 2;
    }
    if (Math.abs(a[1][2]) > maxOff) {
      maxOff = Math.abs(a[1][2]);
      p = 1;
      q = 2;
    }
    if (maxOff < 1e-14) break;

    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];
    const tau = (aqq - app) / (2 * apq);
    const t =
      tau >= 0
        ? 1 / (tau + Math.sqrt(1 + tau * tau))
        : -1 / (-tau + Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    a[p][p] = app - t * apq;
    a[q][q] = aqq + t * apq;
    a[p][q] = 0;
    a[q][p] = 0;

    for (let r = 0; r < 3; r++) {
      if (r !== p && r !== q) {
        const arp = a[r][p];
        const arq = a[r][q];
        a[r][p] = c * arp - s * arq;
        a[p][r] = a[r][p];
        a[r][q] = s * arp + c * arq;
        a[q][r] = a[r][q];
      }
    }

    for (let r = 0; r < 3; r++) {
      const vrp = v[r][p];
      const vrq = v[r][q];
      v[r][p] = c * vrp - s * vrq;
      v[r][q] = s * vrp + c * vrq;
    }
  }

  // Ordenar autovectores por autovalor descendente (eje primario primero)
  const order = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]);
  return order.map((col) => {
    const x = v[0][col];
    const y = v[1][col];
    const z = v[2][col];
    const len = Math.hypot(x, y, z) || 1;
    return [x / len, y / len, z / len] as Vec3;
  }) as [Vec3, Vec3, Vec3];
}

/** Datos geométricos precalculados por triángulo para acelerar grafos y clasificación. */
interface TriangleGraphData {
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
function buildTriangleAdjacencyGraph(
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
interface MutableRegion {
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
function buildRegionAdjacency(
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
function mergeRegionsInto(
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

/**
 * Clasifica geométricamente una región en su arquetipo estructural determinístico
 * y calcula su confianza heurística (0..100).
 */
function classifyRegionArchetype(
  region: MutableRegion,
  mesh: MeshData,
  graph: TriangleGraphData,
  modelBounds: { min: Vec3; max: Vec3; center: Vec3; span: Vec3 },
  isMainBody: boolean
): {
  archetype: StructuralArchetype;
  dimensionsMm: Vec3;
  centerMm: Vec3;
  confidence: number;
} {
  const positions = mesh.positions;
  const indices = mesh.indices;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  const count = region.tris.length;
  const pts = new Float64Array(count * 3);
  const weights = new Float64Array(count);

  let sumNx = 0;
  let sumNy = 0;
  let sumNz = 0;
  let totalArea = 0;

  for (let i = 0; i < count; i++) {
    const t = region.tris[i];
    const w = Math.max(graph.areas[t], 1e-6);
    weights[i] = w;
    totalArea += w;

    const cx = graph.centroids[t * 3];
    const cy = graph.centroids[t * 3 + 1];
    const cz = graph.centroids[t * 3 + 2];
    pts[i * 3] = cx;
    pts[i * 3 + 1] = cy;
    pts[i * 3 + 2] = cz;

    const nx = graph.normals[t * 3];
    const ny = graph.normals[t * 3 + 1];
    const nz = graph.normals[t * 3 + 2];
    sumNx += nx * w;
    sumNy += ny * w;
    sumNz += nz * w;

    for (let c = 0; c < 3; c++) {
      const vIdx = indices[t * 3 + c] * 3;
      const vx = positions[vIdx];
      const vy = positions[vIdx + 1];
      const vz = positions[vIdx + 2];
      if (vx < minX) minX = vx;
      if (vy < minY) minY = vy;
      if (vz < minZ) minZ = vz;
      if (vx > maxX) maxX = vx;
      if (vy > maxY) maxY = vy;
      if (vz > maxZ) maxZ = vz;
    }
  }

  const dx = Math.max(0, maxX - minX);
  const dy = Math.max(0, maxY - minY);
  const dz = Math.max(0, maxZ - minZ);
  const dimensionsMm: Vec3 = [dx, dy, dz];
  const centerMm: Vec3 = region.centerMm;

  const sorted = [dx, dy, dz].sort((a, b) => b - a);
  const d1 = sorted[0];
  const d2 = sorted[1];
  const d3 = sorted[2];
  const elongation = d1 / Math.max(d2, 0.01);
  const flatness = d3 / Math.max(d2, 0.01);

  const [u1, u2, u3] = computePrincipalAxes(pts, weights, count, centerMm);

  // Planaridad: fracción del área superficial cuyas normales están alineadas a <= 18° de algún eje principal o cartesiano.
  // Una caja o placa tiene ~1.0; un cilindro tiene ~0.40-0.52; una esfera tiene ~0.15-0.25.
  let globalAlignedArea = 0;
  let pcaAlignedArea = 0;
  for (let i = 0; i < count; i++) {
    const t = region.tris[i];
    const w = weights[i];
    const nx = graph.normals[t * 3];
    const ny = graph.normals[t * 3 + 1];
    const nz = graph.normals[t * 3 + 2];

    const gMax = Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz));
    if (gMax >= 0.95) {
      globalAlignedArea += w;
    }

    const a1 = Math.abs(nx * u1[0] + ny * u1[1] + nz * u1[2]);
    const a2 = Math.abs(nx * u2[0] + ny * u2[1] + nz * u2[2]);
    const a3 = Math.abs(nx * u3[0] + ny * u3[1] + nz * u3[2]);
    if (Math.max(a1, a2, a3) >= 0.95) {
      pcaAlignedArea += w;
    }
  }
  const planarity = Math.max(
    globalAlignedArea / Math.max(totalArea, 1e-6),
    pcaAlignedArea / Math.max(totalArea, 1e-6)
  );

  // Esfericidad: evaluamos dispersión radial y alineación normal-radial respecto a 3 centros candidatos
  const bboxCenter: Vec3 = [
    (minX + maxX) * 0.5,
    (minY + maxY) * 0.5,
    (minZ + maxZ) * 0.5,
  ];
  const meanNLen = Math.hypot(sumNx, sumNy, sumNz) || 1;
  const meanN: Vec3 = [sumNx / meanNLen, sumNy / meanNLen, sumNz / meanNLen];
  const domeCenter: Vec3 = [
    bboxCenter[0] - meanN[0] * d3 * 0.25,
    bboxCenter[1] - meanN[1] * d3 * 0.25,
    bboxCenter[2] - meanN[2] * d3 * 0.25,
  ];

  let bestSphericity = 0;
  for (const cand of [centerMm, bboxCenter, domeCenter]) {
    let meanR = 0;
    let radialDotSum = 0;
    const dists = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const t = region.tris[i];
      const rx = pts[i * 3] - cand[0];
      const ry = pts[i * 3 + 1] - cand[1];
      const rz = pts[i * 3 + 2] - cand[2];
      const dist = Math.hypot(rx, ry, rz);
      dists[i] = dist;
      meanR += dist * weights[i];
      if (dist > 1e-6) {
        const dot =
          (rx * graph.normals[t * 3] +
            ry * graph.normals[t * 3 + 1] +
            rz * graph.normals[t * 3 + 2]) /
          dist;
        radialDotSum += Math.max(0, dot) * weights[i];
      }
    }
    meanR /= Math.max(totalArea, 1e-6);
    const radialDot = radialDotSum / Math.max(totalArea, 1e-6);

    let varR = 0;
    for (let i = 0; i < count; i++) {
      const diff = dists[i] - meanR;
      varR += diff * diff * weights[i];
    }
    const stdR = Math.sqrt(varR / Math.max(totalArea, 1e-6));
    const cvR = stdR / Math.max(meanR, 1e-4);
    const score = Math.max(0, Math.min(1, (1 - cvR) * radialDot));
    if (score > bestSphericity) {
      bestSphericity = score;
    }
  }

  // Cilindricidad: ajuste analítico de centro circular (cx, cy, R) en el plano (u2, u3)
  // perpendicular al eje primario u1; funciona con precisión tanto en cilindros completos
  // como en arcos parciales de cilindros unidos a otro sólido (p. ej. tanques o tubos).
  let barrelArea = 0;
  let meanU2 = 0;
  let meanU3 = 0;
  let meanN2 = 0;
  let meanN3 = 0;
  const barrelFlag = new Uint8Array(count);
  const projU2 = new Float64Array(count);
  const projU3 = new Float64Array(count);
  const normU2 = new Float64Array(count);
  const normU3 = new Float64Array(count);

  for (let i = 0; i < count; i++) {
    const t = region.tris[i];
    const w = weights[i];
    const nx = graph.normals[t * 3];
    const ny = graph.normals[t * 3 + 1];
    const nz = graph.normals[t * 3 + 2];
    const axialAlign = Math.abs(nx * u1[0] + ny * u1[1] + nz * u1[2]);
    if (axialAlign > 0.85) continue;

    const dxp = pts[i * 3] - centerMm[0];
    const dyp = pts[i * 3 + 1] - centerMm[1];
    const dzp = pts[i * 3 + 2] - centerMm[2];
    const p2 = dxp * u2[0] + dyp * u2[1] + dzp * u2[2];
    const p3 = dxp * u3[0] + dyp * u3[1] + dzp * u3[2];

    const rawN2 = nx * u2[0] + ny * u2[1] + nz * u2[2];
    const rawN3 = nx * u3[0] + ny * u3[1] + nz * u3[2];
    const nPerpLen = Math.hypot(rawN2, rawN3);
    if (nPerpLen < 1e-4) continue;
    const n2 = rawN2 / nPerpLen;
    const n3 = rawN3 / nPerpLen;

    barrelFlag[i] = 1;
    projU2[i] = p2;
    projU3[i] = p3;
    normU2[i] = n2;
    normU3[i] = n3;
    barrelArea += w;
    meanU2 += p2 * w;
    meanU3 += p3 * w;
    meanN2 += n2 * w;
    meanN3 += n3 * w;
  }

  let cylindricality = 0;
  if (barrelArea > 0.25 * totalArea) {
    meanU2 /= barrelArea;
    meanU3 /= barrelArea;
    meanN2 /= barrelArea;
    meanN3 /= barrelArea;

    let numR = 0;
    let denR = 0;
    for (let i = 0; i < count; i++) {
      if (!barrelFlag[i]) continue;
      const w = weights[i];
      const du2 = projU2[i] - meanU2;
      const du3 = projU3[i] - meanU3;
      const dn2 = normU2[i] - meanN2;
      const dn3 = normU3[i] - meanN3;
      numR += w * (du2 * dn2 + du3 * dn3);
      denR += w * (dn2 * dn2 + dn3 * dn3);
    }

    const fittedR = denR > 1e-8 ? numR / denR : 0;
    const cx2 = meanU2 - fittedR * meanN2;
    const cy3 = meanU3 - fittedR * meanN3;

    let meanDist = 0;
    let cylDotSum = 0;
    const perpDists = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      if (!barrelFlag[i]) continue;
      const w = weights[i];
      const rx = projU2[i] - cx2;
      const ry = projU3[i] - cy3;
      const r = Math.hypot(rx, ry);
      perpDists[i] = r;
      meanDist += r * w;
      if (r > 1e-6) {
        const dot = Math.max(0, (rx * normU2[i] + ry * normU3[i]) / r);
        cylDotSum += dot * w;
      }
    }

    meanDist /= barrelArea;
    const cylDot = cylDotSum / barrelArea;
    let varPerpR = 0;
    for (let i = 0; i < count; i++) {
      if (!barrelFlag[i]) continue;
      const diff = perpDists[i] - meanDist;
      varPerpR += diff * diff * weights[i];
    }
    const stdPerpR = Math.sqrt(varPerpR / barrelArea);
    const cvPerpR = stdPerpR / Math.max(meanDist, 1e-4);
    cylindricality = Math.max(0, Math.min(1, (1 - cvPerpR * 2.0) * cylDot));
  }

  if (isMainBody) {
    return {
      archetype: 'main_body',
      dimensionsMm,
      centerMm,
      confidence: 92,
    };
  }

  const modelMaxDim = Math.max(
    modelBounds.span[0],
    modelBounds.span[1],
    modelBounds.span[2],
    1
  );
  const thinCrossSection = d2 <= modelMaxDim * 0.18;

  if (
    (elongation >= 2.6 && thinCrossSection && (cylindricality >= 0.55 || planarity <= 0.72)) ||
    (elongation >= 3.4 && cylindricality >= 0.6)
  ) {
    return {
      archetype: 'tube_conduit',
      dimensionsMm,
      centerMm,
      confidence: Math.round(78 + Math.min(20, cylindricality * 20)),
    };
  }

  if (
    cylindricality >= 0.62 &&
    elongation >= 1.25 &&
    elongation < 3.2 &&
    planarity <= 0.75
  ) {
    return {
      archetype: 'tank_cylinder',
      dimensionsMm,
      centerMm,
      confidence: Math.round(76 + Math.min(22, cylindricality * 22)),
    };
  }

  if (
    bestSphericity >= 0.65 &&
    elongation < 1.65 &&
    flatness >= 0.45 &&
    planarity <= 0.72
  ) {
    const upperBonus = centerMm[1] > modelBounds.center[1] ? 8 : 0;
    return {
      archetype: 'dome_helmet',
      dimensionsMm,
      centerMm,
      confidence: Math.min(98, Math.round(70 + bestSphericity * 20 + upperBonus)),
    };
  }

  if (planarity > 0.72 || flatness < 0.25) {
    return {
      archetype: 'block_plate',
      dimensionsMm,
      centerMm,
      confidence: Math.round(74 + planarity * 20),
    };
  }

  if (elongation >= 1.85) {
    return {
      archetype: 'appendage',
      dimensionsMm,
      centerMm,
      confidence: 75,
    };
  }

  return {
    archetype: 'detail_part',
    dimensionsMm,
    centerMm,
    confidence: 68,
  };
}

/** Tablas de nombres base en español e inglés por arquetipo estructural. */
const ARCHETYPE_LABELS: Record<
  StructuralArchetype,
  { es: string; en: string; feminineEs: boolean }
> = {
  main_body: { es: 'Cuerpo principal', en: 'Main body', feminineEs: false },
  tank_cylinder: { es: 'Tanque / Cilindro', en: 'Tank / Cylinder', feminineEs: false },
  tube_conduit: { es: 'Tubo / Conducto', en: 'Tube / Conduit', feminineEs: false },
  dome_helmet: { es: 'Cúpula / Escafandra', en: 'Dome / Helmet', feminineEs: true },
  block_plate: { es: 'Bloque / Placa', en: 'Block / Plate', feminineEs: false },
  appendage: { es: 'Extremidad / Apéndice', en: 'Appendage / Limb', feminineEs: true },
  detail_part: { es: 'Sub-estructura', en: 'Sub-structure', feminineEs: true },
};

/**
 * Genera el calificativo posicional en español e inglés según la ubicación relativa
 * de la sub-estructura respecto al centro envolvente del modelo completo.
 */
function computePositionalQualifier(
  center: Vec3,
  modelCenter: Vec3,
  modelSpan: Vec3,
  feminineEs: boolean
): { es: string; en: string } | null {
  const relX = (center[0] - modelCenter[0]) / Math.max(modelSpan[0], 1);
  const relY = (center[1] - modelCenter[1]) / Math.max(modelSpan[1], 1);
  const relZ = (center[2] - modelCenter[2]) / Math.max(modelSpan[2], 1);

  if (relY > 0.22) return { es: 'superior', en: 'upper' };
  if (relY < -0.22) return { es: 'inferior', en: 'lower' };
  if (relX < -0.15) return { es: feminineEs ? 'izquierda' : 'izquierdo', en: 'left' };
  if (relX > 0.15) return { es: feminineEs ? 'derecha' : 'derecho', en: 'right' };
  if (relZ < -0.18) return { es: 'posterior', en: 'rear' };
  if (relZ > 0.18) return { es: 'frontal', en: 'front' };
  return null;
}

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
  const creaseAngleDeg = Math.max(
    5,
    Math.min(85, options?.creaseAngleDeg ?? DEFAULT_SEGMENTATION_OPTIONS.creaseAngleDeg)
  );
  const minRegionPercent = Math.max(
    0.1,
    Math.min(25, options?.minRegionPercent ?? DEFAULT_SEGMENTATION_OPTIONS.minRegionPercent)
  );
  const maxRegions = Math.max(
    1,
    Math.min(32, Math.round(options?.maxRegions ?? DEFAULT_SEGMENTATION_OPTIONS.maxRegions))
  );

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

  // Determinar si cada cáscara tiene una única región (isla física completa)
  const regionsPerShell = new Map<number, number>();
  for (const reg of regionsMap.values()) {
    regionsPerShell.set(reg.shellId, (regionsPerShell.get(reg.shellId) ?? 0) + 1);
  }

  // Elegir el cuerpo principal por mayor área superficial (evitando placas base muy planas si hay alternativas)
  const regionList = Array.from(regionsMap.values()).sort((a, b) => b.area - a.area);
  let mainBodyRegionId = regionList[0]?.id ?? -1;
  if (regionList.length > 1) {
    for (const candidate of regionList) {
      const prelim = classifyRegionArchetype(
        candidate,
        mesh,
        graph,
        modelBounds,
        false
      );
      const sortedExt = [...prelim.dimensionsMm].sort((a, b) => b - a);
      const flat = sortedExt[2] / Math.max(sortedExt[1], 0.01);
      const isFlatBase =
        flat < 0.22 && prelim.centerMm[1] < modelBounds.min[1] + 0.25 * modelBounds.span[1];
      if (!isFlatBase) {
        mainBodyRegionId = candidate.id;
        break;
      }
    }
  }

  // 5. Clasificar todas las regiones, etiquetar y asignar colores de alto contraste
  interface RawClassified {
    reg: MutableRegion;
    archetype: StructuralArchetype;
    dimensionsMm: Vec3;
    centerMm: Vec3;
    confidence: number;
    baseEs: string;
    baseEn: string;
    isDisconnectedShell: boolean;
  }

  const classified: RawClassified[] = regionList.map((reg) => {
    const isMain = reg.id === mainBodyRegionId;
    const info = classifyRegionArchetype(reg, mesh, graph, modelBounds, isMain);
    const meta = ARCHETYPE_LABELS[info.archetype];
    const qualifier =
      info.archetype === 'main_body'
        ? null
        : computePositionalQualifier(
            info.centerMm,
            modelBounds.center,
            modelBounds.span,
            meta.feminineEs
          );

    const baseEs = qualifier ? `${meta.es} ${qualifier.es}` : meta.es;
    const baseEn = qualifier ? `${meta.en} (${qualifier.en})` : meta.en;

    return {
      reg,
      archetype: info.archetype,
      dimensionsMm: info.dimensionsMm,
      centerMm: info.centerMm,
      confidence: info.confidence,
      baseEs,
      baseEn,
      isDisconnectedShell: (regionsPerShell.get(reg.shellId) ?? 1) === 1 && shellTriangles.length > 1,
    };
  });

  // Numerar duplicados de forma limpia (ej. "Tanque / Cilindro 1", "Tanque / Cilindro 2")
  const labelCounts = new Map<string, number>();
  for (const item of classified) {
    labelCounts.set(item.baseEs, (labelCounts.get(item.baseEs) ?? 0) + 1);
  }
  const labelSeen = new Map<string, number>();

  const finalRegions: DetectedStructureRegion[] = classified.map((item, idx) => {
    const totalSame = labelCounts.get(item.baseEs) ?? 1;
    let labelEs = item.baseEs;
    let labelEn = item.baseEn;
    if (totalSame > 1) {
      const seq = (labelSeen.get(item.baseEs) ?? 0) + 1;
      labelSeen.set(item.baseEs, seq);
      labelEs = `${item.baseEs} ${seq}`;
      labelEn = `${item.baseEn} ${seq}`;
    }

    const triIndices = [...item.reg.tris].sort((a, b) => a - b);
    const color = STRUCTURAL_COLOR_PALETTE[idx % STRUCTURAL_COLOR_PALETTE.length];

    return {
      id: `${obj.id}_region_${idx + 1}`,
      labelEs,
      labelEn,
      archetype: item.archetype,
      color,
      faceIndices: triIndices,
      triangleCount: triIndices.length,
      percentOfModel: Number(((triIndices.length / totalTriangles) * 100).toFixed(2)),
      dimensionsMm: item.dimensionsMm,
      centerMm: item.centerMm,
      confidence: item.confidence,
      isDisconnectedShell: item.isDisconnectedShell,
    };
  });

  return {
    objectId: obj.id,
    method: 'shells_and_creases',
    totalTriangles,
    regions: finalRegions,
    meshFingerprint: computeMeshFingerprint(mesh),
  };
}

/**
 * Pinta cada triángulo de `mesh.faceColors` con el color hexadecimal de la región estructural
 * detectada a la que pertenece, dejando la malla lista para inspección visual y exportación 3MF multicolor.
 *
 * @param mesh Malla origen en formato Kura3D.
 * @param segmentation Resultado devuelto por `detectStructuralRegions`.
 * @returns Nueva instancia `MeshData` con `faceColors` poblado para todos sus triángulos.
 */
export function applyStructureColorsToMesh(
  mesh: MeshData,
  segmentation: StructuralSegmentationResult
): MeshData {
  assertSegmentationMatchesMesh(mesh, segmentation);
  const triCount = Math.floor(mesh.indices.length / 3);
  const fallbackColor = segmentation.regions[0]?.color ?? STRUCTURAL_COLOR_PALETTE[0];
  const faceColors = new Array<string>(triCount).fill(fallbackColor);

  for (const region of segmentation.regions) {
    for (const triIdx of region.faceIndices) {
      if (triIdx >= 0 && triIdx < triCount) {
        faceColors[triIdx] = region.color;
      }
    }
  }

  return {
    positions: new Float32Array(mesh.positions),
    indices: new Uint32Array(mesh.indices),
    ...(mesh.normals ? { normals: new Float32Array(mesh.normals) } : {}),
    faceColors,
  };
}

/**
 * Compacta un subconjunto de triángulos soldando sus vértices por posición (1e-4 mm)
 * y cierra automáticamente cualquier bucle de aristas abiertas mediante abanico al centroide
 * (centroid-fan boundary capping) para generar un sólido 3D cerrado y con volumen positivo.
 */
function buildClosedSubMesh(
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
async function sanitizeWithManifoldIfValid(mesh: MeshData): Promise<MeshData> {
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

/**
 * Extrae una sub-estructura detectada como un objeto 3D sólido independiente.
 * - Si proviene de una cáscara desconectada, la extrae de forma exacta.
 * - Si proviene de una malla única fusionada, cierra cada bucle de frontera abierta
 *   mediante tapas en abanico al centroide con orientación saliente consistente.
 * - Si `removeFromSource` es true, calcula además la malla remanente cerrada (con respaldo seguro).
 *
 * @param obj Objeto de escena origen.
 * @param region Sub-estructura detectada a extraer.
 * @param removeFromSource Si es true, devuelve también la geometría remanente sin la región extraída.
 * @returns Malla extraída normalizada a cama con su posición mundial y remanente opcional.
 */
export async function extractStructuralRegion(
  obj: SceneObject,
  region: DetectedStructureRegion,
  removeFromSource = false
): Promise<{
  extracted: { mesh: MeshData; position: Vec3 };
  remainder?: { mesh: MeshData; position: Vec3 } | null;
}> {
  const totalTris = Math.floor(obj.mesh.indices.length / 3);
  assertRegionFitsMesh(region, totalTris);

  const localExtracted = buildClosedSubMesh(
    obj.mesh,
    region.faceIndices,
    region.color,
    false,
    region.color
  );
  const sanitizedExtracted = region.isDisconnectedShell
    ? await sanitizeWithManifoldIfValid(localExtracted)
    : localExtracted;

  const worldExtracted = applyTransformToMesh(
    sanitizedExtracted,
    obj.position,
    obj.rotation,
    obj.scale
  );
  const extracted = extractPositionAndNormalize(worldExtracted);

  let remainder: { mesh: MeshData; position: Vec3 } | null | undefined;
  if (removeFromSource) {
    const selectedSet = new Set(region.faceIndices);
    const remainingTris: number[] = [];
    for (let t = 0; t < totalTris; t++) {
      if (!selectedSet.has(t)) {
        remainingTris.push(t);
      }
    }

    if (remainingTris.length === 0) {
      remainder = null;
    } else {
      const localRemainder = buildClosedSubMesh(
        obj.mesh,
        remainingTris,
        obj.color,
        Boolean(obj.mesh.faceColors?.length),
        obj.color
      );
      const stats = computeMeshStats(localRemainder);
      if (stats.triangles > 0 && stats.volumeMm3 > 1e-6) {
        const sanitizedRemainder = await sanitizeWithManifoldIfValid(localRemainder);
        const worldRemainder = applyTransformToMesh(
          sanitizedRemainder,
          obj.position,
          obj.rotation,
          obj.scale
        );
        remainder = extractPositionAndNormalize(worldRemainder);
      } else {
        remainder = null;
      }
    }
  }

  return removeFromSource ? { extracted, remainder } : { extracted };
}

/**
 * Extrae todas las sub-estructuras detectadas en `segmentation` como objetos independientes
 * listos para añadir a la escena con sus etiquetas bilingües, colores y posiciones mundiales.
 *
 * @param obj Objeto de escena origen.
 * @param segmentation Resultado previo de `detectStructuralRegions`.
 * @returns Arreglo de piezas independientes listas para escena.
 */
export async function splitAllDetectedStructures(
  obj: SceneObject,
  segmentation: StructuralSegmentationResult
): Promise<
  Array<{
    labelEs: string;
    labelEn: string;
    color: string;
    mesh: MeshData;
    position: Vec3;
  }>
> {
  const parts: Array<{
    labelEs: string;
    labelEn: string;
    color: string;
    mesh: MeshData;
    position: Vec3;
  }> = [];

  assertSegmentationMatchesMesh(obj.mesh, segmentation);
  for (const region of segmentation.regions) {
    const { extracted } = await extractStructuralRegion(obj, region, false);
    const triCount = Math.floor(extracted.mesh.indices.length / 3);
    if (triCount === 0) continue;

    parts.push({
      labelEs: region.labelEs,
      labelEn: region.labelEn,
      color: region.color,
      mesh: {
        ...extracted.mesh,
        faceColors: new Array(triCount).fill(region.color),
      },
      position: extracted.position,
    });
  }

  return parts;
}

/**
 * Refleja (espeja) una malla respecto a uno de los ejes cartesianos ('x', 'y' o 'z'),
 * invierte el orden de devanado `(i0, i2, i1)` de cada triángulo para preservar normales
 * salientes y condición 2-manifold watertight, conserva `faceColors` y re-normaliza a cama (Y >= 0).
 *
 * @param mesh Malla de entrada en formato Kura3D.
 * @param axis Eje de simetría especular ('x', 'y' o 'z').
 * @returns Nueva malla reflejada, cerrada y apoyada sobre la cama.
 */
export function mirrorMeshAxis(mesh: MeshData, axis: 'x' | 'y' | 'z'): MeshData {
  const vertCount = Math.floor(mesh.positions.length / 3);
  const triCount = Math.floor(mesh.indices.length / 3);

  if (vertCount === 0 || triCount === 0) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      ...(mesh.normals ? { normals: new Float32Array(0) } : {}),
      ...(mesh.faceColors ? { faceColors: [] } : {}),
    };
  }

  const positions = new Float32Array(mesh.positions);
  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  for (let v = 0; v < vertCount; v++) {
    positions[v * 3 + axisIdx] = -positions[v * 3 + axisIdx];
  }

  // Invertir devanado (i0, i1, i2) -> (i0, i2, i1) tras la reflexión para mantener volumen positivo y cierre 2-manifold
  const indices = new Uint32Array(mesh.indices);
  for (let t = 0; t < triCount; t++) {
    const tmp = indices[t * 3 + 1];
    indices[t * 3 + 1] = indices[t * 3 + 2];
    indices[t * 3 + 2] = tmp;
  }

  const normals = computeVertexNormals(positions, indices);
  const mirrored: MeshData = {
    positions,
    indices,
    normals,
    ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
  };

  return normalizeMeshToBed(mirrored);
}
