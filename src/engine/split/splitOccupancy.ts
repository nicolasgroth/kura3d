/**
 * @file src/engine/split/splitOccupancy.ts
 * @description Conteos reales del plan de "dividir para imprimir": corta el sólido por los planos del
 * plan, separa cada celda en cuerpos y funde los fragmentos igual que la ejecución (`buildBodies`), y
 * cuenta las uniones con contacto real a través de cada plano. Así el resumen previo dice cuántas
 * piezas y uniones resultan de verdad (una tubería en L en rejilla 3×3 da 5 y 4, no 9 y 12).
 * Hasta `OCCUPANCY_EXACT_MAX_CELLS` celdas el conteo es exacto; con más, solo se cortan y separan las
 * celdas (sin fundir fragmentos ni medir contactos) y el resultado se marca `exact: false`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import type { EngineWarning } from '../engineErrors';
import { buildBodies, cellKey, contactSection, MIN_CONTACT_MM2, type Cell } from './splitBodies';
import { cutIntoCells, gridOf, SPLIT_AXES } from './splitCells';
import type { SplitPlanOccupancy, SplitPlane, SplitBounds } from './splitTypes';

/** Celdas hasta las que el conteo del plan es exacto (fusión de fragmentos y contacto real). */
export const OCCUPANCY_EXACT_MAX_CELLS = 64;

interface OccupancyInput {
  bounds: SplitBounds;
  planes: SplitPlane[];
  counts: { x: number; y: number; z: number };
  usableMm: Vec3;
  /** Saliente del macho (mm) que se suma a cada pieza en los ejes con vecina por arriba. */
  protrusionMm: number;
}

/** Conteo barato: celdas con material y cuerpos por celda, uniones = pares de celdas vecinas ocupadas. */
function roughCount(cells: Array<{ cell: Cell; m: Manifold }>, plan: OccupancyInput): SplitPlanOccupancy {
  const occupied: Cell[] = [];
  const sizes: Vec3[] = [];
  const last = [plan.counts.x - 1, plan.counts.y - 1, plan.counts.z - 1];
  let pieces = 0;
  for (const { cell, m } of cells) {
    if (!m.isEmpty() && m.volume() >= 1e-6) {
      occupied.push(cell);
      const comps = m.decompose();
      for (const c of comps) {
        if (c.volume() >= 1e-6) {
          pieces++;
          const bb = c.boundingBox();
          sizes.push([0, 1, 2].map((a) => bb.max[a] - bb.min[a] + (cell[a] < last[a] ? plan.protrusionMm : 0)) as Vec3);
        }
        c.delete();
      }
    }
    m.delete();
  }
  const keys = new Set(occupied.map(cellKey));
  const jointsPerPlane = plan.planes.map((p) => {
    const a = SPLIT_AXES.indexOf(p.axis);
    return occupied.filter((c) => c[a] === p.index && keys.has(cellKey(c.map((v, i) => (i === a ? v + 1 : v)) as Cell))).length;
  });
  return { exact: false, cells: occupied, pieces, joints: jointsPerPlane.reduce((s, n) => s + n, 0), jointsPerPlane, pieceSizesMm: sizes };
}

/**
 * Conteo de piezas y uniones que dará la ejecución del plan. No consume `m`.
 * `minFragmentMm3` debe ser el mismo de la ejecución para que el conteo coincida.
 */
export function measureOccupancy(
  wasm: ManifoldToplevel, m: Manifold, plan: OccupancyInput, minFragmentMm3: number,
  /** Recibe las celdas recién cortadas (sin consumirlas), p. ej. para reutilizarlas en la ejecución. */
  onCells?: (cells: Array<{ cell: Cell; m: Manifold }>) => void,
): SplitPlanOccupancy {
  const { planesBy, bounds } = gridOf(plan);
  const counts = [plan.counts.x, plan.counts.y, plan.counts.z];
  const cells = cutIntoCells(m.translate([0, 0, 0]), planesBy);
  onCells?.(cells);
  if (counts[0] * counts[1] * counts[2] > OCCUPANCY_EXACT_MAX_CELLS) return roughCount(cells, plan);
  const discard: EngineWarning[] = [];
  const { bodies, byCell, cache } = buildBodies(wasm, cells, bounds, { minFragmentMm3, usable: plan.usableMm, codeOf: () => '' }, discard);
  try {
    const jointsPerPlane = plan.planes.map(() => 0);
    for (const low of bodies.values()) {
      for (let a = 0; a < 3; a++) {
        const hc = [...low.cell] as Cell;
        hc[a]++;
        const coord = bounds[a][hc[a]];
        const plane = plan.planes.findIndex((p) => p.axis === SPLIT_AXES[a] && p.index === low.cell[a]);
        if (plane < 0) continue;
        for (const hid of byCell.get(cellKey(hc)) ?? []) {
          const contact = contactSection(cache, low.id, hid, SPLIT_AXES[a], coord);
          if (contact.area() > MIN_CONTACT_MM2) jointsPerPlane[plane]++;
          contact.delete();
        }
      }
    }
    const occupied = [...byCell.keys()].map((k) => k.split(',').map(Number) as Cell);
    const sizes = [...bodies.values()].map((b) => {
      const bb = b.m.boundingBox();
      return [0, 1, 2].map((a) => bb.max[a] - bb.min[a] + (b.cell[a] < counts[a] - 1 ? plan.protrusionMm : 0)) as Vec3;
    });
    return { exact: true, cells: occupied, pieces: bodies.size, joints: jointsPerPlane.reduce((s, n) => s + n, 0), jointsPerPlane, pieceSizesMm: sizes };
  } finally {
    cache.dispose();
    for (const b of bodies.values()) b.m.delete();
  }
}
