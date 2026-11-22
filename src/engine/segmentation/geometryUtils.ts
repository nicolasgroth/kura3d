/**
 * @file src/engine/segmentation/geometryUtils.ts
 * @description Utilidades geométricas de la segmentación: normalización a cama con posición mundial, claves de aristas y ejes principales (PCA por Jacobi).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { normalizeMeshToBed } from '../primitives';
import { EDGE_KEY_STRIDE } from './constants';

/**
 * Extrae el centro-base mundial `[cx, minY, cz]` de una malla y devuelve la malla
 * normalizada con centro horizontal (0, 0) y base apoyada en Y = 0.
 */
export function extractPositionAndNormalize(mesh: MeshData): {
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
export function undirectedEdgeKey(a: number, b: number): number {
  return a < b ? a * EDGE_KEY_STRIDE + b : b * EDGE_KEY_STRIDE + a;
}

/**
 * Empaqueta dos IDs de vértice soldados en una clave numérica única para semi-aristas dirigidas.
 */
export function directedEdgeKey(u: number, v: number): number {
  return u * EDGE_KEY_STRIDE + v;
}

/**
 * Calcula los 3 ejes principales ortonormales (PCA) de una nube ponderada de puntos 3D
 * mediante diagonalización iterativa de Jacobi sobre la matriz de covarianza simétrica 3×3.
 * Permite medir cilindricidad y planaridad de forma invariante a la rotación.
 */
export function computePrincipalAxes(
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

