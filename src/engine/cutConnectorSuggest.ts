/**
 * @file src/engine/cutConnectorSuggest.ts
 * @description Valores recomendados y comprobación de conectores del corte por plano para la pieza real:
 * calcula (con el mismo cálculo de islas y zona segura de `cutConnectorLayout.ts`) el mayor tamaño,
 * profundidad y cantidad de conectores que caben en la sección por el plano elegido, y rango del
 * desplazamiento según la extensión de la pieza en el eje. Funciones puras salvo por el motor WASM.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import type { CutConnectorType, SceneObject, Vec3 } from '../types/kura';
import {
  CONNECTOR_DEPTH_RANGE_MM,
  CONNECTOR_MIN_WALL_MM,
  CONNECTOR_SIZE_RANGE_MM,
} from './cutConnectorChecks';
import { layoutForCut } from './cutConnectorLayout';
import { OPERATION_RANGES } from './operationLimits';
import { initManifoldEngine, meshDataToManifold } from './manifoldKernel';
import { applyTransformToMesh } from './primitives';

type Axis = 'x' | 'y' | 'z';
type ConnectorKind = Exclude<CutConnectorType, 'none'>;

/** Tamaño y cantidad por defecto que se intentan antes de reducir. */
const DEFAULT_SIZE_MM = 4;
const DEFAULT_DEPTH_MM = 6;
const DEFAULT_COUNT = 2;
const SIZE_LADDER_MM = [DEFAULT_SIZE_MM, 3, 2, 1.5, 1, CONNECTOR_SIZE_RANGE_MM.min];
/** Margen para que el plano no quede exactamente en el borde de la pieza. */
const PLANE_EDGE_MM = 0.2;

/** Rango del desplazamiento (mm, respecto del centro de la pieza) en el eje dado. */
export function cutOffsetRange(obj: SceneObject, axis: Axis): { min: number; max: number } {
  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = idx; i < world.positions.length; i += 3) {
    lo = Math.min(lo, world.positions[i]);
    hi = Math.max(hi, world.positions[i]);
  }
  if (!Number.isFinite(lo)) return { min: 0, max: 0 };
  const half = Math.max(0, (hi - lo) / 2 - PLANE_EDGE_MM);
  return { min: -half, max: half };
}

/** Recomendación de conectores para un plano concreto. */
export interface CutConnectorSuggestion {
  /** `false` si en esta sección no cabe ningún conector (ni de 0,5 mm). */
  feasible: boolean;
  size: number;
  depth: number;
  count: number;
  maxSize: number;
  maxDepth: number;
  maxCount: number;
  /** Centros (mundo) donde el corte pondrá los conectores sugeridos; vacío si no es factible. */
  centers: Vec3[];
}

/** Parámetros de un conector a comprobar. */
export interface CutConnectorFitParams {
  size: number;
  depth: number;
  tolerance: number;
  count: number;
}

const round1 = (n: number) => Math.floor(n * 10 + 1e-6) / 10;

/** Prepara el manifold mundial y el plano; entrega un comprobador `fits` y limpia al terminar. */
async function withSection<T>(
  obj: SceneObject,
  axis: Axis,
  offset: number,
  type: ConnectorKind,
  run: (ctx: {
    available: number;
    fits: (p: CutConnectorFitParams) => boolean;
    centersFor: (p: CutConnectorFitParams) => Vec3[] | null;
  }) => T
): Promise<T | null> {
  const wasm = await initManifoldEngine();
  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  let manifold: Manifold | null = null;
  try {
    manifold = meshDataToManifold(wasm, world, undefined, obj.color);
    const bbox = manifold.boundingBox();
    const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const cutCoord = (bbox.min[idx] + bbox.max[idx]) * 0.5 + offset;
    const available = bbox.max[idx] - cutCoord;
    if (!(cutCoord > bbox.min[idx] && cutCoord < bbox.max[idx])) return null;
    const m = manifold;
    const layoutOf = (p: CutConnectorFitParams) =>
      layoutForCut(m, axis, cutCoord, { type, size: p.size, depth: p.depth, tolerance: p.tolerance, count: p.count }, CONNECTOR_MIN_WALL_MM);
    const fits = (p: CutConnectorFitParams): boolean => {
      const depthWithWall = Math.max(0.8, p.depth + p.tolerance) + CONNECTOR_MIN_WALL_MM;
      if (depthWithWall > available) return false;
      const layout = layoutOf(p);
      return layout.skippedIslands < layout.islands && layout.enoughRoom;
    };
    const centersFor = (p: CutConnectorFitParams): Vec3[] | null => (fits(p) ? layoutOf(p).centers : null);
    return run({ available, fits, centersFor });
  } finally {
    manifold?.delete();
  }
}

/** Mayor valor de `[lo, hi]` (a 0,1 mm) para el que `ok` es verdadero; `null` si ni `lo` cabe. */
function largest(lo: number, hi: number, ok: (v: number) => boolean): number | null {
  if (!ok(lo)) return null;
  if (ok(hi)) return hi;
  let a = lo;
  let b = hi;
  // Hasta 14 bisecciones: resolución < 0,1 mm aun con el tope de 500 mm de operationLimits.
  for (let i = 0; i < 14 && b - a > 0.1; i++) {
    const mid = (a + b) / 2;
    if (ok(mid)) a = mid;
    else b = mid;
  }
  return round1(a);
}

/**
 * Recomienda tamaño, profundidad y cantidad de conectores que caben en la sección real de `obj`
 * por el plano `axis`/`offset`, junto con los máximos para esa pieza. Devuelve `null` si el plano
 * queda fuera de la pieza.
 */
export async function suggestCutConnectors(
  obj: SceneObject,
  axis: Axis,
  offset: number,
  options: { type?: ConnectorKind; tolerance?: number } = {}
): Promise<CutConnectorSuggestion | null> {
  const type = options.type ?? 'dowel';
  const tolerance = options.tolerance ?? 0.25;
  const none: CutConnectorSuggestion = {
    feasible: false,
    size: CONNECTOR_SIZE_RANGE_MM.min,
    depth: CONNECTOR_DEPTH_RANGE_MM.min,
    count: 1,
    maxSize: 0,
    maxDepth: 0,
    maxCount: 0,
    centers: [],
  };
  const result = await withSection(obj, axis, offset, type, ({ available, fits, centersFor }) => {
    const minSize = CONNECTOR_SIZE_RANGE_MM.min;
    const minDepth = CONNECTOR_DEPTH_RANGE_MM.min;
    const depthCap = Math.min(
      CONNECTOR_DEPTH_RANGE_MM.max,
      round1(available - CONNECTOR_MIN_WALL_MM - tolerance)
    );
    if (depthCap < minDepth || !fits({ size: minSize, depth: minDepth, tolerance, count: 1 })) return none;

    // Combinación usual: dos conectores de tamaño decreciente; cada tamaño con la mayor profundidad
    // (hasta la usual) que cabe. Se acepta el primero con al menos 3 mm de encastre; si ninguno llega,
    // el de mayor profundidad.
    const depthTop = Math.min(DEFAULT_DEPTH_MM, depthCap);
    const goodDepth = Math.min(3, depthTop);
    let pick: { size: number; depth: number; count: number } | null = null;
    let fallback: { size: number; depth: number; count: number } | null = null;
    search: for (const count of [DEFAULT_COUNT, 1]) {
      for (const size of SIZE_LADDER_MM) {
        const depth = largest(minDepth, depthTop, (d) => fits({ size, depth: d, tolerance, count }));
        if (depth === null) continue;
        if (depth >= goodDepth) {
          pick = { size, depth, count };
          break search;
        }
        if (!fallback || depth > fallback.depth) fallback = { size, depth, count };
      }
    }
    const chosen = pick ?? fallback ?? { size: minSize, depth: minDepth, count: 1 };
    const { size, depth, count } = chosen;
    const maxSize =
      largest(minSize, CONNECTOR_SIZE_RANGE_MM.max, (s) => fits({ size: s, depth, tolerance, count: 1 })) ?? size;
    let maxCount = count;
    for (let c = OPERATION_RANGES.cut.connectorCount.max; c > count; c--) {
      if (fits({ size, depth, tolerance, count: c })) {
        maxCount = c;
        break;
      }
    }
    const maxDepth = largest(minDepth, depthCap, (d) => fits({ size, depth: d, tolerance, count })) ?? depth;
    const centers = centersFor({ size, depth, tolerance, count }) ?? [];
    return { feasible: true, size, depth, count, maxSize, maxDepth, maxCount, centers } satisfies CutConnectorSuggestion;
  });
  return result ?? null;
}

/** Comprueba si los parámetros actuales caben en la sección real (misma regla que el corte). */
export async function checkCutConnectorFit(
  obj: SceneObject,
  axis: Axis,
  offset: number,
  type: ConnectorKind,
  params: CutConnectorFitParams
): Promise<boolean | null> {
  return withSection(obj, axis, offset, type, ({ fits }) => fits(params));
}

/**
 * Centros (mundo) donde el corte pondrá los conectores con estos parámetros; `[]` si no caben y
 * `null` si el plano queda fuera de la pieza. Usa la misma ubicación que `planeCutWithConnectors`.
 */
export async function cutConnectorCenters(
  obj: SceneObject,
  axis: Axis,
  offset: number,
  type: ConnectorKind,
  params: CutConnectorFitParams
): Promise<Vec3[] | null> {
  const res = await withSection(obj, axis, offset, type, ({ centersFor }) => centersFor(params) ?? []);
  return res ?? null;
}
