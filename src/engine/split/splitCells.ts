/**
 * @file src/engine/split/splitCells.ts
 * @description Corte del sólido mundial en celdas de la rejilla de "dividir para imprimir": planos del
 * plan ordenados por eje, límites de cada tramo y `splitByPlane` en secuencia X → Y → Z. Lo comparten
 * la ejecución (`splitExecute.ts`) y los conteos reales del plan (`splitOccupancy.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import type { Cell } from './splitBodies';
import { AXIS_INDEX } from './splitSections';
import type { SplitAxis, SplitBounds, SplitPlane } from './splitTypes';

export const SPLIT_AXES: SplitAxis[] = ['x', 'y', 'z'];
const NORMALS: Record<SplitAxis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/** Posiciones de los planos por eje (ordenadas) y límites de los tramos `[min, …planos, max]`. */
export function gridOf(plan: { bounds: SplitBounds; planes: SplitPlane[] }): { planesBy: number[][]; bounds: number[][] } {
  const planesBy = SPLIT_AXES.map((axis) => plan.planes.filter((p) => p.axis === axis).map((p) => p.position).sort((a, b) => a - b));
  const bounds = SPLIT_AXES.map((_, a) => [plan.bounds.min[a], ...planesBy[a], plan.bounds.max[a]]);
  return { planesBy, bounds };
}

/** Corta por los planos de un eje cada pieza de la lista; devuelve la nueva lista con su celda. Consume la entrada. */
export function cutAxis(
  cells: Array<{ cell: Cell; m: Manifold }>,
  axis: SplitAxis,
  planes: number[],
  tick: () => void = () => {},
): Array<{ cell: Cell; m: Manifold }> {
  if (planes.length === 0) return cells;
  const a = AXIS_INDEX[axis];
  const out: Array<{ cell: Cell; m: Manifold }> = [];
  for (const { cell, m } of cells) {
    let rest = m;
    planes.forEach((p, t) => {
      const [above, below] = rest.splitByPlane(NORMALS[axis], p);
      if (rest !== m || t > 0) rest.delete();
      const c = [...cell] as Cell;
      c[a] = t;
      out.push({ cell: c, m: below });
      rest = above;
      tick();
    });
    const c = [...cell] as Cell;
    c[a] = planes.length;
    out.push({ cell: c, m: rest });
    m.delete();
  }
  return out;
}

/** Corta `source` en todas las celdas (consume `source`). */
export function cutIntoCells(source: Manifold, planesBy: number[][], tick?: () => void): Array<{ cell: Cell; m: Manifold }> {
  let cells: Array<{ cell: Cell; m: Manifold }> = [{ cell: [0, 0, 0], m: source }];
  for (let a = 0; a < 3; a++) cells = cutAxis(cells, SPLIT_AXES[a], planesBy[a], tick);
  return cells;
}
