/**
 * @file src/core/recipes/thumbnail.ts
 * @description Miniatura vectorial de una receta: proyección isométrica de la malla que produce (sin WebGL) a capas de
 * polígonos SVG por nivel de sombra. Función pura y determinista: caras traseras descartadas, resto ordenado de lejos a
 * cerca (algoritmo del pintor) y agrupado por sombra, así que el SVG es liviano aunque la malla tenga miles de
 * triángulos. Decisión: se prefiere a un render WebGL por tarjeta (una instancia GL por miniatura es cara y frágil)
 * porque es testeable en Node, cacheable y legible para tecnologías de apoyo (el SVG va oculto; la tarjeta ya tiene
 * nombre).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Una pieza a dibujar: malla local (mm, Y arriba) y su desplazamiento. */
export interface ThumbPart {
  readonly positions: ArrayLike<number>;
  readonly indices: ArrayLike<number>;
  readonly offset?: readonly [number, number, number];
}

export interface ThumbLayer {
  /** 0 = más oscuro … `SHADES - 1` = más claro. */
  readonly shade: number;
  /** Datos de un `<path>`: subpolígonos `M…L…Z`. */
  readonly d: string;
}

export interface Thumbnail {
  readonly width: number;
  readonly height: number;
  /** Capas en el orden de dibujo (de atrás hacia adelante). */
  readonly layers: readonly ThumbLayer[];
}

export const THUMB_SHADES = 4;
export const THUMB_WIDTH = 120;
export const THUMB_HEIGHT = 90;
const PAD = 8;
/** Por encima de esto se omiten los triángulos de área proyectada mínima (siempre los mismos: determinista). */
const MAX_TRIANGLES = 3000;
const MIN_AREA = 0.25;

// Cámara isométrica: mira desde (1, 1, 1) con Y arriba.
const V = [1, 1, 1].map((n) => n / Math.sqrt(3)) as [number, number, number];
const RIGHT = [1 / Math.SQRT2, 0, -1 / Math.SQRT2] as const;
const UP = [-1 / Math.sqrt(6), 2 / Math.sqrt(6), -1 / Math.sqrt(6)] as const;
const LIGHT = [0.35, 0.85, 0.4].map((n, _i, a) => n / Math.hypot(a[0]!, a[1]!, a[2]!)) as [number, number, number];

const r1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** Proyecta las piezas y devuelve las capas de la miniatura, o `null` si no hay geometría que dibujar. */
export function buildThumbnail(parts: readonly ThumbPart[]): Thumbnail | null {
  interface Tri {
    x: [number, number, number];
    y: [number, number, number];
    depth: number;
    shade: number;
    area: number;
  }
  const tris: Tri[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const part of parts) {
    const { positions, indices } = part;
    const [ox, oy, oz] = part.offset ?? [0, 0, 0];
    const count = Math.floor(indices.length / 3);
    for (let t = 0; t < count; t++) {
      const i0 = indices[t * 3]! * 3;
      const i1 = indices[t * 3 + 1]! * 3;
      const i2 = indices[t * 3 + 2]! * 3;
      const ax = positions[i0]! + ox, ay = positions[i0 + 1]! + oy, az = positions[i0 + 2]! + oz;
      const bx = positions[i1]! + ox, by = positions[i1 + 1]! + oy, bz = positions[i1 + 2]! + oz;
      const cx = positions[i2]! + ox, cy = positions[i2 + 1]! + oy, cz = positions[i2 + 2]! + oz;
      if (![ax, ay, az, bx, by, bz, cx, cy, cz].every(Number.isFinite)) continue;
      // Normal por producto vectorial (no se confía en las normales de la malla).
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const wx = cx - ax, wy = cy - ay, wz = cz - az;
      let nx = uy * wz - uz * wy;
      let ny = uz * wx - ux * wz;
      let nz = ux * wy - uy * wx;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-12) continue;
      nx /= len; ny /= len; nz /= len;
      if (nx * V[0] + ny * V[1] + nz * V[2] <= 0) continue; // cara trasera
      const proj = (x: number, y: number, z: number): [number, number] => [
        x * RIGHT[0] + y * RIGHT[1] + z * RIGHT[2],
        -(x * UP[0] + y * UP[1] + z * UP[2]),
      ];
      const [pax, pay] = proj(ax, ay, az);
      const [pbx, pby] = proj(bx, by, bz);
      const [pcx, pcy] = proj(cx, cy, cz);
      const lambert = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const shade = Math.min(THUMB_SHADES - 1, Math.floor(lambert * THUMB_SHADES));
      const depth = ((ax + bx + cx) * V[0] + (ay + by + cy) * V[1] + (az + bz + cz) * V[2]) / 3;
      const area = Math.abs((pbx - pax) * (pcy - pay) - (pcx - pax) * (pby - pay)) / 2;
      tris.push({ x: [pax, pbx, pcx], y: [pay, pby, pcy], depth, shade, area });
      minX = Math.min(minX, pax, pbx, pcx);
      maxX = Math.max(maxX, pax, pbx, pcx);
      minY = Math.min(minY, pay, pby, pcy);
      maxY = Math.max(maxY, pay, pby, pcy);
    }
  }
  if (tris.length === 0) return null;

  const w = maxX - minX;
  const h = maxY - minY;
  if (!(w > 0) && !(h > 0)) return null;
  const scale = Math.min((THUMB_WIDTH - 2 * PAD) / Math.max(w, 1e-9), (THUMB_HEIGHT - 2 * PAD) / Math.max(h, 1e-9));
  const tx = (THUMB_WIDTH - w * scale) / 2 - minX * scale;
  const ty = (THUMB_HEIGHT - h * scale) / 2 - minY * scale;

  let kept = tris;
  if (kept.length > MAX_TRIANGLES) {
    const threshold = MIN_AREA / (scale * scale);
    kept = tris.filter((tri) => tri.area >= threshold);
    if (kept.length === 0) kept = tris.slice(0, MAX_TRIANGLES);
  }
  // Lejos a cerca; el índice original desempata para que el orden sea el mismo en cada ejecución.
  const order = kept.map((tri, i) => ({ tri, i })).sort((a, b) => a.tri.depth - b.tri.depth || a.i - b.i);

  const layers: { shade: number; parts: string[] }[] = [];
  for (const { tri } of order) {
    const poly = `M${r1(tri.x[0] * scale + tx)} ${r1(tri.y[0] * scale + ty)}L${r1(tri.x[1] * scale + tx)} ${r1(tri.y[1] * scale + ty)}L${r1(tri.x[2] * scale + tx)} ${r1(tri.y[2] * scale + ty)}Z`;
    const last = layers[layers.length - 1];
    if (last && last.shade === tri.shade) last.parts.push(poly);
    else layers.push({ shade: tri.shade, parts: [poly] });
  }
  return { width: THUMB_WIDTH, height: THUMB_HEIGHT, layers: layers.map((l) => ({ shade: l.shade, d: l.parts.join('') })) };
}
