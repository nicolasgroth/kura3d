/**
 * @file src/utils/paintContrast.ts
 * @description Color de pincel que se distingue del objeto: si el pincel es igual (o casi) al color del objeto,
 * el primer trazo no se vería; se elige el siguiente color de la paleta que contraste.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Distancia RGB por debajo de la cual dos colores se ven iguales sobre la pieza. */
export const PAINT_SAME_COLOR_DISTANCE = 60;

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Distancia euclídea en RGB (0–441); Infinity si algún color no es `#rrggbb`. */
export function colorDistance(a: string, b: string): number {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return Infinity;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/**
 * Pincel que contrasta con `baseColor`: el mismo `paintColor` si ya se distingue; si no, el siguiente color de
 * `palette` (a partir del actual, en orden circular) que se distinga del objeto.
 */
export function contrastingPaintColor(paintColor: string, baseColor: string, palette: readonly string[]): string {
  if (colorDistance(paintColor, baseColor) >= PAINT_SAME_COLOR_DISTANCE || palette.length === 0) return paintColor;
  const start = Math.max(0, palette.findIndex((c) => c.toLowerCase() === paintColor.toLowerCase()));
  for (let i = 1; i <= palette.length; i++) {
    const candidate = palette[(start + i) % palette.length];
    if (colorDistance(candidate, baseColor) >= PAINT_SAME_COLOR_DISTANCE) return candidate;
  }
  return paintColor;
}
