/**
 * @file src/core/scene/splitPlanSummary.ts
 * @description Resumen de un plan de "dividir para imprimir" para la interfaz: piezas, placas
 * estimadas (acomodo por filas de las huellas con la cara más grande abajo), pieza más grande frente
 * a la cama útil, piezas que no caben (planos ajustados a mano), uniones previstas con y sin conector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { BedSplitPlan, PlannedPiece, SplitAxis, SplitPlane } from '../../engine';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import type { Vec3 } from '../../types/kura';
import { toUserSize } from './displayAxes';

export interface SplitPlanSummary {
  /** Piezas que resultan (conteo real del plan si existe; si no, las celdas de la rejilla). */
  pieceCount: number;
  /** `true` si piezas, uniones y placas salen del conteo exacto del plan (`plan.occupancy.exact`). */
  exact: boolean;
  /** Placas estimadas (la cifra real la da la disposición tras dividir). */
  plateEstimate: number;
  largest: PlannedPiece | null;
  /** Medidas reales de la pieza más grande (caja del armado, sin el saliente de los machos), ejes del motor. */
  largestRealMm: Vec3 | null;
  /** Rejilla (tramos por eje) en ejes del usuario [X, Y, Z]; el eje Y del usuario es el Z del motor. */
  gridUser: Vec3;
  /** Códigos de piezas que no caben en la cama útil. */
  oversized: string[];
  rotatedCount: number;
  jointCount: number;
  /** Uniones en planos que no admiten el conector previsto. */
  jointsWithoutConnector: number;
  /**
   * Planos cuya sección es más delgada que el mínimo para conector: quedan como corte liso para
   * pegar. `wallMm` es el grosor de pared estimado (área de la sección ÷ perímetro medio de un tubo
   * que llena la caja del modelo en ese plano); `null` si no hay sección.
   */
  planesWithoutConnector: Array<{ axis: SplitAxis; number: number; wallMm: number | null }>;
  /** Mínimo de pared para conector pedido (mm), si hay conector. */
  minWallForConnectorMm: number | null;
  /** Pieza con menos margen real contra la cama completa. */
  tightest: { code: string; marginMm: number } | null;
  /** Piezas que irán en diagonal sobre la cama. */
  diagonalCount: number;
}

const AXIS_INDEX: Record<SplitAxis, number> = { x: 0, y: 1, z: 2 };

/** Grosor de pared estimado de la sección por un plano (exacto para un tubo redondo de pared delgada). */
export function estimateSectionWallMm(plan: BedSplitPlan, axis: SplitAxis, sectionAreaMm2: number): number | null {
  if (!(sectionAreaMm2 > 0)) return null;
  const a = AXIS_INDEX[axis];
  const sides = [0, 1, 2].filter((i) => i !== a).map((i) => plan.bounds.max[i] - plan.bounds.min[i]);
  const meanPerimeter = (Math.PI * (sides[0] + sides[1])) / 2;
  if (!(meanPerimeter > 0)) return null;
  // Una sección maciza no es "pared": el grosor no puede pasar de la mitad del lado menor.
  return Math.min(sectionAreaMm2 / meanPerimeter, Math.min(sides[0], sides[1]) / 2);
}

const sortDesc = (v: readonly number[]) => [...v].sort((a, b) => b - a);

/** true si una caja de `size` cabe en `usable` [X, Y, Z] (girándola si se permite). */
export function pieceFitsUsable(size: Vec3, usable: Vec3, allowRotation: boolean): boolean {
  const eps = 1e-6;
  if (!allowRotation) return size.every((v, i) => v <= usable[i] + eps);
  const s = sortDesc(size);
  const u = sortDesc(usable);
  return s.every((v, i) => v <= u[i] + eps);
}

/** Placas estimadas: huella = las dos medidas mayores, filas sobre la cama útil X × Z. */
export function estimatePlates(pieces: ReadonlyArray<Pick<PlannedPiece, 'sizeMm'> | Vec3>, usable: Vec3, gapMm = 5): number {
  if (pieces.length === 0) return 0;
  const W = usable[0];
  const D = usable[2];
  const prints = pieces
    .map((p) => {
      const [a, b] = sortDesc(Array.isArray(p) ? p : (p as PlannedPiece).sizeMm);
      // El lado largo a lo ancho de la cama si cabe; si no, al fondo.
      return a <= W ? { w: a, d: b } : { w: b, d: a };
    })
    .sort((p, q) => q.d - p.d || q.w - p.w);
  let plates = 1;
  let x = 0;
  let z = 0;
  let row = 0;
  let used = false;
  for (const it of prints) {
    if (used && x + it.w > W) {
      x = 0;
      z += row + gapMm;
      row = 0;
    }
    if (used && z + it.d > D) {
      plates++;
      x = 0;
      z = 0;
      row = 0;
    }
    x += it.w + gapMm;
    row = Math.max(row, it.d);
    used = true;
  }
  return plates;
}

export function summarizeSplitPlan(plan: BedSplitPlan, allowRotation: boolean): SplitPlanSummary {
  const volume = (p: PlannedPiece) => p.sizeMm[0] * p.sizeMm[1] * p.sizeMm[2];
  const occ = plan.occupancy;
  // Celdas vacías (p. ej. el hueco de una L) no dan pieza: lo que sigue mira solo las celdas ocupadas.
  const occupied = occ ? new Set(occ.cells.map((c) => c.join(','))) : null;
  const realPieces = occupied ? plan.pieces.filter((p) => occupied.has(p.cell.join(','))) : plan.pieces;
  const largest = realPieces.reduce<PlannedPiece | null>((best, p) => (!best || volume(p) > volume(best) ? p : best), null);
  const { x, y, z } = plan.counts;
  const perPlane: Record<SplitAxis, number> = { x: y * z, y: x * z, z: x * y };
  const withoutPlanes = plan.connector ? plan.planes.filter((p) => !p.admitsConnectors) : [];
  // Uniones por plano: las reales del plan si existen; si no, todas las celdas de la rejilla a cada lado.
  const jointsOn = (p: SplitPlane) => {
    const i = plan.planes.indexOf(p);
    return occ && i >= 0 && occ.jointsPerPlane[i] !== undefined ? occ.jointsPerPlane[i] : perPlane[p.axis];
  };
  return {
    pieceCount: occ ? occ.pieces : plan.pieces.length,
    exact: occ?.exact === true,
    plateEstimate: estimatePlates(occ && occ.pieceSizesMm.length > 0 ? occ.pieceSizesMm : realPieces, plan.usableMm),
    largest,
    largestRealMm: largest ? ([0, 1, 2].map((i) => largest.bounds.max[i] - largest.bounds.min[i]) as Vec3) : null,
    gridUser: toUserSize([x, y, z]),
    oversized: realPieces.filter((p) => !pieceFitsUsable(p.sizeMm, plan.usableMm, allowRotation)).map((p) => p.code),
    rotatedCount: realPieces.filter((p) => p.rotated).length,
    jointCount: plan.planes.reduce((n, p) => n + jointsOn(p), 0),
    jointsWithoutConnector: (plan.connector ? withoutPlanes : plan.planes).reduce((n, p) => n + jointsOn(p), 0),
    planesWithoutConnector: withoutPlanes.filter((p) => jointsOn(p) > 0).map((p) => ({
      axis: p.axis,
      number: p.index + 1,
      wallMm: estimateSectionWallMm(plan, p.axis, p.sectionAreaMm2),
    })),
    minWallForConnectorMm: plan.connector ? plan.connector.minWallForConnectorMm ?? OPERATION_DEFAULTS.split.minWallForConnectorMm : null,
    tightest: realPieces.reduce<{ code: string; marginMm: number } | null>(
      (best, p) => (Number.isFinite(p.bedMarginMm) && (!best || p.bedMarginMm < best.marginMm) ? { code: p.code, marginMm: p.bedMarginMm } : best),
      null,
    ),
    diagonalCount: realPieces.filter((p) => p.diagonal).length,
  };
}
