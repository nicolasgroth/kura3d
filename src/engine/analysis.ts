/**
 * @file src/engine/analysis.ts
 * @description Validador estructural de imprimibilidad 3D (detección de voladizos críticos,
 * ajuste en cama, objetos flotantes, peso realista por material PBR y longitud de filamento),
 * simplificación topológica, refinamiento/suavizado adaptativo y envolvente convexa (Convex Hull)
 * sobre el núcleo Manifold-3D en Kura3D Pro v3.0.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import {
  MATERIAL_PRESETS,
  type MaterialPresetId,
  type MeshData,
  type PrintabilityReport,
  type PrinterProfile,
  type SceneObject,
  type Vec3,
} from '../types/kura';
import {
  createColorRegistry,
  initManifoldEngine,
  manifoldToMeshData,
  meshDataToManifold,
} from './manifoldKernel';
import {
  applyTransformToMesh,
  computeMeshStats,
  normalizeMeshToBed,
} from './primitives';

/**
 * Extrae el centro-base mundial `[cx, minY, cz]` de una malla y normaliza sus
 * coordenadas locales a Y=0 centrado en XZ.
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
 * Calcula el área superficial total (en mm²) de una malla triangular para acotar
 * con seguridad la densidad máxima durante el refinamiento adaptativo.
 */
function computeMeshSurfaceArea(mesh: MeshData): number {
  const triCount = Math.floor(mesh.indices.length / 3);
  let area = 0;
  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3] * 3;
    const i1 = mesh.indices[t * 3 + 1] * 3;
    const i2 = mesh.indices[t * 3 + 2] * 3;

    const e1x = mesh.positions[i1] - mesh.positions[i0];
    const e1y = mesh.positions[i1 + 1] - mesh.positions[i0 + 1];
    const e1z = mesh.positions[i1 + 2] - mesh.positions[i0 + 2];

    const e2x = mesh.positions[i2] - mesh.positions[i0];
    const e2y = mesh.positions[i2 + 1] - mesh.positions[i0 + 1];
    const e2z = mesh.positions[i2 + 2] - mesh.positions[i0 + 2];

    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    area += 0.5 * Math.hypot(cx, cy, cz);
  }
  return area;
}

/**
 * Ejecuta un análisis completo de imprimibilidad 3D en espacio mundial para `obj`
 * frente al perfil de impresora `bed`, estimando:
 * - Cierre topológico 2-manifold (`isManifold`).
 * - Encaje físico dentro del volumen de construcción (`fitsInBed`).
 * - Contacto con la cama de impresión (`isFloating` cuando `minYWorldMm > 0.25`).
 * - Escaneo de voladizos críticos por normal mundial (`ny < -cos(overhangAngleDeg)`),
 *   excluyendo las caras inferiores apoyadas directamente sobre la base (`y <= minY + 0.2`).
 * - Volumen en cm³, peso estimado realista (perímetros + relleno) y metros de filamento 1.75 mm.
 * - Puntuación global de imprimibilidad `0..100` y advertencias claras en español.
 *
 * @param obj Objeto de escena a validar.
 * @param bed Perfil de impresora 3D destino.
 * @param materialId Material PBR para densidad (por defecto `'pla_matte'`).
 * @param infillPercent Porcentaje de relleno 0..100 (por defecto 20%).
 * @param overhangAngleDeg Ángulo crítico de voladizo en grados desde la vertical (por defecto 45°).
 * @returns Informe detallado `PrintabilityReport`.
 */
export function analyzePrintability(
  obj: SceneObject,
  bed: PrinterProfile,
  materialId: MaterialPresetId = 'pla_matte',
  infillPercent = 20,
  overhangAngleDeg = 45
): PrintabilityReport {
  const worldMesh = applyTransformToMesh(
    obj.mesh,
    obj.position,
    obj.rotation,
    obj.scale
  );
  const stats = computeMeshStats(worldMesh);

  const vertCount = Math.floor(worldMesh.positions.length / 3);
  const triCount = Math.floor(worldMesh.indices.length / 3);

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertCount; i++) {
    const x = worldMesh.positions[i * 3];
    const y = worldMesh.positions[i * 3 + 1];
    const z = worldMesh.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  if (vertCount === 0) {
    minX = minY = minZ = maxX = maxY = maxZ = 0;
  }

  const halfW = bed.bedWidthMm * 0.5;
  const halfD = bed.bedDepthMm * 0.5;
  const eps = 0.05;

  const fitsInBed =
    minX >= -halfW - eps &&
    maxX <= halfW + eps &&
    minZ >= -halfD - eps &&
    maxZ <= halfD + eps &&
    minY >= -eps &&
    maxY <= bed.maxHeightMm + eps;

  const isFloating = minY > 0.25;

  // Umbral del componente Y de la normal saliente para detectar voladizos descendentes
  const nyThreshold = -Math.cos((overhangAngleDeg * Math.PI) / 180);
  const overhangFaceIndices: number[] = [];
  const baseCutoffY = minY + 0.2;

  for (let t = 0; t < triCount; t++) {
    const i0 = worldMesh.indices[t * 3] * 3;
    const i1 = worldMesh.indices[t * 3 + 1] * 3;
    const i2 = worldMesh.indices[t * 3 + 2] * 3;

    const y0 = worldMesh.positions[i0 + 1];
    const y1 = worldMesh.positions[i1 + 1];
    const y2 = worldMesh.positions[i2 + 1];

    // Excluir caras planas apoyadas directamente sobre la base/cama del objeto
    if (y0 <= baseCutoffY && y1 <= baseCutoffY && y2 <= baseCutoffY) {
      continue;
    }

    const e1x = worldMesh.positions[i1] - worldMesh.positions[i0];
    const e1y = y1 - y0;
    const e1z = worldMesh.positions[i1 + 2] - worldMesh.positions[i0 + 2];

    const e2x = worldMesh.positions[i2] - worldMesh.positions[i0];
    const e2y = y2 - y0;
    const e2z = worldMesh.positions[i2 + 2] - worldMesh.positions[i0 + 2];

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);

    if (len > 1e-12 && ny / len < nyThreshold) {
      overhangFaceIndices.push(t);
    }
  }

  const overhangFaceCount = overhangFaceIndices.length;
  const overhangPercent =
    triCount > 0 ? (overhangFaceCount / triCount) * 100 : 0;

  // Cálculo realista de peso (perímetros/tapas ~22% sólido + interior según % infill)
  const preset = MATERIAL_PRESETS[materialId] ?? MATERIAL_PRESETS.pla_matte;
  const clampedInfill = Math.max(0, Math.min(100, infillPercent)) / 100;
  const effectiveFillRatio = Math.min(1, 0.22 + 0.78 * clampedInfill);
  const volumeCm3 = stats.volumeMm3 / 1000;
  const effectiveVolumeCm3 = volumeCm3 * effectiveFillRatio;
  const estimatedWeightGrams = effectiveVolumeCm3 * preset.densityGCm3;

  // Longitud de filamento estándar de 1.75 mm (sección transversal = π * 0.875² ≈ 2.40528 mm²)
  const filamentAreaMm2 = Math.PI * 0.875 * 0.875;
  const effectiveVolumeMm3 = effectiveVolumeCm3 * 1000;
  const estimatedFilamentMeters = effectiveVolumeMm3 / filamentAreaMm2 / 1000;

  const densityQuality: PrintabilityReport['densityQuality'] =
    triCount < 100 ? 'low' : triCount > 50000 ? 'high' : 'optimal';

  const warnings: string[] = [];
  let score = 100;

  if (!stats.isManifold) {
    warnings.push(
      'La malla no es cerrada (no-manifold); puede presentar huecos o errores al laminar.'
    );
    score -= 35;
  }

  if (!fitsInBed) {
    warnings.push(
      `El objeto excede los límites de impresión (${bed.bedWidthMm}×${bed.bedDepthMm}×${bed.maxHeightMm} mm).`
    );
    score -= 25;
  }

  if (isFloating) {
    warnings.push(
      `El objeto está flotando a ${minY.toFixed(2)} mm sobre la cama de impresión.`
    );
    score -= 20;
  }

  if (overhangPercent > 5) {
    warnings.push(
      `Se detectó ${overhangPercent.toFixed(1)}% de caras en voladizo (> ${overhangAngleDeg}°); considere activar soportes.`
    );
  }
  score -= Math.min(25, Math.round(overhangPercent * 0.55));

  if (densityQuality === 'low') {
    warnings.push(
      'Baja densidad poligonal (< 100 triángulos); las curvas pueden lucir facetadas.'
    );
  } else if (densityQuality === 'high') {
    warnings.push(
      'Malla muy densa (> 50 000 triángulos); considere simplificar para agilizar el laminado.'
    );
  }

  score = Math.max(0, Math.min(100, score));

  return {
    objectId: obj.id,
    isManifold: stats.isManifold,
    fitsInBed,
    isFloating,
    minYWorldMm: minY,
    overhangFaceCount,
    overhangPercent,
    overhangFaceIndices,
    overhangAngleDeg,
    volumeCm3,
    estimatedWeightGrams,
    estimatedFilamentMeters,
    triangleCount: triCount,
    densityQuality,
    warnings,
    score,
  };
}

/**
 * Reduce la densidad poligonal de un objeto mediante decimación topológica nativa
 * `manifold.simplify(toleranceMm)`, garantizando una malla cerrada watertight y
 * preservando `faceColors` cuando existen.
 *
 * @param obj Objeto de escena a simplificar (opera sobre su malla local).
 * @param toleranceMm Tolerancia máxima de desviación geométrica en milímetros (mín. 0.01 mm).
 * @returns Malla simplificada watertight normalizada a cama.
 */
export async function simplifyMesh(
  obj: SceneObject,
  toleranceMm: number
): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const tol = Math.max(0.01, toleranceMm);
  const registry = obj.mesh.faceColors?.length
    ? createColorRegistry(wasm, [
        { color: obj.color, faceColors: obj.mesh.faceColors },
      ])
    : null;

  let manifold: Manifold | null = null;
  let simplified: Manifold | null = null;

  try {
    manifold = meshDataToManifold(
      wasm,
      obj.mesh,
      registry?.colorToId,
      obj.color
    );
    simplified = manifold.simplify(tol);
    const outMesh = manifoldToMeshData(simplified, registry?.idToColor);
    return normalizeMeshToBed(outMesh);
  } finally {
    manifold?.delete();
    simplified?.delete();
  }
}

/**
 * Refina y opcionalmente suaviza una malla usando interpolación cúbica de tangentes
 * (`Manifold.smooth`) combinada con subdivisión por longitud de arista (`refineToLength`),
 * acotando automáticamente la longitud mínima para evitar explosiones por encima de ~80k triángulos.
 *
 * @param obj Objeto de escena origen (opera sobre su malla local).
 * @param targetEdgeLengthMm Longitud objetivo de arista en milímetros.
 * @param smooth Si es true (por defecto), suaviza tangentes antes de subdividir.
 * @returns Malla refinada watertight normalizada a cama.
 */
export async function refineMesh(
  obj: SceneObject,
  targetEdgeLengthMm: number,
  smooth = true
): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const area = computeMeshSurfaceArea(obj.mesh);
  // Límite seguro para que triCount ~ area / (0.433 * L²) no supere ~80 000 triángulos
  const safeMinLength = Math.sqrt(Math.max(1, area) / 30000);
  const edgeLen = Math.max(0.5, targetEdgeLengthMm, safeMinLength);

  const registry = obj.mesh.faceColors?.length
    ? createColorRegistry(wasm, [
        { color: obj.color, faceColors: obj.mesh.faceColors },
      ])
    : null;

  let base: Manifold | null = null;
  let smoothed: Manifold | null = null;
  let refined: Manifold | null = null;

  try {
    base = meshDataToManifold(wasm, obj.mesh, registry?.colorToId, obj.color);
    if (smooth) {
      const rawMesh = base.getMesh();
      smoothed = wasm.Manifold.smooth(rawMesh);
      refined = smoothed.refineToLength(edgeLen);
    } else {
      refined = base.refineToLength(edgeLen);
    }

    const outMesh = manifoldToMeshData(refined, registry?.idToColor);
    return normalizeMeshToBed(outMesh);
  } finally {
    base?.delete();
    smoothed?.delete();
    refined?.delete();
  }
}

/**
 * Calcula la envolvente convexa (Convex Hull) 3D cerrada de uno o más objetos de escena
 * en sus posiciones y orientaciones mundiales actuales, devolviendo la malla centrada
 * en XZ sobre Y=0 junto con su posición mundial `[cx, minY, cz]`.
 *
 * @param objects Lista no vacía de objetos de escena a envolver.
 * @returns Malla hull watertight y su posición mundial.
 */
export async function computeConvexHull(
  objects: SceneObject[]
): Promise<{ mesh: MeshData; position: Vec3 }> {
  if (objects.length === 0) {
    throw new Error(
      'Se requiere al menos un objeto para calcular la envolvente convexa.'
    );
  }

  const wasm = await initManifoldEngine();
  const manifolds: Manifold[] = [];
  let hullManifold: Manifold | null = null;

  try {
    for (const obj of objects) {
      const worldMesh = applyTransformToMesh(
        obj.mesh,
        obj.position,
        obj.rotation,
        obj.scale
      );
      manifolds.push(meshDataToManifold(wasm, worldMesh, undefined, obj.color));
    }

    hullManifold = wasm.Manifold.hull(manifolds);
    if (hullManifold.isEmpty() || hullManifold.numTri() === 0) {
      throw new Error('El cálculo de envolvente convexa produjo una malla vacía.');
    }

    const outMesh = manifoldToMeshData(hullManifold);
    return extractPositionAndNormalize(outMesh);
  } finally {
    for (const m of manifolds) {
      m.delete();
    }
    hullManifold?.delete();
  }
}
