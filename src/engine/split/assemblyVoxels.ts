/**
 * @file src/engine/split/assemblyVoxels.ts
 * @description Ocupación en vóxeles de las piezas rearmadas para la validación de armado: pasa cada
 * malla a mundo (Euler XYZ + posición), la rellena por columnas en Y con paridad de cruces (centro de
 * cada vóxel), y de ahí salen la interferencia entre pares y la "sombra" de barrido: qué piezas
 * quedan en el camino de una pieza que entra moviéndose a lo largo de una dirección de eje. La sombra
 * es geometría fija (no depende del orden), así el orden de montaje solo cruza conjuntos.
 * Costo: O(triángulos · columnas que cubren) + O(vóxeles de borde · lado de la rejilla · 6).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import type { AssemblyDirection, AssemblyPartInput } from './assemblyTypes';

export const DIRECTIONS: AssemblyDirection[] = ['-y', '+x', '-x', '+z', '-z', '+y'];
const AXIS_OF: Record<string, number> = { x: 0, y: 1, z: 2 };
export const dirAxis = (d: AssemblyDirection) => AXIS_OF[d[1]];
export const dirSign = (d: AssemblyDirection) => (d[0] === '+' ? 1 : -1);

/** Vértices en mundo (Float64) de una malla local con su transformación de armado. */
export function worldPositions(mesh: MeshData, position: Vec3, rotation: Vec3): Float64Array {
  const [rx, ry, rz] = rotation;
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // Matriz de Euler 'XYZ' (Rx · Ry · Rz), la de three.js
  const m = [
    cy * cz, -cy * sz, sy,
    cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy,
    sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy,
  ];
  const p = mesh.positions;
  const out = new Float64Array(p.length);
  const rotated = rx !== 0 || ry !== 0 || rz !== 0;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    out[i] = (rotated ? m[0] * x + m[1] * y + m[2] * z : x) + position[0];
    out[i + 1] = (rotated ? m[3] * x + m[4] * y + m[5] * z : y) + position[1];
    out[i + 2] = (rotated ? m[6] * x + m[7] * y + m[8] * z : z) + position[2];
  }
  return out;
}

export interface VoxelGrid {
  h: number;
  origin: Vec3;
  n: [number, number, number];
  /** Dueño de cada vóxel: −1 vacío, −2 dos o más piezas, si no el índice de pieza. */
  owner: Int32Array;
  /** Vóxeles por pieza y vóxeles en dos o más piezas por par ("a|b"). */
  counts: number[];
  overlaps: Map<string, number>;
}

/** Rejilla común a todas las piezas, con vóxel de lado `h`. */
export function voxelize(world: Float64Array[], meshes: MeshData[], h: number): VoxelGrid {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const w of world) {
    for (let i = 0; i < w.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        if (w[i + a] < lo[a]) lo[a] = w[i + a];
        if (w[i + a] > hi[a]) hi[a] = w[i + a];
      }
    }
  }
  const n = [0, 1, 2].map((a) => Math.max(1, Math.ceil((hi[a] - lo[a]) / h))) as [number, number, number];
  const owner = new Int32Array(n[0] * n[1] * n[2]).fill(-1);
  const counts = world.map(() => 0);
  const overlaps = new Map<string, number>();
  const seen = new Map<number, number[]>();
  world.forEach((w, part) => {
    // Cruces de cada columna (x, z) con los triángulos, en Y
    const cols = new Map<number, Array<{ y: number; s: number }>>();
    const idx = meshes[part].indices;
    for (let t = 0; t < idx.length; t += 3) {
      const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
      const ax = w[A], az = w[A + 2], bx = w[B], bz = w[B + 2], cx = w[C], cz = w[C + 2];
      const d = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
      if (Math.abs(d) < 1e-12) continue;
      const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - lo[0]) / h - 0.5));
      const i1 = Math.min(n[0] - 1, Math.floor((Math.max(ax, bx, cx) - lo[0]) / h - 0.5));
      const k0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - lo[2]) / h - 0.5));
      const k1 = Math.min(n[2] - 1, Math.floor((Math.max(az, bz, cz) - lo[2]) / h - 0.5));
      for (let i = i0; i <= i1; i++) {
        const px = lo[0] + (i + 0.5) * h;
        for (let k = k0; k <= k1; k++) {
          const pz = lo[2] + (k + 0.5) * h;
          const u = ((px - ax) * (cz - az) - (cx - ax) * (pz - az)) / d;
          const v = ((bx - ax) * (pz - az) - (px - ax) * (bz - az)) / d;
          if (u < 0 || v < 0 || u + v > 1) continue;
          const y = w[A + 1] + u * (w[B + 1] - w[A + 1]) + v * (w[C + 1] - w[A + 1]);
          // Cruce con signo: normal hacia −Y (d > 0) entra, hacia +Y sale
          const key = i * n[2] + k;
          const hit = { y, s: d > 0 ? 1 : -1 };
          const list = cols.get(key);
          if (list) list.push(hit);
          else cols.set(key, [hit]);
        }
      }
    }
    for (const [key, raw] of cols) {
      raw.sort((p, q) => p.y - q.y || p.s - q.s);
      // Un centro sobre la arista compartida de dos triángulos cuenta dos veces: se quita el repetido
      const hits = raw.filter((x, t) => t === 0 || Math.abs(x.y - raw[t - 1].y) > 1e-7 || x.s !== raw[t - 1].s);
      const i = Math.floor(key / n[2]);
      const k = key % n[2];
      const spans: Array<[number, number]> = [];
      let wind = 0;
      let start = 0;
      for (const x of hits) {
        const before = wind;
        wind += x.s;
        if (before <= 0 && wind > 0) start = x.y;
        else if (before > 0 && wind <= 0) spans.push([start, x.y]);
      }
      for (const [y0, y1] of spans) {
        const j0 = Math.max(0, Math.ceil((y0 - lo[1]) / h - 0.5));
        const j1 = Math.min(n[1] - 1, Math.floor((y1 - lo[1]) / h - 0.5));
        for (let j = j0; j <= j1; j++) {
          const c = (i * n[1] + j) * n[2] + k;
          counts[part]++;
          const prev = owner[c];
          if (prev === -1) owner[c] = part;
          else if (prev !== part) {
            const others = seen.get(c) ?? (prev >= 0 ? [prev] : []);
            for (const o of others) {
              const pk = `${Math.min(o, part)}|${Math.max(o, part)}`;
              overlaps.set(pk, (overlaps.get(pk) ?? 0) + 1);
            }
            others.push(part);
            seen.set(c, others);
            owner[c] = -2;
          }
        }
      }
    }
  });
  return { h, origin: lo, n, owner, counts, overlaps };
}

/**
 * Sombra de barrido: para cada pieza y dirección, las piezas que ocupan algún vóxel por el que pasa
 * la pieza al entrar desde lejos moviéndose a lo largo de la dirección (camino en sentido contrario).
 */
export function sweepShadows(grid: VoxelGrid, parts: number): Array<Map<AssemblyDirection, Set<number>>> {
  const { n, owner } = grid;
  const out = Array.from({ length: parts }, () => new Map(DIRECTIONS.map((d) => [d, new Set<number>()])));
  const stride = [n[1] * n[2], n[2], 1];
  for (let i = 0; i < n[0]; i++) {
    for (let j = 0; j < n[1]; j++) {
      for (let k = 0; k < n[2]; k++) {
        const c = (i * n[1] + j) * n[2] + k;
        const p = owner[c];
        if (p < 0) continue;
        const ijk = [i, j, k];
        for (const d of DIRECTIONS) {
          const a = dirAxis(d);
          const back = -dirSign(d);
          // Solo desde el vóxel de borde en el sentido del camino
          const nb = ijk[a] + back;
          if (nb >= 0 && nb < n[a] && owner[c + back * stride[a]] === p) continue;
          const shadow = out[p].get(d)!;
          for (let s = nb, cc = c + back * stride[a]; s >= 0 && s < n[a]; s += back, cc += back * stride[a]) {
            const q = owner[cc];
            if (q >= 0 && q !== p) shadow.add(q);
          }
        }
      }
    }
  }
  return out;
}
