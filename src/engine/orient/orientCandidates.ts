/**
 * @file src/engine/orient/orientCandidates.ts
 * @description Direcciones candidatas para apoyar la pieza: la orientación actual, las 6 de ejes y
 * las caras del casco convexo agrupadas por normal. Un grupo del casco solo es candidato si apoya
 * de forma estable: polígono de apoyo con área suficiente y centro de masa proyectado dentro con un
 * ángulo de vuelco mínimo (se calcula con los vértices del grupo, sin medir la malla). Se deduplican
 * por ángulo (2°) conservando la primera: actual, luego ejes, luego casco (por área de apoyo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Vec3 } from '../../types/kura';
import { convexHull2, insideMargin, polygonArea } from './orientPlanar';
import type { OrientSource } from './orientTypes';

export interface DirectionCandidate {
  id: string;
  source: OrientSource;
  /** Dirección unitaria (mundo) que irá hacia la cama. */
  down: Vec3;
}

/** Cara del casco: normal hacia fuera, área y vértices intercalados [x, y, z, …]. */
export interface HullFace { normal: Vec3; area: number; loop: number[] }

export interface HullGroup {
  normal: Vec3;
  /** Área del polígono de apoyo (casco 2D de los vértices del grupo). */
  areaMm2: number;
  tipAngleDeg: number;
}

const AXES: Array<[string, Vec3]> = [
  ['-y', [0, -1, 0]], ['+y', [0, 1, 0]], ['-x', [-1, 0, 0]], ['+x', [1, 0, 0]], ['-z', [0, 0, -1]], ['+z', [0, 0, 1]],
];

/** Agrupamiento de normales del casco: celdas de 0,02 por componente (~1,1°). */
const NORMAL_QUANTUM = 0.02;
export const DEDUPE_COS = Math.cos((2 * Math.PI) / 180);

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Polígono de apoyo y ángulo de vuelco de un grupo coplanar, en su plano. */
function groupStability(n: Vec3, pts: number[], com: Vec3): { areaMm2: number; tipAngleDeg: number } {
  // Base ortonormal (u, v) del plano.
  const ref: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u: Vec3 = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]];
  const ul = Math.hypot(...u);
  u[0] /= ul; u[1] /= ul; u[2] /= ul;
  const v: Vec3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const flat = new Float64Array((pts.length / 3) * 2);
  let plane = -Infinity;
  for (let i = 0, j = 0; i < pts.length; i += 3, j += 2) {
    const p: Vec3 = [pts[i], pts[i + 1], pts[i + 2]];
    flat[j] = dot(p, u); flat[j + 1] = dot(p, v);
    plane = Math.max(plane, dot(p, n));
  }
  const poly = convexHull2(flat);
  const height = Math.max(plane - dot(com, n), 1e-9);
  const margin = insideMargin(poly, dot(com, u), dot(com, v));
  return { areaMm2: polygonArea(poly), tipAngleDeg: (Math.atan2(margin, height) * 180) / Math.PI };
}

/** Agrupa caras del casco por normal cuantizada y mide la estabilidad de cada grupo; orden por área. */
export function groupHullFaces(faces: ReadonlyArray<HullFace>, com: Vec3): HullGroup[] {
  const groups = new Map<string, { sx: number; sy: number; sz: number; pts: number[] }>();
  for (const f of faces) {
    if (!(f.area > 0)) continue;
    const key = `${Math.round(f.normal[0] / NORMAL_QUANTUM)},${Math.round(f.normal[1] / NORMAL_QUANTUM)},${Math.round(f.normal[2] / NORMAL_QUANTUM)}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { sx: 0, sy: 0, sz: 0, pts: [] }));
    g.sx += f.normal[0] * f.area; g.sy += f.normal[1] * f.area; g.sz += f.normal[2] * f.area;
    for (const c of f.loop) g.pts.push(c);
  }
  const out: HullGroup[] = [];
  for (const g of groups.values()) {
    const len = Math.hypot(g.sx, g.sy, g.sz);
    if (!(len > 0)) continue;
    const normal: Vec3 = [g.sx / len, g.sy / len, g.sz / len];
    out.push({ normal, ...groupStability(normal, g.pts, com) });
  }
  return out.sort((a, b) => b.areaMm2 - a.areaMm2);
}

/**
 * Lista deduplicada: actual (−Y mundo), los 6 ejes y hasta `maxHull` grupos del casco estables
 * (área ≥ `minArea` y vuelco ≥ `minTipDeg`). La medición completa confirma la estabilidad.
 */
export function directionCandidates(groups: readonly HullGroup[], maxHull: number, minArea: number, minTipDeg: number): DirectionCandidate[] {
  const out: DirectionCandidate[] = [{ id: 'current', source: 'current', down: [0, -1, 0] }];
  const push = (c: DirectionCandidate) => {
    if (out.some((o) => dot(o.down, c.down) > DEDUPE_COS)) return false;
    out.push(c);
    return true;
  };
  for (const [name, d] of AXES) push({ id: `axis${name}`, source: 'axis', down: d });
  let taken = 0;
  for (const g of groups) {
    if (taken >= maxHull) break;
    if (g.areaMm2 < minArea || g.tipAngleDeg < minTipDeg) continue;
    if (push({ id: `hull${taken}`, source: 'hull', down: g.normal })) taken++;
  }
  return out;
}
