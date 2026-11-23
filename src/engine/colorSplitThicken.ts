/**
 * @file src/engine/colorSplitThicken.ts
 * @description Camino directo (sin booleanas) de "separar por colores": cada región de color no base se
 * engrosa hacia el interior construyendo la malla a mano. La pieza de color es su cara pintada (los
 * triángulos originales), la misma cara desplazada `depth` hacia adentro por vértice y paredes sobre las
 * aristas donde cambia el color; la pieza base es el resto de la superficie más esas mismas caras
 * interiores y paredes, con la orientación opuesta. Las piezas comparten vértices exactos: la partición
 * es exacta, cada arista tiene dos triángulos por construcción y no hay astillas de booleanas. Es lineal
 * en el número de triángulos (frente a unir miles de prismas solapados). Devuelve `null` cuando el caso
 * no es seguro (malla abierta, un color que toca un vértice desde dos sectores, cara interior que se
 * da vuelta); quien llama usa entonces el camino con booleanas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../types/kura';

/** Producto punto mínimo entre la normal de la cara interior y la de la exterior (evita pliegues). */
const MIN_INNER_ALIGNMENT = 0.2;
/** Tope de vueltas al recorrer el abanico de un vértice. */
const MAX_FAN = 4096;
/** Vueltas de relajación de la cara interior antes de usar el camino con booleanas. */
const MAX_UNFOLD_ITERATIONS = 40;
/** Fracción del área de la región que puede quedar con la cara interior invertida (astillas). */
const MAX_FOLDED_AREA_RATIO = 0.01;

/**
 * Piezas por color (malla cerrada, índices compactos) del cuerpo `bodyTris` de la malla soldada `P/I`.
 * `offsets` es el desplazamiento unitario por vértice (normal media escalada). Null si no aplica.
 */
export function thickenColorRegions(
  P: Float32Array,
  I: Uint32Array,
  bodyTris: number[],
  paint: string[],
  baseColor: string,
  offsets: Float64Array,
  depth: number,
): Map<string, MeshData> | null {
  const nv = P.length / 3;
  // Semi-arista dirigida a→b → triángulo. La malla del cuerpo debe ser cerrada y orientada.
  const he = new Map<number, number>();
  for (const t of bodyTris) {
    for (let c = 0; c < 3; c++) {
      const key = I[t * 3 + c] * nv + I[t * 3 + ((c + 1) % 3)];
      if (he.has(key)) return null;
      he.set(key, t);
    }
  }
  for (const t of bodyTris) {
    for (let c = 0; c < 3; c++) if (!he.has(I[t * 3 + ((c + 1) % 3)] * nv + I[t * 3 + c])) return null;
  }

  const regular = regularizeFans(P, I, he, nv, bodyTris, paint, baseColor);
  if (!regular) return null;
  const colors = regular;

  // Vértices tocados por regiones no base: tendrán copia interior.
  const inner = new Int32Array(nv).fill(-1);
  const touched: number[] = [];
  for (const t of bodyTris) {
    if (colors[t] === baseColor) continue;
    for (let c = 0; c < 3; c++) {
      const v = I[t * 3 + c];
      if (inner[v] >= 0) continue;
      inner[v] = nv + touched.length;
      touched.push(v);
    }
  }
  if (touched.length === 0) return null;

  const pos = new Float32Array((nv + touched.length) * 3);
  pos.set(P);
  touched.forEach((v, k) => {
    for (let a = 0; a < 3; a++) pos[(nv + k) * 3 + a] = P[v * 3 + a] - offsets[v * 3 + a] * depth;
  });
  // Si la relajación no alcanza (astillas pegadas a una arista viva, como el borde de una letra), se
  // sigue solo si lo invertido es una fracción mínima del área: `directPiecesValid` decide después.
  if (!unfoldInner(pos, I, bodyTris.filter((t) => colors[t] !== baseColor), inner) && !foldsNegligible(pos, P, I, bodyTris, colors, baseColor, inner)) return null;

  const faces = new Map<string, number[]>();
  const add = (color: string, a: number, b: number, c: number) => {
    let list = faces.get(color);
    if (!list) faces.set(color, (list = []));
    list.push(a, b, c);
  };
  for (const t of bodyTris) {
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    const color = colors[t];
    add(color, a, b, c);
    if (color === baseColor) continue;
    // Cara interior: hacia adentro para la pieza de color, hacia la pieza de color para la base.
    add(color, inner[c], inner[b], inner[a]);
    add(baseColor, inner[a], inner[b], inner[c]);
  }
  // Paredes sobre las aristas donde cambia el color: cada lado arma la suya con su orientación.
  for (const t of bodyTris) {
    for (let c = 0; c < 3; c++) {
      const a = I[t * 3 + c], b = I[t * 3 + ((c + 1) % 3)];
      const twin = he.get(b * nv + a)!;
      if (colors[twin] === colors[t]) continue;
      add(colors[t], b, a, inner[a]);
      add(colors[t], b, inner[a], inner[b]);
    }
  }

  const out = new Map<string, MeshData>();
  for (const [color, list] of faces) out.set(color, compact(pos, list));
  return out;
}

/** Abanico ordenado de `v` (triángulos alrededor del vértice); null si no cierra. */
function fanOf(I: Uint32Array, he: Map<number, number>, nv: number, v: number, start: number): number[] | null {
  const fan: number[] = [];
  let t = start;
  for (let step = 0; step < MAX_FAN; step++) {
    fan.push(t);
    const k = I[t * 3] === v ? 0 : I[t * 3 + 1] === v ? 1 : 2;
    const next = he.get(I[t * 3 + ((k + 1) % 3)] * nv + v);
    if (next === undefined) return null;
    t = next;
    if (t === start) return fan;
  }
  return null;
}

/** Sectores contiguos de un mismo color en el abanico (índices dentro de `fan`). */
function runsOf(fan: number[], colors: string[]): { color: string; tris: number[] }[] {
  const n = fan.length;
  let first = 0;
  while (first < n && colors[fan[first]] === colors[fan[(first + n - 1) % n]]) first++;
  if (first === n) return [{ color: colors[fan[0]], tris: [...fan] }];
  const runs: { color: string; tris: number[] }[] = [];
  for (let i = 0; i < n; i++) {
    const t = fan[(first + i) % n];
    const last = runs[runs.length - 1];
    if (last && last.color === colors[t]) last.tris.push(t);
    else runs.push({ color: colors[t], tris: [t] });
  }
  return runs;
}

/**
 * Regulariza el borde pintado en los vértices "en tablero" (un color que entra y sale del abanico más
 * de una vez, típico del borde dentado que deja el pincel refinado): el sector repetido de menor área
 * toma el color del sector anterior. Solo cambia triángulos que tocan ese vértice (de tamaño de la
 * subdivisión del pincel, bajo la resolución de impresión). Null si haría falta cambiar demasiados.
 */
function regularizeFans(P: Float32Array, I: Uint32Array, he: Map<number, number>, nv: number, bodyTris: number[], input: string[], baseColor: string): string[] | null {
  const colors = input.slice();
  const seed = new Int32Array(nv).fill(-1);
  for (const t of bodyTris) for (let c = 0; c < 3; c++) seed[I[t * 3 + c]] = t;
  const work: number[] = [];
  const queued = new Uint8Array(nv);
  for (const t of bodyTris) {
    if (colors[t] === baseColor) continue;
    for (let c = 0; c < 3; c++) {
      const v = I[t * 3 + c];
      if (!queued[v]) { queued[v] = 1; work.push(v); }
    }
  }
  let budget = Math.max(16, Math.ceil(bodyTris.length * 0.02));
  while (work.length > 0) {
    const v = work.pop()!;
    queued[v] = 0;
    const fan = fanOf(I, he, nv, v, seed[v]);
    if (!fan) return null;
    for (;;) {
      const runs = runsOf(fan, colors);
      const count = new Map<string, number>();
      for (const r of runs) count.set(r.color, (count.get(r.color) ?? 0) + 1);
      let worst = -1, worstArea = Infinity;
      runs.forEach((r, i) => {
        if (count.get(r.color)! < 2) return;
        const area = r.tris.reduce((s, t) => s + triArea(P, I, t), 0);
        if (area < worstArea) { worstArea = area; worst = i; }
      });
      if (worst < 0) break;
      const to = runs[(worst + runs.length - 1) % runs.length].color;
      for (const t of runs[worst].tris) {
        if (--budget < 0) return null;
        colors[t] = to;
        for (let c = 0; c < 3; c++) {
          const w = I[t * 3 + c];
          if (w !== v && !queued[w]) { queued[w] = 1; work.push(w); }
        }
      }
    }
  }
  return colors;
}

function triArea(P: Float32Array, I: Uint32Array, t: number): number {
  const n = [0, 1, 2].map((k) => I[t * 3 + k] * 3);
  const ux = P[n[1]] - P[n[0]], uy = P[n[1] + 1] - P[n[0] + 1], uz = P[n[1] + 2] - P[n[0] + 2];
  const vx = P[n[2]] - P[n[0]], vy = P[n[2] + 1] - P[n[0] + 1], vz = P[n[2] + 2] - P[n[0] + 2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

/**
 * Las astillas del pincel refinado (triángulos de centésimas de mm de ancho entre un vértice interior a
 * una faceta y los de su arista) se dan vuelta al desplazar cada vértice por su propia normal. Se
 * relajan solo esos vértices interiores hacia el promedio de sus vecinos interiores (centésimas de mm,
 * la capa conserva su profundidad) hasta que ninguna cara interior quede invertida.
 */
function unfoldInner(pos: Float32Array, I: Uint32Array, region: number[], inner: Int32Array): boolean {
  const neighbors = new Map<number, Set<number>>();
  for (const t of region) {
    for (let c = 0; c < 3; c++) {
      const a = inner[I[t * 3 + c]], b = inner[I[t * 3 + ((c + 1) % 3)]];
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      if (!neighbors.has(b)) neighbors.set(b, new Set());
      neighbors.get(a)!.add(b);
      neighbors.get(b)!.add(a);
    }
  }
  for (let iter = 0; iter < MAX_UNFOLD_ITERATIONS; iter++) {
    const moving = new Set<number>();
    for (const t of region) {
      const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
      if (!innerAligned(pos, a, b, c, inner[a], inner[b], inner[c])) for (const v of [a, b, c]) moving.add(inner[v]);
    }
    if (moving.size === 0) return true;
    for (const v of moving) {
      const ring = neighbors.get(v)!;
      const avg = [0, 0, 0];
      for (const w of ring) for (let k = 0; k < 3; k++) avg[k] += pos[w * 3 + k] / ring.size;
      for (let k = 0; k < 3; k++) pos[v * 3 + k] = 0.5 * pos[v * 3 + k] + 0.5 * avg[k];
    }
  }
  return false;
}

/** Área de caras interiores invertidas bajo `MAX_FOLDED_AREA_RATIO` del área de la región. */
function foldsNegligible(pos: Float32Array, P: Float32Array, I: Uint32Array, bodyTris: number[], colors: string[], baseColor: string, inner: Int32Array): boolean {
  let folded = 0, total = 0;
  for (const t of bodyTris) {
    if (colors[t] === baseColor) continue;
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    const area = triArea(P, I, t);
    total += area;
    if (!innerAligned(pos, a, b, c, inner[a], inner[b], inner[c])) folded += area;
  }
  return total > 0 && folded <= total * MAX_FOLDED_AREA_RATIO;
}

function innerAligned(pos: Float32Array, a: number, b: number, c: number, ai: number, bi: number, ci: number): boolean {
  const n0 = normal(pos, a, b, c), n1 = normal(pos, ai, bi, ci);
  if (!n0 || !n1) return false;
  return n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] >= MIN_INNER_ALIGNMENT;
}

function normal(p: Float32Array, a: number, b: number, c: number): number[] | null {
  const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
  const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  const l = Math.hypot(n[0], n[1], n[2]);
  return l < 1e-14 ? null : [n[0] / l, n[1] / l, n[2] / l];
}

/** Malla con solo los vértices usados por `list`. */
function compact(pos: Float32Array, list: number[]): MeshData {
  const remap = new Map<number, number>();
  const positions: number[] = [];
  const indices = new Uint32Array(list.length);
  for (let i = 0; i < list.length; i++) {
    let n = remap.get(list[i]);
    if (n === undefined) {
      n = positions.length / 3;
      remap.set(list[i], n);
      positions.push(pos[list[i] * 3], pos[list[i] * 3 + 1], pos[list[i] * 3 + 2]);
    }
    indices[i] = n;
  }
  return { positions: new Float32Array(positions), indices };
}
