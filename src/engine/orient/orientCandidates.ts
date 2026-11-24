/**
 * @file src/engine/orient/orientCandidates.ts
 * @description Direcciones candidatas para apoyar la pieza: la orientación actual, las 6 de ejes y
 * las caras del casco convexo agrupadas por normal (ordenadas por área de apoyo). Se deduplican
 * por ángulo (2°) conservando la primera: actual, luego ejes, luego casco.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Vec3 } from '../../types/kura';
import type { OrientSource } from './orientTypes';

export interface DirectionCandidate {
  id: string;
  source: OrientSource;
  /** Dirección unitaria (mundo) que irá hacia la cama. */
  down: Vec3;
  /** Área del grupo de caras del casco (0 en actual y ejes). */
  hullArea: number;
}

const AXES: Array<[string, Vec3]> = [
  ['-y', [0, -1, 0]], ['+y', [0, 1, 0]], ['-x', [-1, 0, 0]], ['+x', [1, 0, 0]], ['-z', [0, 0, -1]], ['+z', [0, 0, 1]],
];

/** Tolerancia de agrupamiento de normales del casco: celdas de 0,02 por componente (~1,1°). */
const NORMAL_QUANTUM = 0.02;
export const DEDUPE_COS = Math.cos((2 * Math.PI) / 180);

/** Agrupa caras del casco por normal cuantizada; devuelve grupos (normal media ponderada, área) por área descendente. */
export function groupHullFaces(faces: ReadonlyArray<{ normal: Vec3; area: number }>): Array<{ normal: Vec3; area: number }> {
  const groups = new Map<string, { sx: number; sy: number; sz: number; area: number }>();
  for (const f of faces) {
    if (!(f.area > 0)) continue;
    const key = `${Math.round(f.normal[0] / NORMAL_QUANTUM)},${Math.round(f.normal[1] / NORMAL_QUANTUM)},${Math.round(f.normal[2] / NORMAL_QUANTUM)}`;
    const g = groups.get(key) ?? { sx: 0, sy: 0, sz: 0, area: 0 };
    g.sx += f.normal[0] * f.area; g.sy += f.normal[1] * f.area; g.sz += f.normal[2] * f.area; g.area += f.area;
    groups.set(key, g);
  }
  const out: Array<{ normal: Vec3; area: number }> = [];
  for (const g of groups.values()) {
    const len = Math.hypot(g.sx, g.sy, g.sz);
    if (len > 0) out.push({ normal: [g.sx / len, g.sy / len, g.sz / len], area: g.area });
  }
  return out.sort((a, b) => b.area - a.area);
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Lista deduplicada: actual (−Y mundo), ejes y hasta `maxHull` grupos del casco con área ≥ `minArea`.
 * Los del casco se filtran después por estabilidad; aquí se entregan de más (×3) para tener margen.
 */
export function directionCandidates(
  hullFaces: ReadonlyArray<{ normal: Vec3; area: number }>,
  maxHull: number,
  minArea: number,
): DirectionCandidate[] {
  const out: DirectionCandidate[] = [{ id: 'current', source: 'current', down: [0, -1, 0], hullArea: 0 }];
  const push = (c: DirectionCandidate) => {
    if (out.some((o) => dot(o.down, c.down) > DEDUPE_COS)) return false;
    out.push(c);
    return true;
  };
  for (const [name, d] of AXES) push({ id: `axis${name}`, source: 'axis', down: d, hullArea: 0 });
  let taken = 0;
  for (const g of groupHullFaces(hullFaces)) {
    if (taken >= maxHull * 3 || g.area < minArea) break;
    if (push({ id: `hull${taken}`, source: 'hull', down: g.normal, hullArea: g.area })) taken++;
  }
  return out;
}
