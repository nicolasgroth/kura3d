/**
 * @file src/engine/refine.ts
 * @description Refinamiento por longitud de arista con suavizado que conserva la forma:
 * `Manifold.smoothOut` mantiene aristas vivas (> 52.5°) y caras planas de ≥3 triángulos;
 * antes se subdividen las caras planas de 1–2 triángulos acotadas por aristas vivas (caras
 * de cubos y placas), que de otro modo se hunden. Tras suavizar se verifica que las
 * dimensiones exteriores (en mm de mundo) no cambien más que `DIM_TOLERANCE_MM`; si cambian,
 * se revierte al refinado plano y se devuelve un aviso. La longitud efectiva y cualquier
 * ajuste se informan como avisos tipados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type { MeshData, SceneObject } from '../types/kura';
import { engineWarning, requireOperationRange, type EngineWarning } from './engineErrors';
import { OPERATION_RANGES } from './operationLimits';
import {
  createColorRegistry,
  initManifoldEngine,
  manifoldToMeshData,
  meshDataToManifold,
} from './manifoldKernel';
import { normalizeMeshToBed } from './primitives';

/** Tolerancia de cambio de dimensiones exteriores al suavizar (mm de mundo). */
export const DIM_TOLERANCE_MM = 0.1;
/** Tope de triángulos estimados tras refinar. */
export const REFINE_MAX_TRIANGLES = 120_000;
/** Ángulo diedro (grados) sobre el cual una arista se considera viva y no se suaviza. */
const SHARP_ANGLE_DEG = 52.5;

/** Resultado detallado del refinamiento. */
export interface RefineResult {
  mesh: MeshData;
  /** Longitud de arista pedida (mm de mundo). */
  requestedEdgeMm: number;
  /** Longitud de arista realmente usada (mm de mundo). */
  effectiveEdgeMm: number;
  /** Si el suavizado quedó aplicado en el resultado. */
  smoothApplied: boolean;
  trianglesBefore: number;
  trianglesAfter: number;
  warnings: EngineWarning[];
}

/** Área total y arista más larga de una malla. */
function meshAreaAndMaxEdge(mesh: MeshData): { area: number; maxEdge: number } {
  const p = mesh.positions;
  let area = 0;
  let maxEdge = 0;
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    const a = mesh.indices[t * 3] * 3, b = mesh.indices[t * 3 + 1] * 3, c = mesh.indices[t * 3 + 2] * 3;
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
    const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
    area += 0.5 * Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x);
    maxEdge = Math.max(
      maxEdge,
      Math.hypot(e1x, e1y, e1z),
      Math.hypot(e2x, e2y, e2z),
      Math.hypot(p[c] - p[b], p[c + 1] - p[b + 1], p[c + 2] - p[b + 2])
    );
  }
  return { area, maxEdge };
}

/**
 * Inserta el centroide en los triángulos de regiones planas pequeñas (1–2 triángulos)
 * completamente rodeadas por aristas vivas, para que `smoothOut` las mantenga planas.
 */
export function splitSmallSharpFlatFaces(mesh: MeshData): MeshData {
  const P = mesh.positions;
  const I = mesh.indices;
  const triCount = I.length / 3;
  const normals = new Float64Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
    const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1;
    normals[t * 3] = nx / l;
    normals[t * 3 + 1] = ny / l;
    normals[t * 3 + 2] = nz / l;
  }
  const halfedge = new Map<string, number>();
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) halfedge.set(`${I[t * 3 + k]}_${I[t * 3 + ((k + 1) % 3)]}`, t);
  }
  const parent = Array.from({ length: triCount }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  const sharpCos = Math.cos((SHARP_ANGLE_DEG * Math.PI) / 180);
  const hasSharpBorder = new Uint8Array(triCount);
  const hasSmoothBorder = new Uint8Array(triCount);
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const o = halfedge.get(`${I[t * 3 + ((k + 1) % 3)]}_${I[t * 3 + k]}`);
      if (o === undefined) continue;
      const d = normals[t * 3] * normals[o * 3] + normals[t * 3 + 1] * normals[o * 3 + 1] + normals[t * 3 + 2] * normals[o * 3 + 2];
      if (d > 1 - 1e-9) parent[find(o)] = find(t);
      else if (d < sharpCos) hasSharpBorder[t] = 1;
      else hasSmoothBorder[t] = 1;
    }
  }
  const regionSize = new Map<number, number>();
  const regionSmooth = new Set<number>();
  for (let t = 0; t < triCount; t++) {
    const r = find(t);
    regionSize.set(r, (regionSize.get(r) ?? 0) + 1);
    if (hasSmoothBorder[t]) regionSmooth.add(r);
  }
  const positions = Array.from(P);
  const indices: number[] = [];
  const faceColors: string[] | undefined = mesh.faceColors ? [] : undefined;
  for (let t = 0; t < triCount; t++) {
    const r = find(t);
    const color = mesh.faceColors?.[t];
    const [a, b, c] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]];
    if ((regionSize.get(r) ?? 0) < 3 && !regionSmooth.has(r) && hasSharpBorder[t]) {
      const m = positions.length / 3;
      positions.push(
        (P[a * 3] + P[b * 3] + P[c * 3]) / 3,
        (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3,
        (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3
      );
      indices.push(a, b, m, b, c, m, c, a, m);
      if (faceColors && color) faceColors.push(color, color, color);
    } else {
      indices.push(a, b, c);
      if (faceColors && color) faceColors.push(color);
    }
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    ...(faceColors && faceColors.length === indices.length / 3 ? { faceColors } : {}),
  };
}

/** Dimensiones de la caja envolvente de un Manifold escaladas a mundo. */
function worldDims(m: Manifold, scale: number[]): number[] {
  const b = m.boundingBox();
  return [0, 1, 2].map((a) => (b.max[a] - b.min[a]) * scale[a]);
}

/**
 * Refina (y opcionalmente suaviza sin deformar) la malla de `obj`.
 *
 * @param targetEdgeLengthMm Longitud de arista objetivo en mm de mundo.
 * @param smooth Suavizado conservador de forma.
 */
export async function refineMeshDetailed(
  obj: SceneObject,
  targetEdgeLengthMm: number,
  smooth = false
): Promise<RefineResult> {
  const requested = requireOperationRange('targetEdgeLengthMm', targetEdgeLengthMm, OPERATION_RANGES.refine.targetEdgeLengthMm);
  const scale = obj.scale.map((s) => Math.abs(s) || 1);
  const maxScale = Math.max(...scale);
  const warnings: EngineWarning[] = [];

  const { area, maxEdge } = meshAreaAndMaxEdge(obj.mesh);
  const worldArea = area * maxScale * maxScale;
  // triángulos ≈ área / (0.433·L²) ⇒ L mínima para no superar REFINE_MAX_TRIANGLES
  const safeMinWorld = Math.sqrt(Math.max(1, worldArea) / (0.433 * REFINE_MAX_TRIANGLES));
  const effectiveWorld = Math.max(requested, safeMinWorld);
  if (effectiveWorld > requested * 1.0001) {
    warnings.push(
      engineWarning('REFINE_LENGTH_CLAMPED', {
        requested,
        effective: effectiveWorld,
        maxTriangles: REFINE_MAX_TRIANGLES,
      })
    );
  }
  const localLen = effectiveWorld / maxScale;
  const trianglesBefore = obj.mesh.indices.length / 3;

  const wasm = await initManifoldEngine();
  const registry = obj.mesh.faceColors?.length
    ? createColorRegistry(wasm, [{ color: obj.color, faceColors: obj.mesh.faceColors }])
    : null;
  const handles: Manifold[] = [];
  const own = <T extends Manifold>(m: T): T => {
    handles.push(m);
    return m;
  };

  try {
    const base = own(meshDataToManifold(wasm, obj.mesh, registry?.colorToId, obj.color));
    const flatRefined = own(base.refineToLength(localLen));
    let result = flatRefined;
    let smoothApplied = false;

    if (smooth) {
      const prepared = own(
        meshDataToManifold(wasm, splitSmallSharpFlatFaces(manifoldToMeshData(base, registry?.idToColor)), registry?.colorToId, obj.color)
      );
      const smoothed = own(own(prepared.smoothOut(SHARP_ANGLE_DEG, 0)).refineToLength(localLen));
      const before = worldDims(base, scale);
      const after = worldDims(smoothed, scale);
      const deviation = Math.max(...before.map((d, a) => Math.abs(after[a] - d)));
      const volumeRatio = smoothed.volume() / Math.max(1e-9, base.volume());
      // Además de las dimensiones, un cambio de volumen fuera de [−8 %, +12 %] delata caras hundidas o infladas
      if (deviation <= DIM_TOLERANCE_MM && volumeRatio > 0.92 && volumeRatio < 1.12) {
        result = smoothed;
        smoothApplied = true;
      } else {
        warnings.push(
          engineWarning('REFINE_SMOOTH_REVERTED', { deviation, tolerance: DIM_TOLERANCE_MM })
        );
      }
    }

    const mesh = normalizeMeshToBed(manifoldToMeshData(result, registry?.idToColor));
    const trianglesAfter = mesh.indices.length / 3;
    if (!smoothApplied && maxEdge * maxScale <= effectiveWorld * 1.0001) {
      warnings.push(engineWarning('REFINE_NO_CHANGE', { edge: effectiveWorld, triangles: trianglesBefore }));
    }
    return {
      mesh,
      requestedEdgeMm: requested,
      effectiveEdgeMm: effectiveWorld,
      smoothApplied,
      trianglesBefore,
      trianglesAfter,
      warnings,
    };
  } finally {
    for (const h of handles) h.delete();
  }
}
