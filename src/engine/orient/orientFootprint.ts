/**
 * @file src/engine/orient/orientFootprint.ts
 * @description Giro alrededor de la vertical que deja la huella de la pieza con la caja envolvente de menor área
 * sobre la cama: casco convexo 2D (cadena monótona de Andrew) de los vértices proyectados en X/Z y barrido de sus
 * aristas con calibradores rotatorios (teorema de Freeman–Shapira: el rectángulo mínimo tiene un lado sobre una arista
 * del casco; tres punteros que solo avanzan dan los extremos de cada arista, O(h) tras el casco). Sin dependencias.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/**
 * Mejora mínima del área para girar: bajo 0,5 % la pieza ya está alineada (ruido numérico o caras casi iguales) y no
 * se toca, así una pieza ya alineada no cambia.
 */
export const FOOTPRINT_MIN_GAIN = 0.005;

type P = [number, number];

const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Casco convexo 2D (cadena monótona), en sentido antihorario. */
export function convexHull2D(points: readonly P[]): P[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const lower: P[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Área de la caja de `hull` con ejes girados `angle` (radianes). */
export function boxArea(hull: readonly P[], angle: number): number {
  const c = Math.cos(angle), s = Math.sin(angle);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const [x, z] of hull) {
    const u = x * c + z * s, v = -x * s + z * c;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  return (maxU - minU) * (maxV - minV);
}

/**
 * Menor área de caja sobre las aristas del casco (calibradores rotatorios) y el ángulo de la arista que la da,
 * reducido al giro más corto (módulo 90°). Con empate de área gana el giro más corto. `hull` en sentido antihorario.
 */
export function minAreaBoxAngle(hull: readonly P[]): { area: number; angle: number } {
  const h = hull.length;
  let best = Infinity, bestAngle = 0;
  const at = (k: number) => hull[((k % h) + h) % h];
  // Punteros a los extremos en +d (derecha), +n (arriba) y −d (izquierda); solo avanzan con la arista.
  let right = 1, top = 1, left = 1;
  for (let i = 0; i < h; i++) {
    const a = hull[i], b = at(i + 1);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len === 0) continue;
    const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
    // n = (−dz, dx): hacia el interior del casco (antihorario).
    const along = (p: P, q: P) => (q[0] - p[0]) * dx + (q[1] - p[1]) * dz;
    const across = (p: P, q: P) => -(q[0] - p[0]) * dz + (q[1] - p[1]) * dx;
    if (right < i + 1) right = i + 1;
    for (let guard = 0; guard < h && along(at(right), at(right + 1)) > 0; guard++) right++;
    if (top < right) top = right;
    for (let guard = 0; guard < h && across(at(top), at(top + 1)) > 0; guard++) top++;
    if (left < top) left = top;
    for (let guard = 0; guard < h && along(at(left), at(left + 1)) < 0; guard++) left++;
    const width = along(at(left), at(right));
    const height = across(a, at(top));
    const area = width * height;
    let angle = Math.atan2(dz, dx);
    // Un rectángulo se repite cada 90°: el giro más corto que lo alinea.
    angle -= Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
    if (area < best - 1e-12 || (Math.abs(area - best) <= 1e-12 && Math.abs(angle) < Math.abs(bestAngle))) {
      best = area;
      bestAngle = angle;
    }
  }
  return { area: best, angle: bestAngle };
}

/**
 * Ángulo φ (radianes, en (−π/4, π/4]) del giro alrededor de +Y (convención de three.js) que minimiza el área de la
 * caja de la huella; 0 si no mejora más de `FOOTPRINT_MIN_GAIN`. `xz` son pares [x, z] de los vértices en mundo.
 */
export function footprintYaw(xz: readonly P[]): number {
  const hull = convexHull2D(xz);
  if (hull.length < 3) return 0;
  const base = boxArea(hull, 0);
  const { area, angle } = minAreaBoxAngle(hull);
  // El ángulo 0 también compite (la caja de la pieza tal como está).
  return base > 0 && area < base * (1 - FOOTPRINT_MIN_GAIN) ? angle : 0;
}
