/**
 * @file src/core/scene/splitPlanSummary.ts
 * @description Resumen de un plan de "dividir para imprimir" para la interfaz: piezas, placas
 * estimadas (acomodo por filas de las huellas con la cara más grande abajo), pieza más grande frente
 * a la cama útil, piezas que no caben (planos ajustados a mano), uniones previstas con y sin conector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { BedSplitPlan, PlannedPiece, SplitAxis } from '../../engine';
import type { Vec3 } from '../../types/kura';

export interface SplitPlanSummary {
  pieceCount: number;
  /** Placas estimadas (la cifra real la da la disposición tras dividir). */
  plateEstimate: number;
  largest: PlannedPiece | null;
  /** Códigos de piezas que no caben en la cama útil. */
  oversized: string[];
  rotatedCount: number;
  jointCount: number;
  /** Uniones en planos que no admiten el conector previsto. */
  jointsWithoutConnector: number;
  /** Planos que no admiten el conector previsto (eje e índice, 1 = el primero). */
  planesWithoutConnector: Array<{ axis: SplitAxis; number: number }>;
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
export function estimatePlates(pieces: PlannedPiece[], usable: Vec3, gapMm = 5): number {
  if (pieces.length === 0) return 0;
  const W = usable[0];
  const D = usable[2];
  const prints = pieces
    .map((p) => {
      const [a, b] = sortDesc(p.sizeMm);
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
  const largest = plan.pieces.reduce<PlannedPiece | null>((best, p) => (!best || volume(p) > volume(best) ? p : best), null);
  const { x, y, z } = plan.counts;
  const perPlane: Record<SplitAxis, number> = { x: y * z, y: x * z, z: x * y };
  const withoutPlanes = plan.connector ? plan.planes.filter((p) => !p.admitsConnectors) : [];
  return {
    pieceCount: plan.pieces.length,
    plateEstimate: estimatePlates(plan.pieces, plan.usableMm),
    largest,
    oversized: plan.pieces.filter((p) => !pieceFitsUsable(p.sizeMm, plan.usableMm, allowRotation)).map((p) => p.code),
    rotatedCount: plan.pieces.filter((p) => p.rotated).length,
    jointCount: plan.planes.reduce((n, p) => n + perPlane[p.axis], 0),
    jointsWithoutConnector: plan.connector ? withoutPlanes.reduce((n, p) => n + perPlane[p.axis], 0) : plan.planes.reduce((n, p) => n + perPlane[p.axis], 0),
    planesWithoutConnector: withoutPlanes.map((p) => ({ axis: p.axis, number: p.index + 1 })),
  };
}
