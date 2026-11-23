/**
 * @file src/core/scene/splitGroups.ts
 * @description Reglas de escena de los grupos de "dividir para imprimir": piezas de un grupo,
 * disposición actual (armado o impresión), cambio que mueve el grupo a su armado o a sus placas de
 * impresión (una al lado de otra en X), si una medida excede la cama, y nombre de archivo por pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { explodedTransforms } from '../../engine/split/splitLayout';
import type { SceneObject, SplitPartMetadata, Vec3 } from '../../types/kura';

/** Separación entre placas virtuales (mm). */
export const SPLIT_PLATE_GAP_MM = 40;

export type SplitArrangement = 'assembly' | 'print';

export interface SplitGroup {
  groupId: string;
  parts: Array<SceneObject & { metadata: { split: SplitPartMetadata } }>;
}

const splitOf = (o: SceneObject) => o.metadata?.split ?? null;

/** Grupo de la pieza `id` (o null si no es una pieza de una división). */
export function splitGroupOf(objects: SceneObject[], id: string | null | undefined): SplitGroup | null {
  const obj = id ? objects.find((o) => o.id === id) : undefined;
  const meta = obj ? splitOf(obj) : null;
  if (!meta) return null;
  const parts = objects.filter((o) => splitOf(o)?.groupId === meta.groupId) as SplitGroup['parts'];
  return { groupId: meta.groupId, parts };
}

/** Desplazamiento en X de la placa `plate` (la placa 0 es la cama real, centrada en el origen). */
export function plateOffsetX(plate: number, bedWidthMm: number): number {
  return plate * (bedWidthMm + SPLIT_PLATE_GAP_MM);
}

/** Transformación de mundo de una pieza en la disposición pedida. */
export function splitTransformFor(meta: SplitPartMetadata, mode: SplitArrangement, bedWidthMm: number): { position: Vec3; rotation: Vec3 } {
  if (mode === 'assembly') return { position: [...meta.assembly.position] as Vec3, rotation: [...meta.assembly.rotation] as Vec3 };
  const p = meta.print.position;
  return { position: [p[0] + plateOffsetX(meta.print.plate, bedWidthMm), p[1], p[2]], rotation: [...meta.print.rotation] as Vec3 };
}

const near = (a: readonly number[], b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-3);

/** Disposición actual del grupo: armado, impresión o `null` si las piezas se movieron a mano. */
export function splitArrangementOf(group: SplitGroup, bedWidthMm: number): SplitArrangement | null {
  for (const mode of ['assembly', 'print'] as const) {
    const all = group.parts.every((o) => {
      const t = splitTransformFor(o.metadata.split, mode, bedWidthMm);
      return near(o.position, t.position) && near(o.rotation, t.rotation);
    });
    if (all) return mode;
  }
  return null;
}

/** Parches que llevan las piezas del grupo a la disposición pedida (vacío si ya están ahí). */
export function arrangeSplitGroupPatches(
  group: SplitGroup,
  mode: SplitArrangement,
  bedWidthMm: number,
): Array<{ id: string; patch: { position: Vec3; rotation: Vec3 } }> {
  return group.parts
    .filter((o) => !o.locked)
    .map((o) => ({ id: o.id, patch: splitTransformFor(o.metadata.split, mode, bedWidthMm) }))
    .filter(({ id, patch }) => {
      const o = group.parts.find((p) => p.id === id)!;
      return !(near(o.position, patch.position) && near(o.rotation, patch.rotation));
    });
}

/** Placas que usa el grupo (cantidad). */
export function splitPlateCount(group: SplitGroup): number {
  return group.parts.reduce((n, o) => Math.max(n, o.metadata.split.print.plate + 1), 0);
}

/** true si una caja de `size` [X ancho, Y alto, Z fondo] no cabe en la cama sin girarla. */
export function exceedsBed(size: Vec3, bed: { widthMm: number; depthMm: number; heightMm: number }): boolean {
  const eps = 0.05;
  return size[0] > bed.widthMm + eps || size[1] > bed.heightMm + eps || size[2] > bed.depthMm + eps;
}

/** Nombre de archivo de una pieza: `<proyecto>_<código>.<ext>`, sin caracteres problemáticos. */
export function splitPartFileName(project: string, code: string, ext: string): string {
  // ASCII sin acentos: un ZIP sin la bandera UTF-8 muestra mal otros caracteres en algunos sistemas.
  const clean = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/[^A-Za-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '');
  const base = clean(project) || 'kura3d';
  return `${base}_${clean(code) || 'pieza'}.${ext.replace(/^\./, '')}`;
}

/**
 * Posiciones de la vista explosionada del grupo (0 = armado exacto, 1 = separadas). Usa la caja de
 * armado de cada pieza (malla local con centro X/Z en 0 y base en Y=0). Solo visual.
 */
export function explodedSplitPositions(group: SplitGroup, factor: number, spread = 0.6): Map<string, Vec3> {
  const items = group.parts.map((o) => {
    const meta = o.metadata.split;
    const [dx, dy, dz] = o.stats.dimensionsMm;
    const p = meta.assembly.position;
    return {
      assembly: meta.assembly,
      bounds: { min: [p[0] - dx / 2, p[1], p[2] - dz / 2] as Vec3, max: [p[0] + dx / 2, p[1] + dy, p[2] + dz / 2] as Vec3 },
    };
  });
  const transforms = explodedTransforms(items, factor, spread);
  // Ninguna pieza queda bajo la cama (Z=0 del usuario): separar hacia abajo levanta todo el conjunto,
  // y un armado que ya dejaba una pieza bajo la cama se apoya en ella.
  let lowest = Infinity;
  transforms.forEach((tr, i) => {
    lowest = Math.min(lowest, items[i].bounds.min[1] + (tr.position[1] - items[i].assembly.position[1]));
  });
  const lift = Number.isFinite(lowest) && lowest < 0 ? -lowest : 0;
  const out = new Map<string, Vec3>();
  transforms.forEach((tr, i) => out.set(group.parts[i].id, [tr.position[0], tr.position[1] + lift, tr.position[2]]));
  return out;
}
