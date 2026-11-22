/**
 * @file src/engine/colorSplitPinch.ts
 * @description Vértices "en tablero" de la separación por colores: donde una región de color toca un
 * vértice desde dos o más sectores separados (color, otro, color, otro… alrededor del vértice), la capa
 * de prismas y el resto se tocan solo a lo largo de la arista que baja desde ese vértice. Manifold lo
 * acepta, pero al soldar el STL esa arista queda compartida por 4 triángulos. Aquí se detectan esos
 * vértices y se agrega a la capa una columna delgada (envolvente convexa) a lo largo de esa arista,
 * así la región se une con volumen real y el resto ya no se pellizca.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel, Vec3 as MVec3 } from 'manifold-3d';

/** Radio de la columna (mm): bien sobre las tolerancias de soldadura y muy bajo la resolución de impresión. */
export const PINCH_PLUG_RADIUS_MM = 0.03;
const PLUG_SIDES = 6;

/**
 * Vértices de la región `regionTris` (subconjunto de los triángulos `bodyTris`) cuyo abanico entra y
 * sale de la región más de una vez: más de dos aristas de borde de región inciden en el vértice.
 */
export function checkerboardVertices(I: Uint32Array, bodyTris: number[], regionTris: number[]): number[] {
  const inRegion = new Set(regionTris);
  // Por arista (v<w): cuántos triángulos de la región y cuántos fuera la usan.
  const edgeIn = new Map<string, number>();
  const edgeOut = new Map<string, number>();
  for (const t of bodyTris) {
    const target = inRegion.has(t) ? edgeIn : edgeOut;
    for (let c = 0; c < 3; c++) {
      const a = I[t * 3 + c], b = I[t * 3 + ((c + 1) % 3)];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      target.set(k, (target.get(k) ?? 0) + 1);
    }
  }
  const boundaryCount = new Map<number, number>();
  for (const [k, n] of edgeIn) {
    if (n !== 1 || !edgeOut.has(k)) continue;
    for (const v of k.split(',').map(Number)) boundaryCount.set(v, (boundaryCount.get(v) ?? 0) + 1);
  }
  const out: number[] = [];
  for (const [v, n] of boundaryCount) if (n > 2) out.push(v);
  return out;
}

/**
 * Columna convexa delgada de `top` a `bottom` (dos hexágonos de radio `PINCH_PLUG_RADIUS_MM`
 * perpendiculares al eje). Null si el eje es degenerado.
 */
export function pinchPlug(wasm: ManifoldToplevel, top: number[], bottom: number[]): Manifold | null {
  const axis = [bottom[0] - top[0], bottom[1] - top[1], bottom[2] - top[2]];
  const len = Math.hypot(axis[0], axis[1], axis[2]);
  if (len < 1e-6) return null;
  const n = axis.map((x) => x / len);
  const helper = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = cross(n, helper);
  const ul = Math.hypot(u[0], u[1], u[2]);
  const uu = u.map((x) => x / ul);
  const vv = cross(n, uu);
  const points: MVec3[] = [];
  for (const center of [top, bottom]) {
    for (let k = 0; k < PLUG_SIDES; k++) {
      const ang = (2 * Math.PI * k) / PLUG_SIDES;
      const c = Math.cos(ang) * PINCH_PLUG_RADIUS_MM, s = Math.sin(ang) * PINCH_PLUG_RADIUS_MM;
      points.push([center[0] + uu[0] * c + vv[0] * s, center[1] + uu[1] * c + vv[1] * s, center[2] + uu[2] * c + vv[2] * s]);
    }
  }
  const plug = wasm.Manifold.hull(points);
  if (plug.isEmpty()) { plug.delete(); return null; }
  return plug;
}

function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
