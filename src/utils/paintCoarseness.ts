/**
 * @file src/utils/paintCoarseness.ts
 * @description Detecta mallas demasiado gruesas para pintar con detalle: si el triángulo típico es
 * mucho mayor que el radio del pincel, el pincel colorea la cara entera. Función pura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Cuántas veces mayor que el radio debe ser el triángulo típico para avisar. */
export const COARSE_TRIANGLE_RADIUS_RATIO = 3;

/** Tamaño típico (mm) del triángulo: raíz de 2×área mediana, con la escala del objeto aplicada. */
export function typicalTriangleSizeMm(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  scale: readonly [number, number, number] = [1, 1, 1],
): number {
  const triCount = Math.floor(indices.length / 3);
  if (triCount === 0) return 0;
  const areas: number[] = [];
  const [sx, sy, sz] = scale;
  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const ux = (positions[b] - positions[a]) * sx;
    const uy = (positions[b + 1] - positions[a + 1]) * sy;
    const uz = (positions[b + 2] - positions[a + 2]) * sz;
    const vx = (positions[c] - positions[a]) * sx;
    const vy = (positions[c + 1] - positions[a + 1]) * sy;
    const vz = (positions[c + 2] - positions[a + 2]) * sz;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    areas.push(0.5 * Math.hypot(cx, cy, cz));
  }
  areas.sort((p, q) => p - q);
  return Math.sqrt(2 * areas[Math.floor(areas.length / 2)]);
}

/** True si el pincel de `radiusMm` pintaría caras enteras de esta malla. */
export function isMeshTooCoarseForBrush(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  scale: readonly [number, number, number],
  radiusMm: number,
): boolean {
  if (!(radiusMm > 0)) return false;
  return typicalTriangleSizeMm(positions, indices, scale) > radiusMm * COARSE_TRIANGLE_RADIUS_RATIO;
}
