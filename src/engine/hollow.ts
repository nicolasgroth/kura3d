/**
 * @file src/engine/hollow.ts
 * @description Ahuecado (hollow shell) con pared uniforme real: la cavidad es el offset
 * interior exacto (`solidOffset.ts`) calculado en unidades de mundo (respeta `obj.scale`),
 * se verifica que ninguna zona quede más delgada que el espesor pedido (pared perforada)
 * y los orificios de drenaje se ubican en el punto más bajo de cada cavidad real (las bolsas
 * diminutas quedan macizas: `hollowCavities.ts`).
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
  estimateHollowWall,
  inwardOffset,
  lowestPoint,
  measureWallThickness,
  type WallThicknessStats,
} from './solidOffset';
import { assertHollowEffective, hollowMaxWallMm } from './hollowVerify';
import { selectCavities } from './hollowCavities';

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
  /** Bolsas diminutas descartadas, que quedan macizas (`OPERATION_DEFAULTS.hollow`). */
  discardedCavities: number;
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
    // Cáscaras cerradas que se solapan sin estar unidas (frecuente en bustos y figuras de terceros):
    // el offset y la resta asumen un sólido sin autointersecciones, y con ellas la cavidad se pierde o
    // se fragmenta. Se unen antes (la unión de cuerpos separados no cambia nada).
    const raw = own(meshDataToManifold(wasm, scaled, registry?.colorToId, obj.color));
    const shells = raw.decompose();
    shells.forEach((s) => own(s));
    const outer = shells.length > 1 ? own(wasm.Manifold.union(shells)) : raw;
    const mergedShells = shells.length > 1 && Math.abs(outer.volume() - shells.reduce((acc, s) => acc + s.volume(), 0)) > junkVolume(outer.volume());
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
    const measureField = offset.field ?? field;
    if (inner.isEmpty() || inner.volume() < 1e-6) {
      // La caja admitía la pared, pero la forma es más delgada que dos paredes en todas partes.
      throw new EngineError('HOLLOW_NO_CAVITY', { thickness: t, minDim });
    }

    // Verificación: la cavidad debe quedar dentro y a ≥ t (menos tolerancia de mundo) de la superficie
    const tolerance = Math.max(0.02, t * 0.05);
    const wall = offset.wall ?? measureWallThickness(measureField, inner);
    const escaped = own(inner.subtract(outer)).volume();
    if (wall.minMm < t - tolerance || escaped > 1e-6 * Math.max(1, outer.volume())) {
      throw new EngineError('HOLLOW_WALL_BREACH', { thickness: t, measured: wall.minMm });
    }

    const warnings: EngineWarning[] = [];
    if (mergedShells) warnings.push(engineWarning('HOLLOW_SHELLS_MERGED', { count: shells.length }));
    if (offset.selfIntersecting) warnings.push(engineWarning('HOLLOW_SELF_INTERSECTING', {}));
    if (offset.levelMarginMm > t * 0.1) {
      // Misma fuente que el panel (`estimateHollowWall`): el aviso y la estimación previa no se contradicen.
      warnings.push(engineWarning('HOLLOW_COARSE_GRID', { thickness: t, maxWall: hollowMaxWallMm([dx, dy, dz], t) }));
    }

    // Bolsas diminutas (mallas autointersecadas): quedan macizas y sin drenaje propio.
    const { kept: cavities, carve, discarded } = selectCavities(wasm, inner, junkVolume(outer.volume()), own);
    if (discarded > 0) warnings.push(engineWarning('HOLLOW_POCKETS_FILLED', { count: discarded }));

    // Con una malla que se cruza a sí misma la resta de Manifold no es fiable (dejaba la pieza igual). La
    // cavidad está a ≥ t de toda superficie, sin cruces: la diferencia es exactamente la pieza más la
    // cavidad invertida, sin booleana.
    const carved = offset.selfIntersecting
      ? own(joinDisjoint(wasm, [outer, own(insideOut(wasm, carve))], registry, obj.color))
      : own(outer.subtract(carve));
    let result = own(withoutJunkShells(wasm, carved, outer.volume(), registry, obj.color));

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
    result = own(withoutJunkShells(wasm, own(result.simplify(1e-4)), outer.volume(), registry, obj.color));
    // Volvemos al espacio local del objeto
    const local = own(result.scale([1 / obj.scale[0], 1 / obj.scale[1], 1 / obj.scale[2]]));
    const mesh = normalizeMeshToBed(manifoldToMeshData(local, registry?.idToColor));
    // Nunca informar éxito sin cavidad real: el volumen debe bajar lo que mide la cavidad y la pared
    // medida debe parecerse a la pedida (si no, la pieza queda igual y se dice por qué).
    assertHollowEffective({
      thickness: t,
      volumeBefore: outer.volume(),
      volumeAfter: result.volume(),
      cavityVolume: carve.volume(),
      wall,
      expectedMaxWallMm: estimateHollowWall([dx, dy, dz], t).maxWallMm,
    });
    return {
      mesh,
      wall,
      cavityVolumeMm3: carve.volume(),
      cavityCount: cavities.length,
      discardedCavities: discarded,
      warnings,
    };
  } finally {
    for (const h of handles) h.delete();
  }
}

/** Mismo sólido con la orientación invertida (volumen negativo): una cavidad lista para componer. */
function insideOut(wasm: Awaited<ReturnType<typeof initManifoldEngine>>, m: Manifold): Manifold {
  const mesh = m.getMesh();
  const tri = new Uint32Array(mesh.triVerts);
  for (let i = 0; i < tri.length; i += 3) {
    const b = tri[i + 1];
    tri[i + 1] = tri[i + 2];
    tri[i + 2] = b;
  }
  return new wasm.Manifold(new wasm.Mesh({ numProp: mesh.numProp, vertProperties: mesh.vertProperties, triVerts: tri }));
}

/**
 * Une componentes disjuntas en un solo Manifold armándolo desde sus mallas. `Manifold.compose` descarta
 * las de volumen negativo (cavidades): con él, quitar un casco basura o sumar la cavidad invertida dejaba
 * la pieza maciza con "Ahuecado aplicado". Conserva los colores de cara.
 */
function joinDisjoint(
  wasm: Awaited<ReturnType<typeof initManifoldEngine>>,
  parts: Manifold[],
  registry: ReturnType<typeof createColorRegistry> | null,
  color: string
): Manifold {
  const meshes = parts.map((p) => manifoldToMeshData(p, registry?.idToColor));
  const vTotal = meshes.reduce((n, m) => n + m.positions.length, 0);
  const iTotal = meshes.reduce((n, m) => n + m.indices.length, 0);
  const positions = new Float32Array(vTotal);
  const indices = new Uint32Array(iTotal);
  const withColors = registry !== null;
  const faceColors: string[] = [];
  let vo = 0;
  let io = 0;
  for (const m of meshes) {
    positions.set(m.positions, vo);
    const base = vo / 3;
    for (let i = 0; i < m.indices.length; i++) indices[io + i] = m.indices[i] + base;
    if (withColors) {
      const n = m.indices.length / 3;
      for (let f = 0; f < n; f++) faceColors.push(m.faceColors?.[f] ?? color);
    }
    vo += m.positions.length;
    io += m.indices.length;
  }
  return meshDataToManifold(wasm, { positions, indices, ...(withColors ? { faceColors } : {}) }, registry?.colorToId, color);
}

/** Volumen bajo el cual un cuerpo del ahuecado es basura numérica (cascos planos de volumen ~0). */
const junkVolume = (total: number) => Math.max(1e-3, 1e-9 * Math.abs(total));

/** Quita cuerpos de volumen nulo (p. ej. un casco de 6 triángulos que deja la grilla). */
function withoutJunkShells(
  wasm: Awaited<ReturnType<typeof initManifoldEngine>>,
  m: Manifold,
  total: number,
  registry: ReturnType<typeof createColorRegistry> | null,
  color: string
): Manifold {
  const parts = m.decompose();
  const keep = parts.filter((p) => Math.abs(p.volume()) > junkVolume(total));
  if (keep.length === parts.length) {
    for (const p of parts) p.delete();
    return m.translate([0, 0, 0]);
  }
  const out = joinDisjoint(wasm, keep, registry, color);
  for (const p of parts) p.delete();
  return out;
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
