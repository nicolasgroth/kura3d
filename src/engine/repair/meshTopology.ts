/**
 * @file src/engine/repair/meshTopology.ts
 * @description Topología de malla en arreglos tipados (sin claves string): soldadura por cuadrícula,
 * tabla de aristas con sus semi-aristas y la definición única de "malla cerrada" de Kura3D. Una malla
 * es cerrada si, uniendo los vértices con la misma posición (`CLOSURE_WELD_MM` = 1 nm, por debajo de la
 * resolución float32 del archivo: lo que ve un laminador), no tiene triángulos colapsados y cada arista
 * tiene exactamente dos semi-aristas opuestas. Lineal en memoria y tiempo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/**
 * Tolerancia de la definición única de malla cerrada: 1e-6 mm, en la práctica posición idéntica. Una
 * cuadrícula más gruesa (1e-4) colapsaría las micro-aristas válidas que deja Manifold y daría por
 * abiertas piezas que el laminador acepta.
 */
export const CLOSURE_WELD_MM = 1e-6;

/** Vértices soldados: `canon[v]` es el vértice único de `v`; `first[u]` un vértice original de `u`. */
export interface WeldMap {
  canon: Uint32Array;
  first: Uint32Array;
  unique: number;
}

/** Suelda por cuadrícula de lado `tol` mm (hash abierto, sin strings). */
export function weldGrid(positions: ArrayLike<number>, tol: number): WeldMap {
  const n = Math.floor(positions.length / 3);
  const inv = 1 / tol;
  let cap = 16;
  while (cap < n * 2) cap *= 2;
  const mask = cap - 1;
  const table = new Int32Array(cap);
  const q = new Float64Array(n * 3);
  const canon = new Uint32Array(n);
  const first = new Uint32Array(n);
  let unique = 0;
  for (let i = 0; i < n; i++) {
    const qx = Math.round(positions[i * 3] * inv);
    const qy = Math.round(positions[i * 3 + 1] * inv);
    const qz = Math.round(positions[i * 3 + 2] * inv);
    let h = Math.imul((qx | 0) ^ Math.floor(qx / 4294967296), 0x9e3779b1);
    h ^= Math.imul((qy | 0) ^ Math.floor(qy / 4294967296), 0x85ebca77);
    h ^= Math.imul((qz | 0) ^ Math.floor(qz / 4294967296), 0xc2b2ae3d);
    h ^= h >>> 15;
    let slot = h & mask;
    let found = -1;
    while (table[slot] !== 0) {
      const c = table[slot] - 1;
      if (q[c * 3] === qx && q[c * 3 + 1] === qy && q[c * 3 + 2] === qz) {
        found = c;
        break;
      }
      slot = (slot + 1) & mask;
    }
    if (found < 0) {
      found = unique++;
      table[slot] = found + 1;
      q[found * 3] = qx;
      q[found * 3 + 1] = qy;
      q[found * 3 + 2] = qz;
      first[found] = i;
    }
    canon[i] = found;
  }
  return { canon, first: first.slice(0, unique), unique };
}

/**
 * Tabla de aristas no dirigidas. La semi-arista `h = 3·t + c` va de `tris[h]` a `tris[3t + (c+1)%3]`.
 * `he0`/`he1` guardan las dos primeras semi-aristas de cada arista; las demás van en `extra`.
 */
export interface EdgeTable {
  numEdges: number;
  count: Uint32Array;
  he0: Int32Array;
  he1: Int32Array;
  extra: Map<number, number[]>;
  edgeOfHe: Int32Array;
  lo: Uint32Array;
  hi: Uint32Array;
}

/** Origen de una semi-arista. */
export const heFrom = (tris: ArrayLike<number>, h: number): number => tris[h];
/** Destino de una semi-arista. */
export const heTo = (tris: ArrayLike<number>, h: number): number => tris[h - (h % 3) + ((h % 3) + 1) % 3];

/** Construye la tabla de aristas de triángulos ya soldados (`tris` indexa vértices únicos). */
export function buildEdgeTable(tris: ArrayLike<number>, skip?: Uint8Array): EdgeTable {
  const nHe = tris.length;
  let cap = 16;
  while (cap < nHe * 2) cap *= 2;
  const mask = cap - 1;
  const table = new Int32Array(cap);
  const maxEdges = nHe;
  const lo = new Uint32Array(maxEdges);
  const hi = new Uint32Array(maxEdges);
  const count = new Uint32Array(maxEdges);
  const he0 = new Int32Array(maxEdges).fill(-1);
  const he1 = new Int32Array(maxEdges).fill(-1);
  const edgeOfHe = new Int32Array(nHe).fill(-1);
  const extra = new Map<number, number[]>();
  let numEdges = 0;
  for (let h = 0; h < nHe; h++) {
    if (skip && skip[(h / 3) | 0]) continue;
    const a = heFrom(tris, h);
    const b = heTo(tris, h);
    if (a === b) continue;
    const l = a < b ? a : b;
    const u = a < b ? b : a;
    let hash = Math.imul(l, 0x9e3779b1) ^ Math.imul(u, 0x85ebca77);
    hash ^= hash >>> 15;
    let slot = hash & mask;
    let e = -1;
    while (table[slot] !== 0) {
      const c = table[slot] - 1;
      if (lo[c] === l && hi[c] === u) {
        e = c;
        break;
      }
      slot = (slot + 1) & mask;
    }
    if (e < 0) {
      e = numEdges++;
      table[slot] = e + 1;
      lo[e] = l;
      hi[e] = u;
    }
    const k = count[e]++;
    if (k === 0) he0[e] = h;
    else if (k === 1) he1[e] = h;
    else {
      let list = extra.get(e);
      if (!list) extra.set(e, (list = []));
      list.push(h);
    }
    edgeOfHe[h] = e;
  }
  return { numEdges, count, he0, he1, extra, edgeOfHe, lo, hi };
}

/** Conteos topológicos de cierre. */
export interface ClosureCounts {
  /** Aristas con una sola cara (bordes de agujeros). */
  boundaryEdges: number;
  /** Aristas con más de dos caras. */
  nonManifoldEdges: number;
  /** Aristas con dos caras recorridas en el mismo sentido (normales incoherentes). */
  misorientedEdges: number;
  /** Triángulos con dos vértices soldados al mismo punto. */
  collapsedTriangles: number;
}

/** Conteos de cierre de `positions/indices` soldados a `weldMm`. */
export function closureCounts(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  weldMm = CLOSURE_WELD_MM,
): ClosureCounts {
  const { canon } = weldGrid(positions, weldMm);
  const tris = new Uint32Array(indices.length);
  let collapsedTriangles = 0;
  for (let i = 0; i < indices.length; i++) tris[i] = canon[indices[i]];
  for (let t = 0; t < tris.length; t += 3) {
    if (tris[t] === tris[t + 1] || tris[t + 1] === tris[t + 2] || tris[t] === tris[t + 2]) collapsedTriangles++;
  }
  const edges = buildEdgeTable(tris);
  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  let misorientedEdges = 0;
  for (let e = 0; e < edges.numEdges; e++) {
    const c = edges.count[e];
    if (c === 1) boundaryEdges++;
    else if (c > 2) nonManifoldEdges++;
    else if (heFrom(tris, edges.he0[e]) === heFrom(tris, edges.he1[e])) misorientedEdges++;
  }
  return { boundaryEdges, nonManifoldEdges, misorientedEdges, collapsedTriangles };
}

/** Definición única de malla cerrada (estadísticas, avisos, exportación y división). */
export function isMeshClosed(positions: ArrayLike<number>, indices: ArrayLike<number>, weldMm = CLOSURE_WELD_MM): boolean {
  if (indices.length < 12 || indices.length % 3 !== 0) return false;
  const c = closureCounts(positions, indices, weldMm);
  return c.boundaryEdges === 0 && c.nonManifoldEdges === 0 && c.misorientedEdges === 0 && c.collapsedTriangles === 0;
}
