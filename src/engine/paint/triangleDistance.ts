/**
 * @file src/engine/paint/triangleDistance.ts
 * @description Distancia al cuadrado exacta de un punto a un triángulo en R³ (regiones de Voronoi, Ericson).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/**
 * Distancia al cuadrado exacta desde `P` hasta el triángulo `(A, B, C)`: así brochas pequeñas pintan
 * caras grandes (low-poly) al tocar cualquier vértice, arista o interior.
 */
export function pointToTriangleDistanceSq(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;

  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) {
    return apx * apx + apy * apy + apz * apz;
  }

  const bpx = px - bx;
  const bpy = py - by;
  const bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) {
    return bpx * bpx + bpy * bpy + bpz * bpz;
  }

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    const qx = ax + v * abx - px;
    const qy = ay + v * aby - py;
    const qz = az + v * abz - pz;
    return qx * qx + qy * qy + qz * qz;
  }

  const cpx = px - cx;
  const cpy = py - cy;
  const cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) {
    return cpx * cpx + cpy * cpy + cpz * cpz;
  }

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    const qx = ax + w * acx - px;
    const qy = ay + w * acy - py;
    const qz = az + w * acz - pz;
    return qx * qx + qy * qy + qz * qz;
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    const qx = bx + w * (cx - bx) - px;
    const qy = by + w * (cy - by) - py;
    const qz = bz + w * (cz - bz) - pz;
    return qx * qx + qy * qy + qz * qz;
  }

  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  const qx = ax + abx * v + acx * w - px;
  const qy = ay + aby * v + acy * w - py;
  const qz = az + abz * v + acz * w - pz;
  return qx * qx + qy * qy + qz * qz;
}

/** Distancia al cuadrado de `c` (espacio escalado) al triángulo `t` de la malla con escala por eje `s`. */
export function scaledTriangleDistanceSq(
  P: Float32Array,
  I: Uint32Array,
  t: number,
  s: readonly [number, number, number],
  c: readonly [number, number, number],
): number {
  const i0 = I[t * 3] * 3, i1 = I[t * 3 + 1] * 3, i2 = I[t * 3 + 2] * 3;
  return pointToTriangleDistanceSq(
    c[0], c[1], c[2],
    P[i0] * s[0], P[i0 + 1] * s[1], P[i0 + 2] * s[2],
    P[i1] * s[0], P[i1 + 1] * s[1], P[i1 + 2] * s[2],
    P[i2] * s[0], P[i2 + 1] * s[1], P[i2 + 2] * s[2],
  );
}
