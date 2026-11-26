/**
 * @file src/engine/orient/orientPlanar.ts
 * @description Geometría 2D de «Orientar para imprimir»: casco convexo (cadena monótona de Andrew),
 * área, margen del centro de masa dentro del polígono de apoyo y giro sobre la vertical para que la
 * huella quepa en la cama (calibres rotatorios sobre las aristas del casco).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Puntos 2D intercalados [x0, y0, x1, y1, …]. */
export type Points2 = ArrayLike<number>;

/** Casco convexo en sentido antihorario (sin puntos colineales), intercalado. */
export function convexHull2(points: Points2): Float64Array {
  const n = Math.floor(points.length / 2);
  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => points[a * 2] - points[b * 2] || points[a * 2 + 1] - points[b * 2 + 1]);
  const hull: number[] = [];
  const cross = (o: number, a: number, b: number) =>
    (points[a * 2] - points[o * 2]) * (points[b * 2 + 1] - points[o * 2 + 1]) -
    (points[a * 2 + 1] - points[o * 2 + 1]) * (points[b * 2] - points[o * 2]);
  const build = (seq: number[]) => {
    const out: number[] = [];
    for (const i of seq) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], i) <= 1e-12) out.pop();
      out.push(i);
    }
    out.pop();
    return out;
  };
  if (n < 3) return Float64Array.from(order.flatMap((i) => [points[i * 2], points[i * 2 + 1]]));
  const lower = build(order);
  const upper = build([...order].reverse());
  for (const i of [...lower, ...upper]) hull.push(points[i * 2], points[i * 2 + 1]);
  return Float64Array.from(hull);
}

/** Área de un polígono (fórmula del cordón, valor absoluto). */
export function polygonArea(poly: Points2): number {
  const n = poly.length / 2;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += poly[i * 2] * poly[j * 2 + 1] - poly[j * 2] * poly[i * 2 + 1];
  }
  return Math.abs(a) / 2;
}

/**
 * Distancia del punto al borde de un polígono convexo antihorario si está dentro; 0 si está fuera o
 * el polígono es degenerado (segmento o punto).
 */
export function insideMargin(poly: Points2, x: number, y: number): number {
  const n = poly.length / 2;
  if (n < 3) return 0;
  let margin = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = poly[j * 2] - poly[i * 2], ey = poly[j * 2 + 1] - poly[i * 2 + 1];
    const len = Math.hypot(ex, ey);
    if (len < 1e-12) continue;
    // Antihorario: el interior queda a la izquierda (producto cruz positivo).
    const d = (ex * (y - poly[i * 2 + 1]) - ey * (x - poly[i * 2])) / len;
    if (d <= 0) return 0;
    if (d < margin) margin = d;
  }
  return Number.isFinite(margin) ? margin : 0;
}

/** Extensión (ancho, fondo) del polígono girado `angle` radianes. */
export function extentAt(poly: Points2, angle: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < poly.length; i += 2) {
    const x = c * poly[i] - s * poly[i + 1], y = s * poly[i] + c * poly[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return [maxX - minX, maxY - minY];
}

/**
 * Giro (radianes) que hace caber la huella en `usable` = [ancho, fondo]: primero sin girar, luego
 * alineando cada arista del casco con un eje (el rectángulo mínimo tiene un lado sobre una arista)
 * y su giro de 90°. Devuelve `null` si ninguno cabe.
 */
export function yawToFit(poly: Points2, usable: [number, number]): number | null {
  const fits = (a: number) => {
    const [w, d] = extentAt(poly, a);
    return w <= usable[0] + 1e-6 && d <= usable[1] + 1e-6;
  };
  if (fits(0)) return 0;
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const base = -Math.atan2(poly[j * 2 + 1] - poly[i * 2 + 1], poly[j * 2] - poly[i * 2]);
    for (const a of [base, base + Math.PI / 2]) if (fits(a)) return a;
  }
  return null;
}
