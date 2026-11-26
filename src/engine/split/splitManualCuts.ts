/**
 * @file src/engine/split/splitManualCuts.ts
 * @description Cortes a mano de "dividir para imprimir": normal y desplazamiento de cada plano (eje base + dos
 * ángulos de inclinación), validación estricta de la lista (eje, posición dentro del modelo, ángulos, cantidad) y
 * detección de planos del mismo eje que se cruzan dentro del modelo (bloquea: la pieza entre ambos no tendría
 * celda definida). También la rotación que lleva la normal de un plano inclinado a su eje base, con la que las
 * uniones se arman en un marco donde la cara es recta (`splitTiltedJoint.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Mat4 } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { AXIS_INDEX } from './splitSections';
import type { SplitAxis, SplitBounds, SplitManualCut } from './splitTypes';

/** Máximo de planos a mano por plan. */
export const SPLIT_MANUAL_MAX_CUTS = 24;
/** Inclinación máxima de cada ángulo (grados): más allá el eje base deja de ser el dominante. */
export const SPLIT_MANUAL_MAX_TILT_DEG = 45;
/** Bajo este ángulo (grados) el plano se trata como recto. */
const TILT_EPS_DEG = 1e-3;

/** Ejes hacia los que se inclina cada eje base (orden de `tiltDeg`). */
export const TILT_AXES: Record<SplitAxis, [SplitAxis, SplitAxis]> = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] };

/** Corte a mano ya validado, con su plano en mundo (`normal · x = offset`). */
export interface ResolvedCut {
  id?: string;
  /** Posición en la lista pedida (0 = el primero). */
  inputIndex: number;
  axis: SplitAxis;
  positionMm: number;
  tiltDeg: [number, number];
  tilted: boolean;
  normal: Vec3;
  offset: number;
}

export function isTiltedCut(cut: Pick<SplitManualCut, 'tiltDeg'>): boolean {
  return Boolean(cut.tiltDeg && cut.tiltDeg.some((v) => Math.abs(v) > TILT_EPS_DEG));
}

/** Normal unitaria del corte (ver `SplitManualCut`). */
export function cutNormal(axis: SplitAxis, tiltDeg: [number, number] = [0, 0]): Vec3 {
  const n: Vec3 = [0, 0, 0];
  n[AXIS_INDEX[axis]] = 1;
  const [u, v] = TILT_AXES[axis];
  n[AXIS_INDEX[u]] = Math.tan((tiltDeg[0] * Math.PI) / 180);
  n[AXIS_INDEX[v]] = Math.tan((tiltDeg[1] * Math.PI) / 180);
  const len = Math.hypot(n[0], n[1], n[2]);
  return [n[0] / len, n[1] / len, n[2] / len];
}

const center = (b: SplitBounds): Vec3 => [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2) as Vec3;

/** Coordenada del plano en su eje base en el punto (u, v) de los otros dos ejes. */
function positionAt(c: ResolvedCut, p: Vec3): number {
  const a = AXIS_INDEX[c.axis];
  let rest = 0;
  for (let i = 0; i < 3; i++) if (i !== a) rest += c.normal[i] * p[i];
  return (c.offset - rest) / c.normal[a];
}

/** Esquinas de la caja en los dos ejes que no son `axis` (la coordenada del eje queda en el centro). */
function sideCorners(axis: SplitAxis, b: SplitBounds): Vec3[] {
  const a = AXIS_INDEX[axis];
  const others = [0, 1, 2].filter((i) => i !== a);
  const out: Vec3[] = [];
  for (const lo of [true, false]) {
    for (const lo2 of [true, false]) {
      const p = center(b);
      p[others[0]] = lo ? b.min[others[0]] : b.max[others[0]];
      p[others[1]] = lo2 ? b.min[others[1]] : b.max[others[1]];
      out.push(p);
    }
  }
  return out;
}

/** Tramo mínimo y máximo (mm) entre dos planos del mismo eje dentro de la caja; negativo = se cruzan. */
export function gapRange(lo: ResolvedCut, hi: ResolvedCut, b: SplitBounds): { min: number; max: number } {
  const gaps = sideCorners(lo.axis, b).map((p) => positionAt(hi, p) - positionAt(lo, p));
  return { min: Math.min(...gaps), max: Math.max(...gaps) };
}

/** Extremos (mm) que alcanza el plano en su eje base dentro de la caja. */
export function cutSpan(c: ResolvedCut, b: SplitBounds): { min: number; max: number } {
  const at = sideCorners(c.axis, b).map((p) => positionAt(c, p));
  return { min: Math.min(...at), max: Math.max(...at) };
}

const invalid = (name: string, value: unknown, min: number, max: number) =>
  new EngineError('INVALID_PARAMETER', { name, value: String(value), min, max });

/**
 * Valida la lista contra la caja del modelo y la devuelve ordenada por eje y posición. Lanza `INVALID_PARAMETER`
 * (lista vacía o larga, eje, posición fuera del modelo, ángulo fuera de rango) o `SPLIT_MANUAL_CUTS_CROSS` (dos
 * planos del mismo eje que se cruzan o se tocan dentro del modelo).
 */
export function resolveManualCuts(cuts: readonly SplitManualCut[], b: SplitBounds): ResolvedCut[] {
  if (!Array.isArray(cuts) || cuts.length < 1 || cuts.length > SPLIT_MANUAL_MAX_CUTS) {
    throw invalid('manualCuts', Array.isArray(cuts) ? cuts.length : cuts, 1, SPLIT_MANUAL_MAX_CUTS);
  }
  const c0 = center(b);
  const list: readonly SplitManualCut[] = cuts;
  const out = list.map((cut: SplitManualCut, i: number): ResolvedCut => {
    if (!cut || !['x', 'y', 'z'].includes(cut.axis)) throw invalid(`manualCuts[${i}].axis`, cut?.axis, 0, 2);
    const a = AXIS_INDEX[cut.axis];
    const pos = cut.positionMm;
    if (!(Number.isFinite(pos) && pos > b.min[a] && pos < b.max[a])) {
      throw invalid(`manualCuts[${i}].positionMm`, pos, Math.round(b.min[a] * 100) / 100, Math.round(b.max[a] * 100) / 100);
    }
    const tilt = cut.tiltDeg ?? [0, 0];
    if (!Array.isArray(tilt) || tilt.length !== 2) throw invalid(`manualCuts[${i}].tiltDeg`, tilt, -SPLIT_MANUAL_MAX_TILT_DEG, SPLIT_MANUAL_MAX_TILT_DEG);
    tilt.forEach((v, k) => {
      if (!(Number.isFinite(v) && Math.abs(v) <= SPLIT_MANUAL_MAX_TILT_DEG)) {
        throw invalid(`manualCuts[${i}].tiltDeg[${k}]`, v, -SPLIT_MANUAL_MAX_TILT_DEG, SPLIT_MANUAL_MAX_TILT_DEG);
      }
    });
    const tilted = isTiltedCut({ tiltDeg: tilt as [number, number] });
    const normal = cutNormal(cut.axis, tilted ? (tilt as [number, number]) : [0, 0]);
    const p = [...c0] as Vec3;
    p[a] = pos;
    return {
      ...(cut.id !== undefined ? { id: String(cut.id) } : {}),
      inputIndex: i, axis: cut.axis, positionMm: pos, tiltDeg: tilted ? [tilt[0], tilt[1]] : [0, 0], tilted, normal,
      offset: normal[0] * p[0] + normal[1] * p[1] + normal[2] * p[2],
    };
  });
  out.sort((p, q) => AXIS_INDEX[p.axis] - AXIS_INDEX[q.axis] || p.positionMm - q.positionMm);
  for (let i = 1; i < out.length; i++) {
    const lo = out[i - 1];
    const hi = out[i];
    if (lo.axis !== hi.axis) continue;
    if (gapRange(lo, hi, b).min <= 0) {
      throw new EngineError('SPLIT_MANUAL_CUTS_CROSS', { axis: lo.axis.toUpperCase(), a: Math.round(lo.positionMm * 10) / 10, b: Math.round(hi.positionMm * 10) / 10 });
    }
  }
  return out;
}

/** Rotación (matriz 3×3 por filas) que lleva el vector unitario `n` al eje `axis`. */
export function rotationToAxis(n: Vec3, axis: SplitAxis): number[][] {
  const e: Vec3 = [0, 0, 0];
  e[AXIS_INDEX[axis]] = 1;
  const k: Vec3 = [n[1] * e[2] - n[2] * e[1], n[2] * e[0] - n[0] * e[2], n[0] * e[1] - n[1] * e[0]];
  const s = Math.hypot(...k);
  const c = n[0] * e[0] + n[1] * e[1] + n[2] * e[2];
  if (s < 1e-12) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const [x, y, z] = k.map((v) => v / s);
  const t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

/** Traspuesta (= inversa de una rotación). */
export const transpose = (r: number[][]): number[][] => [0, 1, 2].map((i) => [0, 1, 2].map((j) => r[j][i]));

/** Matriz 4×4 (por columnas, como pide manifold-3d) de una rotación sin traslación. */
export function mat4Of(r: number[][]): Mat4 {
  return [r[0][0], r[1][0], r[2][0], 0, r[0][1], r[1][1], r[2][1], 0, r[0][2], r[1][2], r[2][2], 0, 0, 0, 0, 1];
}

export const applyRot = (r: number[][], p: readonly number[]): Vec3 =>
  [0, 1, 2].map((i) => r[i][0] * p[0] + r[i][1] * p[1] + r[i][2] * p[2]) as Vec3;
