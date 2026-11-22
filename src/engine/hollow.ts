/**
 * @file src/engine/hollow.ts
 * @description Ahuecado (hollow shell) con pared uniforme real: la cavidad es el offset
 * interior exacto (`solidOffset.ts`) calculado en unidades de mundo (respeta `obj.scale`),
 * se verifica que ninguna zona quede más delgada que el espesor pedido (pared perforada)
 * y los orificios de drenaje se ubican en el punto más bajo de cada cavidad real.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type { HollowOptions, MeshData, SceneObject } from '../types/kura';
import {
  EngineError,
  engineWarning,
  requireNumberInRange,
  requireOperationRange,
  type EngineWarning,
} from './engineErrors';
import { OPERATION_RANGES } from './operationLimits';
import {
  createColorRegistry,
  initManifoldEngine,
  manifoldToMeshData,
  meshDataToManifold,
} from './manifoldKernel';
import { applyTransformToMesh, normalizeMeshToBed } from './primitives';
import {
  distanceFieldOfManifold,
  inwardOffset,
  lowestPoint,
  measureWallThickness,
  type WallThicknessStats,
} from './solidOffset';

/** Resultado detallado del ahuecado. */
export interface HollowResult {
  /** Malla hueca en espacio local del objeto, normalizada a cama. */
  mesh: MeshData;
  /** Espesor de pared medido en mm de mundo (entre cavidad y exterior). */
  wall: WallThicknessStats;
  /** Volumen de la cavidad en mm³ de mundo. */
  cavityVolumeMm3: number;
  /** Cantidad de cavidades independientes (cada una recibe su drenaje). */
  cavityCount: number;
  warnings: EngineWarning[];
}

/** Copia defensiva de la malla cuando el ahuecado está desactivado. */
function cloneMesh(mesh: MeshData): MeshData {
  return {
    positions: new Float32Array(mesh.positions),
    indices: new Uint32Array(mesh.indices),
    ...(mesh.normals ? { normals: new Float32Array(mesh.normals) } : {}),
    ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
  };
}

/**
 * Crea una carcasa hueca watertight con pared uniforme `options.wallThickness` (mm de mundo).
 *
 * @throws EngineError `HOLLOW_WALL_TOO_THICK` si no cabe ninguna cavidad,
 *   `HOLLOW_WALL_BREACH` si la verificación detecta pared más delgada que la pedida,
 *   `INVALID_PARAMETER` ante espesor/radio no finitos o fuera de rango.
 */
export async function hollowMeshDetailed(
  obj: SceneObject,
  options: HollowOptions
): Promise<HollowResult> {
  const t = requireOperationRange('wallThickness', options.wallThickness, OPERATION_RANGES.hollow.wallThickness);
  const scale = obj.scale.map((s) => Math.abs(s));
  if (scale.some((s) => !Number.isFinite(s) || s < 1e-6)) {
    throw new EngineError('INVALID_PARAMETER', { name: 'scale', value: obj.scale.join(','), min: 1e-6, max: 1e6 });
  }

  const wasm = await initManifoldEngine();
  // Trabajamos en espacio escalado (sin rotación ni traslación): las distancias coinciden con las de mundo
  const scaled = applyTransformToMesh(obj.mesh, [0, 0, 0], [0, 0, 0], obj.scale);
  const registry = obj.mesh.faceColors?.length
    ? createColorRegistry(wasm, [{ color: obj.color, faceColors: scaled.faceColors }])
    : null;

  const handles: Manifold[] = [];
  const own = <T extends Manifold>(m: T): T => {
    handles.push(m);
    return m;
  };

  try {
    const outer = own(meshDataToManifold(wasm, scaled, registry?.colorToId, obj.color));
    const bbox = outer.boundingBox();
    const dx = bbox.max[0] - bbox.min[0];
    const dy = bbox.max[1] - bbox.min[1];
    const dz = bbox.max[2] - bbox.min[2];
    const minDim = Math.min(dx, dy, dz);
    if (t * 2 >= minDim - 0.1) {
      throw new EngineError('HOLLOW_WALL_TOO_THICK', { thickness: t, minDim });
    }

    // Un solo campo de distancia para el offset y para la verificación de pared.
    const field = distanceFieldOfManifold(outer);
    const offset = inwardOffset(wasm, outer, t, undefined, field);
    const inner = own(offset.inner);
    if (inner.isEmpty() || inner.volume() < 1e-6) {
      throw new EngineError('HOLLOW_WALL_TOO_THICK', { thickness: t, minDim });
    }

    // Verificación: la cavidad debe quedar dentro y a ≥ t (menos tolerancia de mundo) de la superficie
    const tolerance = Math.max(0.02, t * 0.05);
    const wall = measureWallThickness(field, inner);
    const escaped = own(inner.subtract(outer)).volume();
    if (wall.minMm < t - tolerance || escaped > 1e-6 * Math.max(1, outer.volume())) {
      throw new EngineError('HOLLOW_WALL_BREACH', { thickness: t, measured: wall.minMm });
    }

    const warnings: EngineWarning[] = [];
    if (offset.levelMarginMm > t * 0.1) {
      warnings.push(engineWarning('HOLLOW_COARSE_GRID', { thickness: t, maxWall: wall.maxMm }));
    }

    let result = own(outer.subtract(inner));
    const cavities = inner.decompose();
    for (const c of cavities) own(c);

    if (options.drainHole) {
      const defaultR = Math.max(0.5, Math.min(dx, dz) * 0.06);
      const holeR = requireNumberInRange(
        'drainHoleRadius',
        options.drainHoleRadius,
        OPERATION_RANGES.hollow.drainHoleRadius.min,
        Math.max(0.6, Math.min(dx, dz) * 0.45),
        defaultR
      );
      const holes: Manifold[] = [];
      for (const cavity of cavities) {
        const low = lowestPoint(cavity, 1);
        if (!low) continue;
        const cb = cavity.boundingBox();
        const into = Math.min(1, (cb.max[1] - cb.min[1]) * 0.5);
        const height = low[1] + into - (bbox.min[1] - 1);
        const cyl = own(wasm.Manifold.cylinder(height, holeR, holeR, 24, false));
        const up = own(cyl.rotate([-90, 0, 0]));
        holes.push(own(up.translate([low[0], bbox.min[1] - 1, low[2]])));
      }
      if (holes.length > 0) {
        const holeUnion = own(wasm.Manifold.union(holes));
        result = own(result.subtract(holeUnion));
      }
    }

    // Colapsa triángulos colineales residuales de la grilla (área nula) sin mover la superficie
    result = own(result.simplify(1e-4));
    // Volvemos al espacio local del objeto
    const local = own(result.scale([1 / obj.scale[0], 1 / obj.scale[1], 1 / obj.scale[2]]));
    const mesh = normalizeMeshToBed(manifoldToMeshData(local, registry?.idToColor));
    return {
      mesh,
      wall,
      cavityVolumeMm3: inner.volume(),
      cavityCount: cavities.length,
      warnings,
    };
  } finally {
    for (const h of handles) h.delete();
  }
}

/**
 * Crea una carcasa hueca watertight con pared uniforme (API compatible: solo la malla).
 * Ver `hollowMeshDetailed` para mediciones y avisos.
 */
export async function hollowMesh(obj: SceneObject, options: HollowOptions): Promise<MeshData> {
  if (!options.enabled || options.wallThickness === 0) {
    return cloneMesh(obj.mesh);
  }
  return (await hollowMeshDetailed(obj, options)).mesh;
}
