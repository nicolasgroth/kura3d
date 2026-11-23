/**
 * @file src/core/scene/splitOccupiedPieces.ts
 * @description Piezas del plan de Dividir que existirán de verdad: las celdas con material según el
 * conteo exacto del plan (`plan.occupancy.cells`). Sin ese conteo se devuelven todas las celdas.
 * Así los rótulos y cajas de la vista previa coinciden con las piezas que resultan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { BedSplitPlan, PlannedPiece } from '../../engine/split/splitTypes';

export function occupiedPieces(plan: Pick<BedSplitPlan, 'pieces' | 'occupancy'>): PlannedPiece[] {
  const cells = plan.occupancy?.cells;
  if (!cells || cells.length === 0) return plan.pieces;
  const filled = new Set(cells.map((c) => c.join(',')));
  return plan.pieces.filter((piece) => filled.has(piece.cell.join(',')));
}
