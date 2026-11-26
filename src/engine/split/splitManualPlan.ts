/**
 * @file src/engine/split/splitManualPlan.ts
 * @description Plan de "dividir para imprimir" con cortes a mano (`BedSplitPlanOptions.manualCuts`): los planos
 * son exactamente los pedidos (varios por eje, en cualquier posición, rectos o inclinados), con la misma forma de
 * plan que la rejilla automática para que nombres (A1, B1…), uniones, marcas y armado sigan igual. Mide la sección
 * de cada plano (inclinados: en el marco donde su cara es recta), las piezas reales (recto: conteo exacto de
 * `splitOccupancy.ts`; inclinado: caja real de cada celda cortada) y avisa por pieza antes de aplicar: no cabe en
 * la cama (`SPLIT_MANUAL_PIECE_TOO_BIG`), queda muy delgada para su unión (`SPLIT_MANUAL_PIECE_THIN`, el tramo
 * mínimo del alojamiento con su pared, el mismo de la rejilla automática) o un plano inclinado se cruza con cortes
 * de otra dirección y sus uniones irán para pegar (`SPLIT_MANUAL_TILT_GLUE`, ver `splitTiltedJoint.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { engineWarning, type EngineWarning } from '../engineErrors';
import { SPLIT_DEFAULTS, connectorProtrusion, minSpan, resolveOptions, splitPartCode } from './splitPlan';
import { cutIntoCells, gridOf, planeSpecsOf, SPLIT_AXES } from './splitCells';
import { measureOccupancy } from './splitOccupancy';
import { mat4Of, resolveManualCuts, rotationToAxis, type ResolvedCut } from './splitManualCuts';
import { AXIS_INDEX, fittingRotation, isDiagonal, measureSection, orientForAxis, rotatedSize } from './splitSections';
import { tiltNeedsGlue } from './splitTiltedJoint';
import type { CutCells } from './splitCutCache';
import type { BedSplitPlan, BedSplitPlanOptions, PlannedPiece, SplitBed, SplitConnectorOptions, SplitPlane, SplitPlanOccupancy } from './splitTypes';

/** Sección de un corte (recto: en su eje; inclinado: girando el sólido hasta que la cara quede recta). */
function sectionOf(m: Manifold, c: ResolvedCut, connector: SplitConnectorOptions | null) {
  const turned = c.tilted ? m.transform(mat4Of(rotationToAxis(c.normal, c.axis))) : m;
  try {
    const { oriented, owned } = orientForAxis(turned, c.axis);
    try {
      const s = measureSection(oriented, c.tilted ? c.offset : c.positionMm, connector);
      return { ...s, admitsConnectors: Boolean(connector) && s.islands > 0 && (s.admitsConnectors || connector!.type === 'lap') };
    } finally {
      if (owned) oriented.delete();
    }
  } finally {
    if (turned !== m) turned.delete();
  }
}

/** Ocupación real con planos inclinados: celdas con material y su caja (sin fundir fragmentos: `exact: false`). */
function tiltedOccupancy(m: Manifold, plan: BedSplitPlan, protrusion: number, onCells?: (cells: CutCells) => void) {
  const counts = [plan.counts.x, plan.counts.y, plan.counts.z];
  const cells = cutIntoCells(m.translate([0, 0, 0]), planeSpecsOf(plan));
  onCells?.(cells);
  const boxes = new Map<string, { cell: [number, number, number]; min: Vec3; max: Vec3 }>();
  try {
    for (const { cell, m: c } of cells) {
      if (c.isEmpty() || c.volume() < 1e-6) continue;
      const bb = c.boundingBox();
      boxes.set(cell.join(','), { cell: [...cell] as [number, number, number], min: [...bb.min] as Vec3, max: [...bb.max] as Vec3 });
    }
  } finally {
    for (const c of cells) c.m.delete();
  }
  const jointsPerPlane = plan.planes.map((p) => {
    const a = AXIS_INDEX[p.axis];
    let n = 0;
    for (const b of boxes.values()) {
      if (b.cell[a] !== p.index) continue;
      const hc = [...b.cell];
      hc[a]++;
      if (boxes.has(hc.join(','))) n++;
    }
    return n;
  });
  const list = [...boxes.values()];
  const occupancy: SplitPlanOccupancy = {
    exact: false,
    cells: list.map((b) => b.cell),
    pieces: list.length,
    joints: jointsPerPlane.reduce((s, n) => s + n, 0),
    jointsPerPlane,
    pieceSizesMm: list.map((b) => [0, 1, 2].map((a) => b.max[a] - b.min[a] + (b.cell[a] < counts[a] - 1 ? protrusion : 0)) as Vec3),
  };
  return { occupancy, boxes };
}

/**
 * Plan con los cortes a mano de `options.manualCuts` sobre el sólido mundial `m` (no lo consume). Lanza los
 * errores de `resolveManualCuts` si la lista no es válida. `onCells` recibe las celdas cortadas (caché de corte).
 */
export function manualPlanFromManifold(
  wasm: ManifoldToplevel, m: Manifold, bed: SplitBed, options: BedSplitPlanOptions,
  onCells?: (plan: BedSplitPlan, cells: CutCells) => void,
): BedSplitPlan {
  const t0 = performance.now();
  const opt = resolveOptions(bed, options);
  const bb = m.boundingBox();
  const bounds = { min: [...bb.min] as Vec3, max: [...bb.max] as Vec3 };
  const cuts = resolveManualCuts(options.manualCuts ?? [], bounds);
  const protrusion = connectorProtrusion(opt.connector);
  const planes: SplitPlane[] = [];
  for (const axis of SPLIT_AXES) {
    cuts.filter((c) => c.axis === axis).forEach((c, index) => {
      const s = sectionOf(m, c, opt.connector);
      planes.push({
        axis, index, position: c.positionMm, uniformPosition: c.positionMm,
        sectionAreaMm2: s.areaMm2, islands: s.islands, strips: s.strips, smallestIslandMm2: s.smallestIslandMm2, admitsConnectors: s.admitsConnectors,
        ...(c.tilted ? { tiltDeg: c.tiltDeg, normal: c.normal, offset: c.offset } : {}),
        ...(c.id !== undefined ? { cutId: c.id } : {}),
      });
    });
  }
  const counts = { x: 1, y: 1, z: 1 };
  for (const p of planes) counts[p.axis]++;
  const n = [counts.x, counts.y, counts.z];
  const plan: BedSplitPlan = {
    bounds, usableMm: opt.usable, counts, planes, pieces: [], fitsWithoutCuts: false, connector: opt.connector, manual: true, warnings: [], elapsedMs: 0,
  };
  const tilted = planes.some((p) => p.normal);
  const minFragment = options.minFragmentMm3 ?? SPLIT_DEFAULTS.minFragmentMm3;
  let realBoxes: Map<string, { min: Vec3; max: Vec3 }> | null = null;
  if (tilted) {
    const r = tiltedOccupancy(m, plan, protrusion, onCells && ((cells) => onCells(plan, cells)));
    plan.occupancy = r.occupancy;
    realBoxes = r.boxes;
  } else if (options.countOccupancy !== false) {
    plan.occupancy = measureOccupancy(wasm, m, { ...plan, protrusionMm: protrusion }, minFragment, onCells && ((cells) => onCells(plan, cells)));
  }
  const grid = gridOf(plan).bounds;
  const full: Vec3 = [bed.widthMm, bed.heightMm, bed.depthMm];
  for (let k = 0; k < n[2]; k++) {
    for (let j = 0; j < n[1]; j++) {
      for (let i = 0; i < n[0]; i++) {
        const cell: [number, number, number] = [i, j, k];
        const real = realBoxes?.get(cell.join(','));
        if (realBoxes && !real) continue;
        const lo = real ? real.min : (cell.map((c, a) => grid[a][c]) as Vec3);
        const hi = real ? real.max : (cell.map((c, a) => grid[a][c + 1]) as Vec3);
        const sizeMm = [0, 1, 2].map((a) => hi[a] - lo[a] + (cell[a] < n[a] - 1 ? protrusion : 0)) as Vec3;
        const fit = fittingRotation(sizeMm, opt.usable, opt.allowRotation, false);
        const printRotation = fit ?? ([0, 0, 0] as Vec3);
        const printed = rotatedSize(sizeMm, printRotation);
        plan.pieces.push({
          code: splitPartCode(cell, n[2]), cell, bounds: { min: lo, max: hi }, sizeMm,
          rotated: printRotation.some((v) => v !== 0), printRotation, diagonal: isDiagonal(printRotation),
          bedMarginMm: Math.min(...[0, 1, 2].map((a) => (full[a] - printed[a]) / 2)),
        });
      }
    }
  }
  plan.warnings = pieceWarnings(plan, opt.usable, opt.allowRotation, grid);
  plan.elapsedMs = performance.now() - t0;
  return plan;
}

/** Avisos por pieza del plan a mano (solo piezas con material). */
function pieceWarnings(plan: BedSplitPlan, usable: Vec3, allowRotation: boolean, grid: number[][]): EngineWarning[] {
  const out: EngineWarning[] = [];
  const filled = plan.occupancy ? new Set(plan.occupancy.cells.map((c) => c.join(','))) : null;
  const pieces = plan.pieces.filter((p) => !filled || filled.has(p.cell.join(',')));
  const n = [plan.counts.x, plan.counts.y, plan.counts.z];
  const big = pieces.filter((p) => !fittingRotation(p.sizeMm, usable, allowRotation, false));
  if (big.length > 0) {
    out.push(engineWarning('SPLIT_MANUAL_PIECE_TOO_BIG', {
      count: big.length, codes: big.map((p) => p.code).join(', '),
      size: big[0].sizeMm.map((v) => Math.round(v)).join(' × '), usable: usable.map((v) => Math.round(v)).join(' × '),
    }));
  }
  if (plan.connector) {
    const need = minSpan(plan.connector);
    const thin: Array<{ code: string; mm: number }> = [];
    for (const p of pieces) {
      let mm = Infinity;
      for (let a = 0; a < 3; a++) {
        if (n[a] < 2) continue;
        // Recto: el tramo de la celda; inclinado: el largo real de la pieza en el eje base
        const span = p.bounds.max[a] - p.bounds.min[a];
        mm = Math.min(mm, plan.planes.some((q) => q.normal) ? span : Math.min(span, grid[a][p.cell[a] + 1] - grid[a][p.cell[a]]));
      }
      if (mm < need) thin.push({ code: p.code, mm });
    }
    if (thin.length > 0) {
      out.push(engineWarning('SPLIT_MANUAL_PIECE_THIN', {
        count: thin.length, codes: thin.map((t) => t.code).join(', '), thickness: Math.round(Math.min(...thin.map((t) => t.mm)) * 10) / 10,
        min: Math.round(need * 10) / 10,
      }));
    }
  }
  const glue = plan.planes.filter((p) => p.normal && tiltNeedsGlue(p, plan.planes, plan.connector));
  if (glue.length > 0) {
    out.push(engineWarning('SPLIT_MANUAL_TILT_GLUE', { count: glue.length, where: glue.map((p) => `${p.axis.toUpperCase()}${p.index + 1}`).join(', ') }));
  }
  return out;
}
