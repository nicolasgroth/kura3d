/**
 * @file src/engine/split/splitPlan.ts
 * @description Plan de "dividir para imprimir" (sin cortar): con la caja mundial del modelo decide
 * cuántos tramos por eje hacen falta para que cada pieza quepa en la cama útil (aceptando un giro de
 * 90° si así cabe), reparte los planos de forma uniforme y desplaza cada uno dentro de una ventana
 * hacia la sección más simple (menos islas, sin islas diminutas, que admita conectores y de menor
 * área), muestreando con `slice` de manifold-3d. Devuelve planos y piezas estimadas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type { SceneObject, Vec3 } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';
import { applyTransformToMesh } from '../primitives';
import {
  AXIS_INDEX,
  connectorMargin,
  fittingRotation,
  measureSection,
  orientForAxis,
  rotatedSize,
  type SectionStats,
} from './splitSections';
import type {
  BedSplitPlan,
  BedSplitPlanOptions,
  PlannedPiece,
  SplitAxis,
  SplitBed,
  SplitConnectorOptions,
  SplitPlane,
} from './splitTypes';

export const SPLIT_DEFAULTS = {
  marginMm: 5,
  maxPieces: 64,
  shiftWindow: 0.15,
  labelDepthMm: 0.4,
  labelMinHeightMm: 4,
  connector: { type: 'dowel', size: 4, depth: 6, tolerance: 0.25, count: 2 } as SplitConnectorOptions,
} as const;

/** Muestras por plano dentro de la ventana. */
const SAMPLES = 7;
const AXES: SplitAxis[] = ['x', 'y', 'z'];

/** Columna en letras: 0 → A, 25 → Z, 26 → AA. */
function letters(n: number, base: number): string {
  let s = '';
  let v = n;
  do {
    s = String.fromCharCode(base + (v % 26)) + s;
    v = Math.floor(v / 26) - 1;
  } while (v >= 0);
  return s;
}

/** Código de pieza por celda (ver convención en `splitTypes.ts`). */
export function splitPartCode(cell: [number, number, number], zCount: number): string {
  return `${letters(cell[0], 65)}${cell[1] + 1}${zCount > 1 ? letters(cell[2], 97) : ''}`;
}

/** Saliente del macho más allá de la cara de unión (mm). */
export function connectorProtrusion(c: SplitConnectorOptions | null): number {
  return c ? Math.max(0.8, c.depth) : 0;
}

/** Tramo mínimo: el alojamiento con su pared debe caber en la pieza que lo recibe. */
function minSpan(c: SplitConnectorOptions | null): number {
  return c ? 2 * (Math.max(0.8, c.depth + c.tolerance) + 0.8) + 2 : 2;
}

interface CountChoice {
  counts: Vec3;
  rot: Vec3;
}

/** Menor rejilla uniforme que cabe; `null` si ninguna con ≤ `maxPieces`. */
function chooseCounts(size: Vec3, usable: Vec3, axes: Set<SplitAxis>, maxPieces: number, protrusion: number, allowRotation: boolean): CountChoice | null {
  let best: (CountChoice & { pieces: number; rotated: boolean }) | null = null;
  const lim = (a: SplitAxis) => (axes.has(a) ? maxPieces : 1);
  for (let nx = 1; nx <= lim('x'); nx++) {
    for (let ny = 1; nx * ny <= maxPieces && ny <= lim('y'); ny++) {
      for (let nz = 1; nx * ny * nz <= maxPieces && nz <= lim('z'); nz++) {
        const pieces = nx * ny * nz;
        if (best && pieces > best.pieces) break;
        const n = [nx, ny, nz];
        const piece = size.map((L, a) => L / n[a] + (n[a] > 1 ? protrusion : 0)) as Vec3;
        const rot = fittingRotation(piece, usable, allowRotation);
        if (!rot) continue;
        const rotated = rot.some((v) => v !== 0);
        if (!best || pieces < best.pieces || (pieces === best.pieces && best.rotated && !rotated)) {
          best = { counts: n as Vec3, rot, pieces, rotated };
        }
      }
    }
  }
  return best ? { counts: best.counts, rot: best.rot } : null;
}

/** Puntaje de una sección (menor es mejor). */
function sectionScore(s: SectionStats, maxArea: number, shift: number, window: number, connector: SplitConnectorOptions | null): number {
  const tinyLimit = connector ? Math.max(100, 2 * Math.PI * connectorMargin(connector) ** 2) : 100;
  const tiny = s.islands > 0 && s.smallestIslandMm2 < tinyLimit ? 100 : 0;
  const noConnector = connector && !s.admitsConnectors ? 50 : 0;
  return tiny + noConnector + 2 * Math.max(0, s.islands - 1) + s.areaMm2 / (maxArea || 1) + (0.25 * Math.abs(shift)) / (window || 1);
}

/** Planos de un eje con tramos de largo ≤ `allowed`, desplazados hacia la mejor sección. */
function placePlanes(
  oriented: Manifold,
  axis: SplitAxis,
  min: number,
  max: number,
  n: number,
  allowed: number,
  windowFrac: number,
  connector: SplitConnectorOptions | null,
): SplitPlane[] {
  const span = (max - min) / n;
  const w = windowFrac * span;
  const minLen = Math.min(minSpan(connector), span * 0.5);
  const planes: SplitPlane[] = [];
  let prev = min;
  for (let k = 1; k < n; k++) {
    const uni = min + k * span;
    let lo = Math.max(uni - w, prev + minLen, max - (n - k) * allowed);
    let hi = Math.min(uni + w, prev + allowed, max - (n - k) * minLen);
    if (lo > hi) lo = hi = Math.min(Math.max(uni, prev + minLen), prev + allowed);
    const samples: Array<{ pos: number; s: SectionStats }> = [];
    for (let i = 0; i < SAMPLES; i++) {
      const pos = hi === lo ? lo : lo + ((hi - lo) * i) / (SAMPLES - 1);
      samples.push({ pos, s: measureSection(oriented, pos, connector) });
      if (hi === lo) break;
    }
    const maxArea = Math.max(...samples.map((c) => c.s.areaMm2));
    let pick = samples[0];
    let bestScore = Infinity;
    for (const c of samples) {
      const score = sectionScore(c.s, maxArea, c.pos - uni, w, connector);
      if (score < bestScore) {
        bestScore = score;
        pick = c;
      }
    }
    planes.push({
      axis,
      index: k - 1,
      position: pick.pos,
      uniformPosition: uni,
      sectionAreaMm2: pick.s.areaMm2,
      islands: pick.s.islands,
      smallestIslandMm2: pick.s.smallestIslandMm2,
      admitsConnectors: pick.s.admitsConnectors,
    });
    prev = pick.pos;
  }
  return planes;
}

/** Valida y completa opciones. */
function resolveOptions(bed: SplitBed, o: BedSplitPlanOptions) {
  const margin = o.marginMm ?? SPLIT_DEFAULTS.marginMm;
  const usable: Vec3 = [bed.widthMm - 2 * margin, bed.heightMm - 2 * margin, bed.depthMm - 2 * margin];
  if (usable.some((v) => !(v > 0))) {
    throw new EngineError('INVALID_PARAMETER', { name: 'marginMm', value: String(margin), min: 0, max: Math.min(bed.widthMm, bed.depthMm, bed.heightMm) / 2 });
  }
  return {
    usable,
    axes: new Set(o.axes && o.axes.length > 0 ? o.axes : AXES),
    maxPieces: o.maxPieces ?? SPLIT_DEFAULTS.maxPieces,
    allowRotation: o.allowRotation ?? true,
    window: o.shiftWindow ?? SPLIT_DEFAULTS.shiftWindow,
    connector: o.connector === undefined ? SPLIT_DEFAULTS.connector : o.connector,
  };
}

/** Plan sobre un sólido mundial ya construido (lo usa también la ejecución). */
export function planFromManifold(m: Manifold, bed: SplitBed, options: BedSplitPlanOptions = {}): BedSplitPlan {
  const t0 = performance.now();
  const opt = resolveOptions(bed, options);
  const bb = m.boundingBox();
  const min = bb.min as Vec3;
  const max = bb.max as Vec3;
  const size = [0, 1, 2].map((a) => max[a] - min[a]) as Vec3;
  const protrusion = connectorProtrusion(opt.connector);
  const choice = chooseCounts(size, opt.usable, opt.axes, opt.maxPieces, protrusion, opt.allowRotation);
  if (!choice) {
    // Estimación de las piezas que harían falta (sin giro), para el mensaje
    let needed = 1;
    for (const a of AXES) {
      const i = AXIS_INDEX[a];
      if (size[i] <= opt.usable[i]) continue;
      if (!opt.axes.has(a)) throw new EngineError('SPLIT_AXIS_BLOCKED', { axis: a, size: size[i], usable: opt.usable[i] });
      const room = opt.usable[i] - protrusion;
      needed *= room > 0 ? Math.ceil(size[i] / room) : Infinity;
    }
    throw new EngineError('SPLIT_TOO_MANY_PIECES', { needed: Number.isFinite(needed) ? needed : 9999, max: opt.maxPieces });
  }
  const { counts, rot } = choice;
  const planes: SplitPlane[] = [];
  const bounds: number[][] = [];
  for (const axis of AXES) {
    const a = AXIS_INDEX[axis];
    const n = counts[a];
    let axisPlanes: SplitPlane[] = [];
    if (n > 1) {
      // Bed axis that receives this model axis under the chosen rotation
      const unit: Vec3 = [0, 0, 0];
      unit[a] = 1;
      const rs = rotatedSize(unit, rot);
      const bedAxis = rs.indexOf(Math.max(...rs));
      const allowed = opt.usable[bedAxis] - protrusion;
      const { oriented, owned } = orientForAxis(m, axis);
      try {
        axisPlanes = placePlanes(oriented, axis, min[a], max[a], n, allowed, opt.window, opt.connector);
      } finally {
        if (owned) oriented.delete();
      }
    }
    planes.push(...axisPlanes);
    bounds.push([min[a], ...axisPlanes.map((p) => p.position), max[a]]);
  }
  const pieces: PlannedPiece[] = [];
  for (let k = 0; k < counts[2]; k++) {
    for (let j = 0; j < counts[1]; j++) {
      for (let i = 0; i < counts[0]; i++) {
        const cell: [number, number, number] = [i, j, k];
        const lo = cell.map((c, a) => bounds[a][c]) as Vec3;
        const hi = cell.map((c, a) => bounds[a][c + 1]) as Vec3;
        const sizeMm = [0, 1, 2].map((a) => hi[a] - lo[a] + (cell[a] < counts[a] - 1 ? protrusion : 0)) as Vec3;
        const printRotation = fittingRotation(sizeMm, opt.usable, opt.allowRotation) ?? rot;
        pieces.push({
          code: splitPartCode(cell, counts[2]),
          cell,
          bounds: { min: lo, max: hi },
          sizeMm,
          rotated: printRotation.some((v) => v !== 0),
          printRotation,
        });
      }
    }
  }
  return {
    bounds: { min, max },
    usableMm: opt.usable,
    counts: { x: counts[0], y: counts[1], z: counts[2] },
    planes,
    pieces,
    fitsWithoutCuts: planes.length === 0,
    connector: opt.connector,
    elapsedMs: performance.now() - t0,
  };
}

/**
 * Propone cómo dividir `obj` (con su transformación de mundo) para que cada pieza quepa en `bed`.
 * No corta: devuelve planos y piezas estimadas. Lanza `SPLIT_TOO_MANY_PIECES` si harían falta más
 * de `maxPieces` y `SPLIT_AXIS_BLOCKED` si un eje no permitido no cabe.
 */
export async function planBedSplit(obj: SceneObject, bed: SplitBed, options: BedSplitPlanOptions = {}): Promise<BedSplitPlan> {
  const t0 = performance.now();
  const wasm = await initManifoldEngine();
  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const m = meshDataToManifold(wasm, world, undefined, obj.color);
  try {
    const plan = planFromManifold(m, bed, options);
    return { ...plan, elapsedMs: performance.now() - t0 };
  } finally {
    m.delete();
  }
}
