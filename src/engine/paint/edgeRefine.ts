/**
 * @file src/engine/paint/edgeRefine.ts
 * @description Borde fino del pincel: subdivide por arista los triángulos que el círculo del pincel
 * corta, solo en la zona del trazo y con un tope de triángulos nuevos. Cada arista marcada se parte
 * en todos los triángulos que la comparten (adyacencia soldada), así la malla sigue cerrada y el
 * volumen no cambia (los puntos medios caen sobre las aristas originales).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import { getFaceAdjacency, type FaceAdjacency } from './faceAdjacency';
import { triangleCount } from './faceColors';
import { scaledTriangleDistanceSq } from './triangleDistance';
import { forEachTriangleNearBox, getTriangleGrid } from './triangleGrid';

/** Tope por defecto de triángulos nuevos por muestra del pincel. */
export const DEFAULT_MAX_NEW_TRIANGLES = 2000;
/** Las aristas del borde se parten hasta medir menos que esta fracción del radio. */
const TARGET_EDGE_RATIO = 0.35;
const MAX_PASSES = 8;

type V3 = readonly [number, number, number];
/** Filtro opcional de caras que pueden subdividirse. */
export type FaceFilter = (mesh: MeshData, t: number) => boolean;

/**
 * Subdivide los triángulos del borde del pincel (esfera de radio `r` en `c`, en espacio escalado por
 * `s`). Con `accept`, solo se parten los bordes de las caras que acepta (las visibles): las de atrás
 * no gastan el presupuesto. Devuelve la misma malla si no hay nada que partir.
 */
export function refineBrushEdge(
  mesh: MeshData,
  s: V3,
  c: V3,
  r: number,
  maxNewTriangles = DEFAULT_MAX_NEW_TRIANGLES,
  accept?: FaceFilter,
): MeshData {
  const target = r * TARGET_EDGE_RATIO;
  let current = mesh;
  let budget = maxNewTriangles;
  const lo: V3 = [(c[0] - r) / s[0], (c[1] - r) / s[1], (c[2] - r) / s[2]];
  const hi: V3 = [(c[0] + r) / s[0], (c[1] + r) / s[1], (c[2] + r) / s[2]];
  for (let pass = 0; pass < MAX_PASSES && budget >= 2; pass++) {
    const adj = getFaceAdjacency(current);
    const marked = markBorderEdges(current, adj, s, c, r, target, lo, hi, budget, accept);
    if (!marked) break;
    const next = splitMarkedEdges(current, adj, marked.edges);
    budget -= triangleCount(next) - triangleCount(current);
    current = next;
  }
  return current;
}

function markBorderEdges(
  mesh: MeshData, adj: FaceAdjacency, s: V3, c: V3, r: number, target: number, lo: V3, hi: V3, budget: number, accept?: FaceFilter,
) {
  const { positions: P, indices: I } = mesh;
  const rSq = r * r;
  const candidates = new Map<number, number>();
  const sideLength = (a: number, b: number) =>
    Math.hypot((P[a * 3] - P[b * 3]) * s[0], (P[a * 3 + 1] - P[b * 3 + 1]) * s[1], (P[a * 3 + 2] - P[b * 3 + 2]) * s[2]);
  const vertDistSq = (v: number) =>
    (P[v * 3] * s[0] - c[0]) ** 2 + (P[v * 3 + 1] * s[1] - c[1]) ** 2 + (P[v * 3 + 2] * s[2] - c[2]) ** 2;
  forEachTriangleNearBox(getTriangleGrid(mesh), lo, hi, (t) => {
    if (scaledTriangleDistanceSq(P, I, t, s, c) > rSq) return;
    // Dentro del todo: no es borde.
    if (vertDistSq(I[t * 3]) <= rSq && vertDistSq(I[t * 3 + 1]) <= rSq && vertDistSq(I[t * 3 + 2]) <= rSq) return;
    if (accept && !accept(mesh, t)) return;
    for (let k = 0; k < 3; k++) {
      const len = sideLength(I[t * 3 + k], I[t * 3 + ((k + 1) % 3)]);
      if (len > target) candidates.set(adj.sideEdge[t * 3 + k], len);
    }
  });
  if (candidates.size === 0) return null;
  // Las más largas primero, hasta agotar el presupuesto (cada arista suma un triángulo por lado).
  const ordered = [...candidates.entries()].sort((a, b) => b[1] - a[1]);
  const edges = new Uint8Array(adj.edgeStart.length - 1);
  let cost = 0;
  let any = false;
  for (const [e] of ordered) {
    const add = adj.edgeStart[e + 1] - adj.edgeStart[e];
    if (cost + add > budget) continue;
    cost += add;
    edges[e] = 1;
    any = true;
  }
  return any ? { edges } : null;
}

function splitMarkedEdges(mesh: MeshData, adj: FaceAdjacency, marked: Uint8Array): MeshData {
  const { positions: P, indices: I, normals: N, faceColors } = mesh;
  const vertCount = Math.floor(P.length / 3);
  const pos: number[] = [];
  const nor: number[] = [];
  const mids = new Map<number, number>();
  const mid = (a: number, b: number) => {
    const key = a < b ? a * vertCount + b : b * vertCount + a;
    let v = mids.get(key);
    if (v !== undefined) return v;
    v = vertCount + pos.length / 3;
    for (let k = 0; k < 3; k++) pos.push((P[a * 3 + k] + P[b * 3 + k]) / 2);
    if (N) {
      const nx = N[a * 3] + N[b * 3], ny = N[a * 3 + 1] + N[b * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2];
      const len = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / len, ny / len, nz / len);
    }
    mids.set(key, v);
    return v;
  };
  const tris: number[] = [];
  const colors: string[] | undefined = faceColors ? [] : undefined;
  const emit = (t: number, a: number, b: number, d: number) => {
    tris.push(a, b, d);
    if (colors) colors.push(faceColors![t]);
  };
  for (let t = 0; t < triangleCount(mesh); t++) {
    const m0 = marked[adj.sideEdge[t * 3]], m1 = marked[adj.sideEdge[t * 3 + 1]], m2 = marked[adj.sideEdge[t * 3 + 2]];
    const count = m0 + m1 + m2;
    const at = (k: number) => I[t * 3 + (k % 3)];
    if (count === 0) {
      emit(t, at(0), at(1), at(2));
    } else if (count === 1) {
      const k = m0 ? 0 : m1 ? 1 : 2;
      const v0 = at(k), v1 = at(k + 1), v2 = at(k + 2);
      const m = mid(v0, v1);
      emit(t, v0, m, v2);
      emit(t, m, v1, v2);
    } else if (count === 2) {
      const k = !m0 ? 0 : !m1 ? 1 : 2; // lado sin marcar (v2, v0)
      const v0 = at(k + 1), v1 = at(k + 2), v2 = at(k);
      const a = mid(v0, v1), b = mid(v1, v2);
      emit(t, a, v1, b);
      emit(t, v0, a, b);
      emit(t, v0, b, v2);
    } else {
      const v0 = at(0), v1 = at(1), v2 = at(2);
      const a = mid(v0, v1), b = mid(v1, v2), d = mid(v2, v0);
      emit(t, v0, a, d);
      emit(t, a, v1, b);
      emit(t, d, b, v2);
      emit(t, a, b, d);
    }
  }
  const positions = new Float32Array(P.length + pos.length);
  positions.set(P);
  positions.set(pos, P.length);
  const out: MeshData = { positions, indices: Uint32Array.from(tris) };
  if (N) {
    const normals = new Float32Array(N.length + nor.length);
    normals.set(N);
    normals.set(nor, N.length);
    out.normals = normals;
  }
  if (colors) out.faceColors = colors;
  return out;
}
