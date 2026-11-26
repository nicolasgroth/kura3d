/**
 * @file src/engine/cutConnectorPolygonIndex.ts
 * @description Índices espaciales de los contornos de una sección para ubicar conectores
 * (`cutConnectorLayout.ts`) sin recorrer todas las aristas por cada candidato: rejilla uniforme de
 * segmentos para la distancia al borde (búsqueda por anillos con poda por distancia) y bandas
 * horizontales para la regla par-impar. Dan el MISMO número que el recorrido completo: cada arista se
 * evalúa con la misma expresión y solo se omiten las que no pueden ganar (la poda usa una cota
 * conservadora) o no cruzan la horizontal del punto (paridad independiente del orden).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export type Vec2 = [number, number];

/** Segmentos de los polígonos en el orden del recorrido `j → i` (j = i − 1, cíclico). */
interface Segments {
  ax: Float64Array;
  ay: Float64Array;
  bx: Float64Array;
  by: Float64Array;
  n: number;
}

function segmentsOf(polys: Vec2[][]): Segments {
  let n = 0;
  for (const poly of polys) n += poly.length;
  const s: Segments = { ax: new Float64Array(n), ay: new Float64Array(n), bx: new Float64Array(n), by: new Float64Array(n), n };
  let k = 0;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++, k++) {
      s.ax[k] = poly[j][0];
      s.ay[k] = poly[j][1];
      s.bx[k] = poly[i][0];
      s.by[k] = poly[i][1];
    }
  }
  return s;
}

/** Índices CSR: `items[start[c] .. start[c+1])` son los segmentos de la celda `c`. */
function buildCsr(cells: number, n: number, range: (k: number, add: (c: number) => void) => void) {
  const start = new Uint32Array(cells + 1);
  for (let k = 0; k < n; k++) range(k, (c) => start[c + 1]++);
  for (let c = 0; c < cells; c++) start[c + 1] += start[c];
  const fill = start.slice(0, cells);
  const items = new Uint32Array(start[cells]);
  for (let k = 0; k < n; k++) range(k, (c) => (items[fill[c]++] = k));
  return { start, items };
}

/** Distancia exacta al borde de los polígonos (misma expresión por segmento que el recorrido completo). */
export class SegmentDistanceIndex {
  private readonly s: Segments;
  private readonly x0: number;
  private readonly y0: number;
  private readonly cs: number;
  private readonly nx: number;
  private readonly ny: number;
  private readonly start: Uint32Array;
  private readonly items: Uint32Array;
  /** Holgura de la cota de poda (mm): absorbe el redondeo al ubicar celdas. */
  private readonly eps: number;

  constructor(polys: Vec2[][]) {
    const s = (this.s = segmentsOf(polys));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < s.n; k++) {
      x0 = Math.min(x0, s.ax[k]); x1 = Math.max(x1, s.ax[k]);
      y0 = Math.min(y0, s.ay[k]); y1 = Math.max(y1, s.ay[k]);
    }
    if (s.n === 0) x0 = y0 = x1 = y1 = 0;
    const extent = Math.max(x1 - x0, y1 - y0, 1e-6);
    const side = Math.max(1, Math.min(1024, Math.ceil(Math.sqrt(s.n / 2))));
    this.cs = extent / side;
    this.x0 = x0;
    this.y0 = y0;
    this.nx = Math.max(1, Math.ceil((x1 - x0) / this.cs) + 1);
    this.ny = Math.max(1, Math.ceil((y1 - y0) / this.cs) + 1);
    this.eps = 1e-9 * (extent + Math.abs(x0) + Math.abs(y0) + 1);
    const csr = buildCsr(this.nx * this.ny, s.n, (k, add) => {
      const i0 = this.cellX(Math.min(s.ax[k], s.bx[k])), i1 = this.cellX(Math.max(s.ax[k], s.bx[k]));
      const j0 = this.cellY(Math.min(s.ay[k], s.by[k])), j1 = this.cellY(Math.max(s.ay[k], s.by[k]));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) add(j * this.nx + i);
    });
    this.start = csr.start;
    this.items = csr.items;
  }

  private cellX(x: number): number {
    return Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.x0) / this.cs)));
  }

  private cellY(y: number): number {
    return Math.min(this.ny - 1, Math.max(0, Math.floor((y - this.y0) / this.cs)));
  }

  private scanCell(c: number, px: number, py: number, best: number): number {
    const { ax, ay, bx, by } = this.s;
    for (let q = this.start[c], end = this.start[c + 1]; q < end; q++) {
      const k = this.items[q];
      const x = ax[k], y = ay[k];
      const dx = bx[k] - x;
      const dy = by[k] - y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - x) * dx + (py - y) * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(px - x - t * dx, py - y - t * dy));
    }
    return best;
  }

  /** Distancia de `p` al segmento más cercano (Infinity sin segmentos). */
  distance(p: Vec2): number {
    if (this.s.n === 0) return Infinity;
    const [px, py] = p;
    const ci = this.cellX(px), cj = this.cellY(py);
    let best = Infinity;
    for (let r = 0; ; r++) {
      const i0 = ci - r, i1 = ci + r, j0 = cj - r, j1 = cj + r;
      for (let j = Math.max(0, j0); j <= Math.min(this.ny - 1, j1); j++) {
        const edgeRow = j === j0 || j === j1;
        for (let i = Math.max(0, i0); i <= Math.min(this.nx - 1, i1); i++) {
          if (edgeRow || i === i0 || i === i1) best = this.scanCell(j * this.nx + i, px, py, best);
        }
      }
      // Cota de lo no visto: un segmento fuera del cuadrado de celdas recorrido está, como mínimo, a la
      // distancia de `p` al lado del cuadrado que no toca el borde de la rejilla (allí no queda nada).
      let bound = Infinity;
      if (i0 > 0) bound = Math.min(bound, px - (this.x0 + i0 * this.cs));
      if (i1 < this.nx - 1) bound = Math.min(bound, this.x0 + (i1 + 1) * this.cs - px);
      if (j0 > 0) bound = Math.min(bound, py - (this.y0 + j0 * this.cs));
      if (j1 < this.ny - 1) bound = Math.min(bound, this.y0 + (j1 + 1) * this.cs - py);
      if (bound === Infinity || best < bound - this.eps) return best;
    }
  }
}

/** Regla par-impar con bandas horizontales: solo se prueban las aristas que pueden cruzar la horizontal. */
export class EvenOddIndex {
  private readonly s: Segments;
  private readonly y0: number;
  private readonly h: number;
  private readonly bands: number;
  private readonly start: Uint32Array;
  private readonly items: Uint32Array;

  constructor(polys: Vec2[][]) {
    const s = (this.s = segmentsOf(polys));
    let y0 = Infinity, y1 = -Infinity;
    for (let k = 0; k < s.n; k++) {
      y0 = Math.min(y0, s.ay[k]);
      y1 = Math.max(y1, s.ay[k]);
    }
    if (s.n === 0) y0 = y1 = 0;
    this.bands = Math.max(1, Math.min(4096, Math.ceil(s.n / 4)));
    this.y0 = y0;
    this.h = Math.max(y1 - y0, 1e-6) / this.bands;
    const csr = buildCsr(this.bands, s.n, (k, add) => {
      if (s.ay[k] === s.by[k]) return; // horizontal: nunca cruza
      const b0 = this.band(Math.min(s.ay[k], s.by[k])), b1 = this.band(Math.max(s.ay[k], s.by[k]));
      for (let b = b0; b <= b1; b++) add(b);
    });
    this.start = csr.start;
    this.items = csr.items;
  }

  private band(y: number): number {
    return Math.min(this.bands - 1, Math.max(0, Math.floor((y - this.y0) / this.h)));
  }

  /** `p` dentro de los polígonos (mismo veredicto que el recorrido de todas las aristas). */
  contains(p: Vec2): boolean {
    const { ax, ay, bx, by } = this.s;
    const b = this.band(p[1]);
    let inside = false;
    for (let q = this.start[b], end = this.start[b + 1]; q < end; q++) {
      const k = this.items[q];
      // Arista i = b, j = a del recorrido original
      const xi = bx[k], yi = by[k], xj = ax[k], yj = ay[k];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
}
