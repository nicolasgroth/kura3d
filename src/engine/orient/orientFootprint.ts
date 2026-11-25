/**
 * @file src/engine/orient/orientFootprint.ts
 * @description Giro alrededor de la vertical que deja la huella de la pieza con la caja envolvente de menor área
 * sobre la cama: casco convexo 2D (cadena monótona de Andrew) de los vértices proyectados en X/Z y barrido de sus
 * aristas (teorema de Freeman–Shapira: el rectángulo mínimo tiene un lado sobre una arista del casco; es la versión
 * O(h²) de los calibradores rotatorios, de sobra para cascos de cientos de puntos). Sin dependencias.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
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
function boxArea(hull: readonly P[], angle: number): number {
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
 * Ángulo φ (radianes, en (−π/4, π/4]) del giro alrededor de +Y (convención de three.js) que minimiza el área de la
 * caja de la huella; 0 si no mejora más de `FOOTPRINT_MIN_GAIN`. `xz` son pares [x, z] de los vértices en mundo.
 */
export function footprintYaw(xz: readonly P[]): number {
  const hull = convexHull2D(xz);
  if (hull.length < 3) return 0;
  const base = boxArea(hull, 0);
  let best = base, bestAngle = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    // Un rectángulo se repite cada 90°: el giro más corto que lo alinea.
    angle -= Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
    const area = boxArea(hull, angle);
    if (area < best - 1e-12 || (Math.abs(area - best) <= 1e-12 && Math.abs(angle) < Math.abs(bestAngle))) {
      best = area;
      bestAngle = angle;
    }
  }
  return base > 0 && best < base * (1 - FOOTPRINT_MIN_GAIN) ? bestAngle : 0;
}
