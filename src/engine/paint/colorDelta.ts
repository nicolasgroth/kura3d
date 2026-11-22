/**
 * @file src/engine/paint/colorDelta.ts
 * @description Delta de colores por cara para el historial: solo las caras que cambiaron, con su color
 * anterior y nuevo como índices a una paleta (Uint32 + 2×Uint16 por cara en vez de una copia de
 * todos los colores). Ida y vuelta exacta: deshacer devuelve también "sin pintar" si antes no había
 * colores por cara. Funciones puras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import { hasFaceColors, triangleCount } from './faceColors';

export interface FaceColorDelta {
  /** Triángulos de la malla a la que aplica (control de coherencia). */
  triangleCount: number;
  /** Caras cambiadas, en orden ascendente. */
  faces: Uint32Array;
  /** Colores distintos que aparecen en `before`/`after`. */
  palette: string[];
  before: Uint16Array;
  after: Uint16Array;
  /** La malla tenía colores por cara antes / después del cambio. */
  beforePainted: boolean;
  afterPainted: boolean;
}

export type DeltaDirection = 'undo' | 'redo';

/** Arma un delta desde listas paralelas de caras (sin repetir) y colores anterior/nuevo. */
export function buildFaceColorDelta(
  triangles: number,
  faces: ArrayLike<number>,
  before: readonly string[],
  after: readonly string[],
  beforePainted: boolean,
  afterPainted: boolean,
): FaceColorDelta {
  const order = Array.from({ length: faces.length }, (_, i) => i).sort((a, b) => faces[a] - faces[b]);
  const palette: string[] = [];
  const lookup = new Map<string, number>();
  const id = (hex: string) => {
    let v = lookup.get(hex);
    if (v === undefined) {
      v = palette.length;
      if (v > 0xffff) throw new RangeError('too many face colors');
      palette.push(hex);
      lookup.set(hex, v);
    }
    return v;
  };
  const out = new Uint32Array(order.length);
  const b = new Uint16Array(order.length);
  const a = new Uint16Array(order.length);
  order.forEach((src, i) => {
    out[i] = faces[src];
    b[i] = id(before[src]);
    a[i] = id(after[src]);
  });
  return { triangleCount: triangles, faces: out, palette, before: b, after: a, beforePainted, afterPainted };
}

/**
 * Diferencia de colores entre dos versiones de la misma malla (misma cantidad de triángulos). Las
 * caras sin pintar valen `baseHex` en minúsculas. `null` si no cambia nada o la topología difiere.
 */
export function diffFaceColors(before: MeshData, after: MeshData, baseHex: string): FaceColorDelta | null {
  const n = triangleCount(before);
  if (triangleCount(after) !== n) return null;
  const base = baseHex.toLowerCase();
  const bp = hasFaceColors(before), ap = hasFaceColors(after);
  const B = bp ? before.faceColors! : null, A = ap ? after.faceColors! : null;
  const faces: number[] = [], bs: string[] = [], as: string[] = [];
  for (let t = 0; t < n; t++) {
    const x = B ? B[t] : base, y = A ? A[t] : base;
    if (x === y) continue;
    faces.push(t);
    bs.push(x);
    as.push(y);
  }
  if (faces.length === 0 && bp === ap) return null;
  return buildFaceColorDelta(n, faces, bs, as, bp, ap);
}

/** Aplica el delta hacia atrás (`undo`) o adelante (`redo`). Devuelve una malla nueva (no muta). */
export function applyFaceColorDelta(mesh: MeshData, delta: FaceColorDelta, direction: DeltaDirection, baseHex: string): MeshData {
  if (triangleCount(mesh) !== delta.triangleCount) throw new RangeError('face color delta does not match mesh');
  const painted = direction === 'undo' ? delta.beforePainted : delta.afterPainted;
  const values = direction === 'undo' ? delta.before : delta.after;
  if (!painted) {
    const { faceColors: _drop, ...rest } = mesh;
    return rest;
  }
  const colors = hasFaceColors(mesh) ? mesh.faceColors!.slice() : new Array<string>(delta.triangleCount).fill(baseHex.toLowerCase());
  for (let i = 0; i < delta.faces.length; i++) colors[delta.faces[i]] = delta.palette[values[i]];
  return { ...mesh, faceColors: colors };
}

/** Bytes retenidos por el delta (para el presupuesto de historial). */
export function faceColorDeltaBytes(delta: FaceColorDelta): number {
  return delta.faces.byteLength + delta.before.byteLength + delta.after.byteLength + delta.palette.length * 16 + 64;
}
