/**
 * @file src/core/addons/stadiumMesh.ts
 * @description Sólidos de sección «estadio» (rectángulo con extremos semicirculares; con tramo recto 0 es un círculo)
 * extruidos a lo largo del eje +Y local, con la sección que puede crecer o achicarse por tramos (chaflanes). La
 * sección vive en el plano XZ: los centros de los dos semicírculos están en x = `x0` y x = `x0 + straightMm`, z = 0.
 * Cada anillo es un polígono circunscrito (su ancho entre caras planas es el pedido: el cable o el tornillo entran).
 * La malla es cerrada y orientada hacia afuera (tapas en abanico: la sección es convexa). Base común del ojo de
 * cerradura y del paso de cable; funciones puras, sin el motor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';

/** Lados de cada semicírculo. */
export const STADIUM_HALF_SEGMENTS = 32;

/** Un nivel de la extrusión: altura local y radio de la sección en ese nivel. */
export interface StadiumRing {
  y: number;
  radius: number;
}

export interface StadiumSpec {
  /** Distancia entre los centros de los dos semicírculos (0 = círculo). */
  straightMm: number;
  /** x del primer centro (el segundo está en `x0 + straightMm`). */
  x0?: number;
  /** Niveles de abajo hacia arriba (y creciente), al menos dos. */
  rings: readonly StadiumRing[];
}

/** Radio de vértice para que el polígono tenga `apothem` entre caras planas. */
const circumscribed = (apothem: number) => apothem / Math.cos(Math.PI / (2 * STADIUM_HALF_SEGMENTS));

/** Puntos (x, z) de la sección de radio `radius`, en sentido creciente del ángulo. */
export function stadiumOutline(radius: number, straightMm: number, x0 = 0): Array<[number, number]> {
  const r = circumscribed(radius);
  const n = STADIUM_HALF_SEGMENTS;
  const out: Array<[number, number]> = [];
  if (!(straightMm > 1e-9)) {
    for (let k = 0; k < 2 * n; k++) {
      const a = (k * Math.PI) / n;
      out.push([x0 + r * Math.cos(a), r * Math.sin(a)]);
    }
    return out;
  }
  // Semicírculo del extremo lejano (de −90° a 90°) y luego el del cercano (de 90° a 270°).
  for (let k = 0; k <= n; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / n;
    out.push([x0 + straightMm + r * Math.cos(a), r * Math.sin(a)]);
  }
  for (let k = 0; k <= n; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / n;
    out.push([x0 + r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

/** Malla cerrada de la extrusión por tramos. */
export function stadiumLoftMesh(spec: StadiumSpec): MeshData {
  const { rings, straightMm } = spec;
  const x0 = spec.x0 ?? 0;
  if (rings.length < 2) throw new Error('stadiumLoftMesh: se necesitan al menos dos niveles');
  const outlines = rings.map((ring) => stadiumOutline(ring.radius, straightMm, x0));
  const m = outlines[0].length;
  const positions: number[] = [];
  outlines.forEach((outline, i) => {
    for (const [x, z] of outline) positions.push(x, rings[i].y, z);
  });
  const cx = x0 + Math.max(0, straightMm) / 2;
  const bottom = positions.length / 3;
  positions.push(cx, rings[0].y, 0);
  const top = bottom + 1;
  positions.push(cx, rings[rings.length - 1].y, 0);
  const indices: number[] = [];
  for (let i = 0; i + 1 < rings.length; i++) {
    const a0 = i * m, a1 = (i + 1) * m;
    for (let k = 0; k < m; k++) {
      const k1 = (k + 1) % m;
      indices.push(a0 + k, a1 + k, a0 + k1, a0 + k1, a1 + k, a1 + k1);
    }
  }
  const last = (rings.length - 1) * m;
  for (let k = 0; k < m; k++) {
    const k1 = (k + 1) % m;
    indices.push(bottom, k, k1, top, last + k1, last + k);
  }
  const mesh: MeshData = { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
  // Orientación hacia afuera: si el volumen con signo sale negativo, se invierten los triángulos.
  if (signedVolume(mesh) < 0) {
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const b = mesh.indices[t + 1];
      mesh.indices[t + 1] = mesh.indices[t + 2];
      mesh.indices[t + 2] = b;
    }
  }
  return mesh;
}

/** Volumen con signo (positivo si las caras miran hacia afuera). */
export function signedVolume(mesh: MeshData): number {
  const p = mesh.positions, idx = mesh.indices;
  let v = 0;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
      - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
      + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return v / 6;
}

/** Área de la sección (la del polígono real, con apotema `radius`). */
export function stadiumSectionArea(radius: number, straightMm: number): number {
  const n = 2 * STADIUM_HALF_SEGMENTS;
  return n * radius * radius * Math.tan(Math.PI / n) + 2 * circumscribed(radius) * Math.max(0, straightMm);
}

/**
 * Distancia desde el centro de un estadio (centrado en el origen, tramo recto `2·halfStraight` sobre X) hasta su
 * borde en la dirección de ángulo `angle` (radianes, en el plano XZ).
 */
export function stadiumReach(radius: number, halfStraight: number, angle: number): number {
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  const a = Math.max(0, halfStraight);
  const cap = a * c + Math.sqrt(Math.max(0, radius * radius - a * a * s * s));
  if (cap * c >= a - 1e-9) return cap;
  return s > 1e-12 ? radius / s : cap;
}

/** Distancia (en el plano) de (x, z) al estadio centrado en el origen: negativa dentro. */
export function stadiumPlaneDistance(x: number, z: number, radius: number, halfStraight: number): number {
  const a = Math.max(0, halfStraight);
  const dx = Math.max(0, Math.abs(x) - a);
  return Math.hypot(dx, z) - radius;
}
