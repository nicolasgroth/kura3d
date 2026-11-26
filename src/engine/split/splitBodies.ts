/**
 * @file src/engine/split/splitBodies.ts
 * @description Piezas de un solo cuerpo y contacto real entre piezas de "dividir para imprimir". Cada
 * celda cortada se descompone en cuerpos (`Manifold.decompose`); los diminutos (volumen < umbral) se
 * funden con la pieza vecina con la que comparten más cara si el resultado cabe en la cama, y si no
 * quedan como pieza propia con aviso. Las celdas con varios cuerpos dan códigos "B5a·1", "B5a·2"
 * (de mayor a menor volumen). El contacto entre dos piezas por un plano es la intersección de sus
 * secciones a cada lado del plano (en el marco orientado de `splitSections.ts`): una unión existe solo
 * si esa área supera `MIN_CONTACT_MM2`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { engineWarning, type EngineWarning } from '../engineErrors';
import { AXIS_INDEX, fittingRotation, orientForAxis } from './splitSections';
import type { SplitAxis } from './splitTypes';

export type Cell = [number, number, number];
export const cellKey = (c: Cell) => c.join(',');

/** Área mínima de contacto para que haya unión (mm²). */
export const MIN_CONTACT_MM2 = 1;
/**
 * Fragmento que no se entrega como pieza (se descarta con `SPLIT_FRAGMENTS_DISCARDED`) si, tras intentar fusionarlo,
 * queda bajo el mayor de `SPLIT_DISCARD_FRAGMENT_MM3` (1 mm³: un cubo de 1 mm, menos que una gota de material y nada
 * que se pueda imprimir y pegar) y `SPLIT_DISCARD_FRAGMENT_REL` del volumen de la pieza (10 ppm: en una figura de
 * 1 L son 10 mm³). Medido: una figura real escalada y girada dejó una pieza de 0,1 mm³.
 */
export const SPLIT_DISCARD_FRAGMENT_MM3 = 1;
export const SPLIT_DISCARD_FRAGMENT_REL = 1e-5;
/** Distancia a la que se secciona cada pieza a un lado del plano (mm). */
const SIDE_EPS = 0.01;
const AXES: SplitAxis[] = ['x', 'y', 'z'];

/** Pieza en construcción: cuerpo, su celda, sólidos a sumar/restar y etiquetas. */
/** Cuánto sobresale una caja de la caja de su celda (mm, 0 si queda dentro). */
function protrusion(bb: { min: ArrayLike<number>; max: ArrayLike<number> }, cell: Cell, bounds: number[][]): number {
  let out = 0;
  for (let a = 0; a < 3; a++) {
    out = Math.max(out, bb.max[a] - bounds[a][cell[a] + 1], bounds[a][cell[a]] - bb.min[a]);
  }
  return out;
}

export interface SplitBody {
  id: number;
  cell: Cell;
  code: string;
  m: Manifold;
  adds: Manifold[];
  subs: Manifold[];
  labels: string[];
}

/** Secciones orientadas de cada pieza a cada lado de un plano, con caché. `dispose` libera todo. */
export class SectionCache {
  private cache = new Map<string, CrossSection>();
  constructor(private bodies: Map<number, SplitBody>) {}

  /** Sección de `id` junto a `coord` del lado interior (`side` = −1 bajo el plano, +1 sobre). */
  get(id: number, axis: SplitAxis, coord: number, side: -1 | 1): CrossSection {
    const k = `${id}|${axis}|${coord}|${side}`;
    let cs = this.cache.get(k);
    if (!cs) {
      const { oriented, owned } = orientForAxis(this.bodies.get(id)!.m, axis);
      cs = oriented.slice(coord + side * SIDE_EPS);
      if (owned) oriented.delete();
      this.cache.set(k, cs);
    }
    return cs;
  }

  /** Olvida las secciones de una pieza (tras cambiar su sólido). */
  invalidate(id: number): void {
    for (const [k, cs] of this.cache) {
      if (k.startsWith(`${id}|`)) {
        cs.delete();
        this.cache.delete(k);
      }
    }
  }

  dispose(): void {
    for (const cs of this.cache.values()) cs.delete();
    this.cache.clear();
  }
}

/** Contacto entre `low` (bajo el plano) y `high` (sobre el plano). El llamador libera. */
export function contactSection(cache: SectionCache, low: number, high: number, axis: SplitAxis, coord: number): CrossSection {
  return cache.get(low, axis, coord, -1).intersect(cache.get(high, axis, coord, 1));
}

/** Vecinos de una pieza que tocan su cara en el plano `coord` del eje (con el área de contacto). */
function neighborContacts(
  bodies: Map<number, SplitBody>,
  byCell: Map<string, number[]>,
  cache: SectionCache,
  id: number,
  bounds: number[][],
): Array<{ other: number; area: number }> {
  const b = bodies.get(id)!;
  const out: Array<{ other: number; area: number }> = [];
  for (const axis of AXES) {
    const a = AXIS_INDEX[axis];
    for (const dir of [-1, 1] as const) {
      const nc = [...b.cell] as Cell;
      nc[a] += dir;
      for (const other of byCell.get(cellKey(nc)) ?? []) {
        const coord = bounds[a][dir > 0 ? b.cell[a] + 1 : b.cell[a]];
        const cs = dir > 0 ? contactSection(cache, id, other, axis, coord) : contactSection(cache, other, id, axis, coord);
        const area = cs.area();
        cs.delete();
        if (area > MIN_CONTACT_MM2) out.push({ other, area });
      }
    }
  }
  return out.sort((p, q) => q.area - p.area);
}

/**
 * Separa las celdas en cuerpos, funde fragmentos y asigna códigos. Consume los manifolds de `cells`.
 */
export function buildBodies(
  wasm: ManifoldToplevel,
  cells: Array<{ cell: Cell; m: Manifold }>,
  bounds: number[][],
  opts: { minFragmentMm3: number; usable: Vec3; codeOf: (c: Cell) => string },
  warnings: EngineWarning[],
): { bodies: Map<number, SplitBody>; byCell: Map<string, number[]>; cache: SectionCache } {
  const bodies = new Map<number, SplitBody>();
  const byCell = new Map<string, number[]>();
  let next = 0;
  let empty = 0;
  for (const { cell, m } of cells) {
    const comps = m.isEmpty() ? [] : m.decompose();
    m.delete();
    const kept = comps.filter((c) => {
      if (c.volume() >= 1e-6) return true;
      c.delete();
      return false;
    });
    if (kept.length === 0) {
      empty++;
      continue;
    }
    kept.sort((p, q) => q.volume() - p.volume());
    const ids: number[] = [];
    for (const c of kept) {
      bodies.set(next, { id: next, cell, code: '', m: c, adds: [], subs: [], labels: [] });
      ids.push(next++);
    }
    byCell.set(cellKey(cell), ids);
  }
  if (empty > 0) warnings.push(engineWarning('SPLIT_EMPTY_CELLS', { count: empty }));
  const cache = new SectionCache(bodies);
  let total = 0;
  for (const b of bodies.values()) total += b.m.volume();
  const discardBelow = Math.max(SPLIT_DISCARD_FRAGMENT_MM3, SPLIT_DISCARD_FRAGMENT_REL * total);
  if (opts.minFragmentMm3 > 0) {
    const fragments = [...bodies.values()].filter((b) => b.m.volume() < opts.minFragmentMm3).sort((p, q) => p.m.volume() - q.m.volume());
    for (const frag of fragments) {
      if (!bodies.has(frag.id)) continue;
      let merged = false;
      for (const { other } of neighborContacts(bodies, byCell, cache, frag.id, bounds)) {
        const target = bodies.get(other)!;
        const u = wasm.Manifold.union(target.m, frag.m);
        const bb = u.boundingBox();
        const size = [0, 1, 2].map((a) => bb.max[a] - bb.min[a]) as Vec3;
        const parts = u.decompose();
        const single = parts.length === 1;
        for (const p of parts) p.delete();
        if (!single || !fittingRotation(size, opts.usable, true)) {
          u.delete();
          continue;
        }
        // La pieza que absorbe el fragmento cruza el plano de corte a propósito: se informa cuánto
        const out = protrusion(bb, target.cell, bounds);
        if (out > 1e-3) {
          warnings.push(engineWarning('SPLIT_FRAGMENT_MERGED', {
            code: opts.codeOf(target.cell), volume: Math.round(frag.m.volume()), protrusion: Math.round(out * 100) / 100,
          }));
        }
        target.m.delete();
        target.m = u;
        frag.m.delete();
        bodies.delete(frag.id);
        const list = byCell.get(cellKey(frag.cell))!;
        list.splice(list.indexOf(frag.id), 1);
        if (list.length === 0) byCell.delete(cellKey(frag.cell));
        cache.invalidate(other);
        cache.invalidate(frag.id);
        merged = true;
        break;
      }
      if (!merged && frag.m.volume() >= discardBelow) {
        warnings.push(engineWarning('SPLIT_FRAGMENT_KEPT', { code: opts.codeOf(frag.cell), volume: Math.round(frag.m.volume()) }));
      }
    }
  }
  discardTinyFragments(bodies, byCell, cache, discardBelow, warnings);
  for (const [k, ids] of byCell) {
    const cell = bodies.get(ids[0])!.cell;
    const base = opts.codeOf(cell);
    ids.forEach((id, i) => {
      bodies.get(id)!.code = ids.length > 1 ? `${base}·${i + 1}` : base;
    });
    void k;
  }
  return { bodies, byCell, cache };
}

/**
 * Quita los cuerpos bajo `below` mm³ (los que no se pudieron fusionar): no se entregan como pieza y un aviso dice
 * cuántos y su volumen total. Nunca deja la división sin piezas. Los códigos se asignan después, sin huecos.
 */
function discardTinyFragments(
  bodies: Map<number, SplitBody>,
  byCell: Map<string, number[]>,
  cache: SectionCache,
  below: number,
  warnings: EngineWarning[],
): void {
  const tiny = [...bodies.values()].filter((b) => b.m.volume() < below);
  if (tiny.length === 0 || tiny.length >= bodies.size) return;
  let volume = 0;
  for (const b of tiny) {
    volume += b.m.volume();
    cache.invalidate(b.id);
    b.m.delete();
    bodies.delete(b.id);
    const list = byCell.get(cellKey(b.cell))!;
    list.splice(list.indexOf(b.id), 1);
    if (list.length === 0) byCell.delete(cellKey(b.cell));
  }
  warnings.push(engineWarning('SPLIT_FRAGMENTS_DISCARDED', { count: tiny.length, volume: Math.round(volume * 100) / 100 }));
}
