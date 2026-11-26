/**
 * @file src/engine/split/splitLooseDowel.ts
 * @description Tarugo suelto (`loose-dowel`) de "dividir para imprimir": un agujero ciego con holgura
 * en CADA pieza de la unión (mitad del tarugo a cada lado del plano) y el tarugo como pieza aparte,
 * impresa sola. A diferencia de `dowel` (espiga fija en la pieza baja, ver `cutConnectorSolid.ts`), no
 * deja salientes en ninguna pieza y entra a lo largo de su eje desde cualquiera de los dos lados.
 * Medidas: agujero de radio `size + tolerance` y profundidad `depth + tolerance` por lado; tarugo de
 * radio `size` y largo `2·depth − 2·tolerance` (holgura en cada fondo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import type { SplitAxis, SplitConnectorOptions } from './splitTypes';

const SEGMENTS = 24;
/** Separación entre tarugos en la placa del lote (mm). */
const BATCH_GAP_MM = 3;

/** Tipo para la disposición y la huella: el tarugo suelto y el imán ocupan como una espiga cilíndrica. */
export const layoutType = (t: SplitConnectorOptions['type']) =>
  (t === 'loose-dowel' || t === 'magnet' ? 'dowel' : t) as Exclude<SplitConnectorOptions['type'], 'lap' | 'loose-dowel' | 'magnet'>;

/** Largo del tarugo impreso (mm). */
export const looseDowelLength = (c: Pick<SplitConnectorOptions, 'depth' | 'tolerance'>) => Math.max(1, 2 * c.depth - 2 * c.tolerance);

/** Profundidad del agujero por lado (mm). */
export const looseDowelHoleDepth = (c: Pick<SplitConnectorOptions, 'depth' | 'tolerance'>) => c.depth + c.tolerance;

/** Lleva un sólido construido a lo largo de +Z local al eje de la unión. */
function orient(m: Manifold, axis: SplitAxis): Manifold {
  if (axis === 'z') return m;
  const r = axis === 'y' ? m.rotate([-90, 0, 0]) : m.rotate([0, 90, 0]);
  m.delete();
  return r;
}

/**
 * Agujeros de un tarugo en el plano `center[eje]`: `low` (de plano − profundidad al plano + 0,5) para la
 * pieza baja y `high` (de plano − 0,5 a plano + profundidad) para la alta. El medio milímetro de más
 * cruza el plano para no dejar caras coplanares.
 */
export function buildLooseDowelHoles(
  wasm: ManifoldToplevel,
  axis: SplitAxis,
  center: Vec3,
  c: SplitConnectorOptions,
): { low: Manifold; high: Manifold } {
  const r = c.size + c.tolerance;
  const d = looseDowelHoleDepth(c);
  const cyl = (from: number, len: number) => {
    const raw = wasm.Manifold.cylinder(len, r, r, SEGMENTS, false);
    const moved = raw.translate([0, 0, from]);
    raw.delete();
    const o = orient(moved, axis);
    const t = o.translate(center);
    o.delete();
    return t;
  };
  return { low: cyl(-d, d + 0.5), high: cyl(-0.5, d + 0.5) };
}

/** Lote de `count` tarugos de pie (eje Y) en una rejilla, base en Y = 0 y centrado en X/Z. */
export function buildLooseDowelBatch(wasm: ManifoldToplevel, c: SplitConnectorOptions, count: number): Manifold {
  const len = looseDowelLength(c);
  const pitch = 2 * c.size + BATCH_GAP_MM;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const items: Manifold[] = [];
  for (let i = 0; i < count; i++) {
    const raw = wasm.Manifold.cylinder(len, c.size, c.size, SEGMENTS, false);
    const up = raw.rotate([-90, 0, 0]);
    raw.delete();
    const x = (i % cols) * pitch - ((cols - 1) * pitch) / 2;
    const z = Math.floor(i / cols) * pitch - ((rows - 1) * pitch) / 2;
    items.push(up.translate([x, 0, z]));
    up.delete();
  }
  const out = wasm.Manifold.compose(items);
  for (const m of items) m.delete();
  return out;
}
