/**
 * @file src/engine/split/splitPlan.ts
 * @description Plan de "dividir para imprimir" (sin cortar): con la caja mundial del modelo decide
 * cuántos tramos por eje hacen falta para que cada pieza quepa en la cama útil (aceptando un giro de
 * 90° si así cabe), reparte los planos de forma uniforme y desplaza cada uno dentro de una ventana
 * hacia la sección más simple (menos islas, sin islas diminutas, que admita conectores y de menor
 * área), muestreando con `slice` de manifold-3d. Devuelve planos y piezas estimadas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import type { SceneObject, Vec3 } from '../../types/kura';
import { EngineError, engineWarning } from '../engineErrors';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';
import { OPERATION_DEFAULTS, SPLIT_HARD_MAX_PIECES } from '../operationLimits';
import { applyTransformToMesh } from '../primitives';
import { cutGridKey, gridOf } from './splitCells';
import { measureOccupancy } from './splitOccupancy';
import { cutKey, rememberCut, type CutCells } from './splitCutCache';
import { manualPlanFromManifold } from './splitManualPlan';
import {
  AXIS_INDEX,
  connectorMargin,
  fittingRotation,
  isDiagonal,
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
  ...OPERATION_DEFAULTS.split,
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
  // Sin conector o con imanes no sobresale nada: cada alojamiento queda dentro de su pieza (con imanes se sumaba el
  // mínimo de los machos y una figura justa en dos tramos pasaba a tres: más piezas que sin conector).
  if (!c || c.type === 'magnet') return 0;
  const lap = c.type === 'lap' ? (c.lapHeightMm ?? SPLIT_DEFAULTS.lapHeightMm) : 0;
  return Math.max(0.8, c.type === 'lap' ? 0 : c.depth, lap);
}

/** Tramo mínimo: el alojamiento con su pared debe caber en la pieza que lo recibe. */
export function minSpan(c: SplitConnectorOptions | null): number {
  return c ? 2 * (Math.max(0.8, c.depth + c.tolerance) + 0.8) + 2 : 2;
}

interface CountChoice {
  counts: Vec3;
  rot: Vec3;
}

/** Menor rejilla uniforme que cabe; `null` si ninguna con ≤ `maxPieces`. */
function chooseCounts(size: Vec3, usable: Vec3, axes: Set<SplitAxis>, maxPieces: number, protrusion: number, allowRotation: boolean, allowDiagonal: boolean): CountChoice | null {
  let best: (CountChoice & { pieces: number; rotated: boolean }) | null = null;
  const lim = (a: SplitAxis) => (axes.has(a) ? maxPieces : 1);
  for (let nx = 1; nx <= lim('x'); nx++) {
    for (let ny = 1; nx * ny <= maxPieces && ny <= lim('y'); ny++) {
      for (let nz = 1; nx * ny * nz <= maxPieces && nz <= lim('z'); nz++) {
        const pieces = nx * ny * nz;
        if (best && pieces > best.pieces) break;
        const n = [nx, ny, nz];
        const piece = size.map((L, a) => L / n[a] + (n[a] > 1 ? protrusion : 0)) as Vec3;
        const rot = fittingRotation(piece, usable, allowRotation, allowDiagonal && pieces === 1);
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

export { SPLIT_HARD_MAX_PIECES };

/** Holgura mínima por lado contra la cama (mm), aunque `marginMm` sea menor. */
export const SPLIT_MIN_BED_CLEARANCE_MM = 1;

/**
 * Puntaje de una sección (menor es mejor). Pesa, de más a menos: islas diminutas, tiras (pared
 * cortada a lo largo: delgada y sin agujero), sección que cambia mucho respecto de las vecinas (plano
 * casi tangente a una superficie), islas que no admiten la unión, islas extra, área y desplazamiento.
 * Una sección compacta (anillo completo, perpendicular al eje del tubo) queda con el menor puntaje.
 */
function sectionScore(s: SectionStats, maxArea: number, shift: number, window: number, connector: SplitConnectorOptions | null, change: number): number {
  const tinyLimit = connector ? Math.max(100, 2 * Math.PI * connectorMargin(connector) ** 2) : 100;
  const tiny = s.islands > 0 && s.smallestIslandMm2 < tinyLimit ? 100 : 0;
  // Sin conector la unión queda para pegar (válido): penalización leve
  const noConnector = connector && connector.type !== 'lap' && !s.admitsConnectors ? 5 : 0;
  return (
    tiny +
    40 * s.strips +
    10 * change +
    noConnector +
    2 * Math.max(0, s.islands - 1) +
    s.areaMm2 / (maxArea || 1) +
    (0.25 * Math.abs(shift)) / (window || 1)
  );
}

type Sample = { pos: number; s: SectionStats };

/** La sección admite unión: algún conector cabe o se eligió solape de borde. */
function admitsJoint(s: SectionStats, connector: SplitConnectorOptions | null): boolean {
  if (!connector || s.islands === 0) return false;
  return s.admitsConnectors || connector.type === 'lap';
}

/** Muestras equiespaciadas en [lo, hi]. */
function sampleWindow(oriented: Manifold, lo: number, hi: number, count: number, connector: SplitConnectorOptions | null): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const pos = hi === lo ? lo : lo + ((hi - lo) * i) / (count - 1);
    out.push({ pos, s: measureSection(oriented, pos, connector) });
    if (hi === lo) break;
  }
  return out;
}

/** Mejor muestra por puntaje (el cambio se mide contra las vecinas inmediatas). */
function bestSample(samples: Sample[], uni: number, w: number, connector: SplitConnectorOptions | null): { pick: Sample; score: number } {
  const maxArea = Math.max(...samples.map((c) => c.s.areaMm2));
  let pick = samples[0];
  let bestScore = Infinity;
  samples.forEach((c, i) => {
    const near = [samples[i - 1], samples[i + 1]].filter(Boolean);
    const change = near.length > 0 ? Math.max(...near.map((n) => Math.abs(n.s.areaMm2 - c.s.areaMm2) + 1e3 * Math.abs(n.s.islands - c.s.islands))) / (maxArea || 1) : 0;
    const score = sectionScore(c.s, maxArea, c.pos - uni, w, connector, Math.min(1, change));
    if (score < bestScore) {
      bestScore = score;
      pick = c;
    }
  });
  return { pick, score: bestScore };
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
  forced?: number[],
): SplitPlane[] {
  const span = (max - min) / n;
  const w = windowFrac * span;
  const minLen = Math.min(minSpan(connector), span * 0.5);
  const planes: SplitPlane[] = [];
  if (forced && forced.length === n - 1 && forced.every(Number.isFinite)) {
    // Posiciones a mano: ordenadas y separadas al menos el tramo mínimo, dentro del modelo.
    const sorted = [...forced].sort((p, q) => p - q);
    let prevForced = min;
    sorted.forEach((raw, i) => {
      const k = i + 1;
      const pos = Math.min(max - (n - k) * minLen, Math.max(prevForced + minLen, raw));
      const s = measureSection(oriented, pos, connector);
      planes.push({
        axis,
        index: i,
        position: pos,
        uniformPosition: min + k * span,
        sectionAreaMm2: s.areaMm2,
        islands: s.islands,
        strips: s.strips,
        smallestIslandMm2: s.smallestIslandMm2,
        admitsConnectors: admitsJoint(s, connector),
      });
      prevForced = pos;
    });
    return planes;
  }
  let prev = min;
  for (let k = 1; k < n; k++) {
    const uni = min + k * span;
    let lo = Math.max(uni - w, prev + minLen, max - (n - k) * allowed);
    let hi = Math.min(uni + w, prev + allowed, max - (n - k) * minLen);
    if (lo > hi) lo = hi = Math.min(Math.max(uni, prev + minLen), prev + allowed);
    let { pick } = bestSample(sampleWindow(oriented, lo, hi, SAMPLES, connector), uni, w, connector);
    let fallback = false;
    if (pick.s.strips > 0 && hi > lo) {
      // Sin plano razonable: amplía la ventana al doble dentro de lo que permiten los tramos
      const lo2 = Math.max(uni - 2 * w, prev + minLen, max - (n - k) * allowed);
      const hi2 = Math.min(uni + 2 * w, prev + allowed, max - (n - k) * minLen);
      if (hi2 > lo2) {
        const wide = bestSample(sampleWindow(oriented, lo2, hi2, 2 * SAMPLES - 1, connector), uni, 2 * w, connector).pick;
        if (wide.s.strips < pick.s.strips) pick = wide;
      }
      if (pick.s.strips > 0) {
        // Sigue partiendo paredes a lo largo: se conserva la posición uniforme y se avisa
        const u = Math.min(hi, Math.max(lo, uni));
        const atUni = measureSection(oriented, u, connector);
        if (atUni.strips <= pick.s.strips) pick = { pos: u, s: atUni };
        fallback = true;
      }
    }
    planes.push({
      axis,
      index: k - 1,
      position: pick.pos,
      uniformPosition: uni,
      sectionAreaMm2: pick.s.areaMm2,
      islands: pick.s.islands,
      strips: pick.s.strips,
      smallestIslandMm2: pick.s.smallestIslandMm2,
      admitsConnectors: admitsJoint(pick.s, connector),
      ...(fallback ? { fallback } : {}),
    });
    prev = pick.pos;
  }
  return planes;
}

/** Valida y completa opciones (la comparte el plan a mano, `splitManualPlan.ts`). */
export function resolveOptions(bed: SplitBed, o: BedSplitPlanOptions) {
  const sides: Array<[string, number]> = [['bedWidthMm', bed.widthMm], ['bedDepthMm', bed.depthMm], ['bedHeightMm', bed.heightMm]];
  for (const [name, v] of sides) {
    if (!(Number.isFinite(v) && v > 0)) throw new EngineError('INVALID_PARAMETER', { name, value: String(v), min: 0, max: 10_000 });
  }
  const margin = o.marginMm ?? SPLIT_DEFAULTS.marginMm;
  if (!(Number.isFinite(margin) && margin >= 0)) throw new EngineError('INVALID_PARAMETER', { name: 'marginMm', value: String(margin), min: 0, max: 50 });
  const clear = Math.max(margin, SPLIT_MIN_BED_CLEARANCE_MM);
  const usable: Vec3 = [bed.widthMm - 2 * clear, bed.heightMm - 2 * clear, bed.depthMm - 2 * clear];
  if (usable.some((v) => !(v > 0))) {
    throw new EngineError('INVALID_PARAMETER', { name: 'marginMm', value: String(margin), min: 0, max: Math.min(bed.widthMm, bed.depthMm, bed.heightMm) / 2 });
  }
  return {
    usable,
    axes: new Set(o.axes && o.axes.length > 0 ? o.axes : AXES),
    maxPieces: o.maxPieces === 'auto' ? SPLIT_HARD_MAX_PIECES : (o.maxPieces ?? SPLIT_DEFAULTS.maxPieces),
    allowRotation: o.allowRotation ?? true,
    allowDiagonal: o.allowDiagonal ?? false,
    window: o.shiftWindow ?? SPLIT_DEFAULTS.shiftWindow,
    connector: o.connector === undefined ? SPLIT_DEFAULTS.connector : o.connector,
    planePositions: o.planePositions ?? {},
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
  const choice = chooseCounts(size, opt.usable, opt.axes, opt.maxPieces, protrusion, opt.allowRotation, opt.allowDiagonal);
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
        axisPlanes = placePlanes(oriented, axis, min[a], max[a], n, allowed, opt.window, opt.connector, opt.planePositions[axis]);
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
        const printRotation = fittingRotation(sizeMm, opt.usable, opt.allowRotation, opt.allowDiagonal && counts.every((c) => c === 1)) ?? rot;
        const printed = rotatedSize(sizeMm, printRotation);
        const full: Vec3 = [bed.widthMm, bed.heightMm, bed.depthMm];
        pieces.push({
          code: splitPartCode(cell, counts[2]),
          cell,
          bounds: { min: lo, max: hi },
          sizeMm,
          rotated: printRotation.some((v) => v !== 0),
          printRotation,
          diagonal: isDiagonal(printRotation),
          bedMarginMm: Math.min(...[0, 1, 2].map((a) => (full[a] - printed[a]) / 2)),
        });
      }
    }
  }
  const thin = planes.filter((p) => p.fallback);
  const warnings = thin.length > 0 ? [engineWarning('SPLIT_PLANE_THIN_SECTION', { count: thin.length, planes: thin.map((p) => `${p.axis.toUpperCase()}${p.index + 1}`).join(', ') })] : [];
  return {
    bounds: { min, max },
    usableMm: opt.usable,
    warnings,
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
    if (options.manualCuts) {
      // Cortes a mano: el plan es la lista pedida (sin rejilla automática)
      const remember = (plan: BedSplitPlan, cells: CutCells) => rememberCut(cutKey(world, obj.color, cutGridKey(plan)), m.volume(), cells);
      return { ...manualPlanFromManifold(wasm, m, bed, options, remember), elapsedMs: performance.now() - t0 };
    }
    const plan = planFromManifold(m, bed, options);
    const occupancy = plan.fitsWithoutCuts || options.countOccupancy === false
      ? undefined
      : measureOccupancy(
        wasm, m, { ...plan, protrusionMm: connectorProtrusion(plan.connector) }, options.minFragmentMm3 ?? SPLIT_DEFAULTS.minFragmentMm3,
        // La ejecución del mismo plan reutiliza este corte (`splitCutCache.ts`)
        (cells) => rememberCut(cutKey(world, obj.color, gridOf(plan).bounds), m.volume(), cells),
      );
    return { ...plan, ...(occupancy ? { occupancy } : {}), elapsedMs: performance.now() - t0 };
  } finally {
    m.delete();
  }
}
