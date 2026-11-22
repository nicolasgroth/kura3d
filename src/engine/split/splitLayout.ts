/**
 * @file src/engine/split/splitLayout.ts
 * @description Disposición de impresión y vista explosionada de las piezas de "dividir para imprimir".
 * `layoutSplitParts` apoya cada pieza sobre su cara plana de mayor área (de las seis direcciones de
 * los ejes; típicamente una cara de corte), la acomoda en filas sobre la cama (centrada en el origen,
 * X ancho, Z fondo) y abre placas virtuales cuando no caben. `explodedTransforms` interpola entre el
 * armado (0) y las piezas separadas radialmente desde el centro del conjunto (1).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { applyTransformToMesh } from '../primitives';
import type { SplitBed, SplitFace, SplitPart, SplitPrintPlacement, SplitTransform } from './splitTypes';

const H = Math.PI / 2;
/** Dirección de la cara que va abajo → rotación (Euler XYZ) que la lleva a −Y. */
const DOWN_ROTATIONS: Array<{ face: SplitFace; dir: Vec3; rot: Vec3 }> = [
  { face: '-y', dir: [0, -1, 0], rot: [0, 0, 0] },
  { face: '+y', dir: [0, 1, 0], rot: [Math.PI, 0, 0] },
  { face: '+x', dir: [1, 0, 0], rot: [0, 0, -H] },
  { face: '-x', dir: [-1, 0, 0], rot: [0, 0, H] },
  { face: '+z', dir: [0, 0, 1], rot: [H, 0, 0] },
  { face: '-z', dir: [0, 0, -1], rot: [-H, 0, 0] },
];

/** Área (mm²) de triángulos planos en el extremo de la malla en la dirección `dir`. */
export function supportArea(mesh: MeshData, dir: Vec3, tol = 0.05): number {
  const p = mesh.positions;
  let extreme = -Infinity;
  for (let i = 0; i < p.length; i += 3) extreme = Math.max(extreme, p[i] * dir[0] + p[i + 1] * dir[1] + p[i + 2] * dir[2]);
  let area = 0;
  const idx = mesh.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const on = (v: number) => p[v] * dir[0] + p[v + 1] * dir[1] + p[v + 2] * dir[2] >= extreme - tol;
    if (!on(a) || !on(b) || !on(c)) continue;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0 || (nx * dir[0] + ny * dir[1] + nz * dir[2]) / len < 0.99) continue;
    area += len / 2;
  }
  return area;
}

function rotatedBounds(mesh: MeshData, rot: Vec3): { min: Vec3; max: Vec3 } {
  const m = applyTransformToMesh(mesh, [0, 0, 0], rot, [1, 1, 1]).positions;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], m[i + a]);
      max[a] = Math.max(max[a], m[i + a]);
    }
  }
  return { min, max };
}

export interface SplitLayoutOptions {
  /** Separación entre piezas (mm, por defecto 5). */
  gapMm?: number;
  /** Margen al borde de la cama (mm, por defecto 5). */
  marginMm?: number;
  /** Alto ÷ lado menor de la huella sobre el que una pieza de pie se considera inestable (por defecto 3). */
  maxSlenderness?: number;
}

/** Más esbelta que esto (alto ÷ lado menor de la huella), una pieza de pie se acuesta si cabe. */
export const MAX_STABLE_SLENDERNESS = 3;

export interface SplitLayoutResult {
  /** Ubicación por pieza (posición relativa a su placa, cama centrada en el origen). */
  placements: SplitPrintPlacement[];
  plateCount: number;
  /** Piezas que no caben en la cama ni acostadas (se dejan en su propia placa). */
  oversized: number[];
}

/**
 * Empaquetado en filas sobre la cama (las huellas más hondas primero) con placas nuevas cuando no caben.
 * Lo usan `layoutSplitParts` (medidas reales) y `estimateSplitPlates` (medidas del plan), así coinciden.
 */
export function packOnPlates(
  items: Array<{ id: number; size: Vec3 }>, W: number, D: number, gap: number,
): Array<{ id: number; plate: number; x: number; z: number; w: number; d: number }> {
  const order = [...items].sort((p, q) => q.size[2] - p.size[2] || q.size[0] - p.size[0]);
  const out: Array<{ id: number; plate: number; x: number; z: number; w: number; d: number }> = [];
  let plate = 0;
  let x = 0;
  let z = 0;
  let rowDepth = 0;
  let used = false;
  for (const it of order) {
    const [w, , d] = it.size;
    if (used && x + w > W) {
      x = 0;
      z += rowDepth + gap;
      rowDepth = 0;
    }
    if (used && z + d > D) {
      plate++;
      x = 0;
      z = 0;
      rowDepth = 0;
    }
    out.push({ id: it.id, plate, x, z, w, d });
    x += w + gap;
    rowDepth = Math.max(rowDepth, d);
    used = true;
  }
  return out;
}

/**
 * Placas de impresión a partir de las medidas de las piezas (sin malla), con el mismo empaquetado que
 * `layoutSplitParts` (`packOnPlates`). La cara de abajo real depende de la malla (cara plana mayor), que aquí
 * no se conoce: se toma la orientación de menor huella que quepa, así la cifra no sobrestima las placas.
 */
export function estimateSplitPlates(sizes: ReadonlyArray<Vec3>, bed: SplitBed, options: SplitLayoutOptions = {}): number {
  if (sizes.length === 0) return 0;
  const gap = options.gapMm ?? 5;
  const margin = options.marginMm ?? 5;
  const W = bed.widthMm - 2 * margin;
  const D = bed.depthMm - 2 * margin;
  const items = sizes.map((s, id) => {
    const cands = ([[s[1], s[0], s[2]], [s[0], s[1], s[2]], [s[0], s[2], s[1]]] as Vec3[])
      .map((size) => ({ size, area: size[0] * size[2] }))
      .sort((p, q) => p.area - q.area);
    const fitting = cands.filter((c) => c.size[1] <= bed.heightMm && c.size[0] <= W && c.size[2] <= D);
    return { id, size: (fitting[0] ?? cands[cands.length - 1]).size };
  });
  return Math.max(...packOnPlates(items, W, D, gap).map((p) => p.plate)) + 1;
}

/**
 * Orienta y acomoda las piezas para imprimir: cara plana más grande abajo, filas sobre la cama y
 * tantas placas virtuales como hagan falta (índice de placa por pieza).
 */
export function layoutSplitParts(parts: Array<Pick<SplitPart, 'mesh'>>, bed: SplitBed, options: SplitLayoutOptions = {}): SplitLayoutResult {
  const gap = options.gapMm ?? 5;
  const margin = options.marginMm ?? 5;
  const W = bed.widthMm - 2 * margin;
  const D = bed.depthMm - 2 * margin;
  const oversized: number[] = [];
  const maxSlender = options.maxSlenderness ?? MAX_STABLE_SLENDERNESS;
  const oriented = parts.map((part, i) => {
    const ranked = DOWN_ROTATIONS.map((o) => ({ ...o, area: supportArea(part.mesh, o.dir) }))
      .sort((p, q) => q.area - p.area);
    const fitting = ranked
      .map((o) => {
        const b = rotatedBounds(part.mesh, o.rot);
        const size: Vec3 = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
        return { i, o, b, size, slender: size[1] / Math.max(1e-6, Math.min(size[0], size[2])) };
      })
      .filter((c) => c.size[1] <= bed.heightMm && c.size[0] <= W && c.size[2] <= D);
    // La cara plana más grande abajo, salvo que deje la pieza esbelta (alta y angosta, p. ej. un
    // tramo de tubo de 28 × 206 mm): entonces se prefiere la orientación estable más baja que quepa.
    const stable = fitting.filter((c) => c.slender <= maxSlender);
    if (stable.length > 0) return stable[0];
    if (fitting.length > 0) return [...fitting].sort((p, q) => p.size[1] - q.size[1] || q.o.area - p.o.area)[0];
    oversized.push(i);
    const o = ranked[0];
    const b = rotatedBounds(part.mesh, o.rot);
    return { i, o, b, size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] as Vec3 };
  });
  const packed = packOnPlates(oriented.map((o) => ({ id: o.i, size: o.size })), W, D, gap);
  const placements: SplitPrintPlacement[] = new Array(parts.length);
  const byId = new Map(oriented.map((o) => [o.i, o]));
  let plate = 0;
  for (const pk of packed) {
    const it = byId.get(pk.id)!;
    plate = Math.max(plate, pk.plate);
    const cx = -W / 2 + pk.x + pk.w / 2;
    const cz = -D / 2 + pk.z + pk.d / 2;
    placements[pk.id] = {
      plate: pk.plate,
      downFace: it.o.face,
      rotation: it.o.rot,
      position: [cx - (it.b.min[0] + it.b.max[0]) / 2, -it.b.min[1], cz - (it.b.min[2] + it.b.max[2]) / 2],
    };
  }
  return { placements, plateCount: parts.length > 0 ? plate + 1 : 0, oversized };
}

/**
 * Transformación de cada pieza para el factor `factor` ∈ [0, 1]: 0 = armado exacto, 1 = separadas
 * radialmente desde el centro del conjunto (cada pieza se aleja `spread` veces su distancia al centro).
 */
export function explodedTransforms(parts: Array<Pick<SplitPart, 'assembly' | 'bounds'>>, factor: number, spread = 0.6): SplitTransform[] {
  const f = Math.min(1, Math.max(0, Number.isFinite(factor) ? factor : 0));
  if (parts.length === 0) return [];
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], p.bounds.min[a]);
      max[a] = Math.max(max[a], p.bounds.max[a]);
    }
  }
  const center = [0, 1, 2].map((a) => (min[a] + max[a]) / 2);
  return parts.map((p) => {
    const c = [0, 1, 2].map((a) => (p.bounds.min[a] + p.bounds.max[a]) / 2);
    const position = p.assembly.position.map((v, a) => v + (c[a] - center[a]) * spread * f) as Vec3;
    return { position, rotation: [...p.assembly.rotation] as Vec3 };
  });
}
