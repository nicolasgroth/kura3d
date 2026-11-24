/**
 * @file src/core/addons/__tests__/denseMeshes.ts
 * @description Mallas cerradas de prueba armadas a mano (sin el motor): esfera UV con la densidad pedida y prisma
 * regular (cilindro facetado) a lo largo de +Y. Orientadas hacia afuera (volumen con signo positivo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../../types/kura';

/** Da vuelta los triángulos si el volumen con signo es negativo (normales hacia adentro). */
function outward(positions: number[], indices: number[]): MeshData {
  let v = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    v += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
      - positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  if (v < 0) for (let t = 0; t < indices.length; t += 3) [indices[t + 1], indices[t + 2]] = [indices[t + 2], indices[t + 1]];
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** Esfera UV de radio `r` centrada en el origen: `lat` bandas y `lon` meridianos (2·lon·(lat−1) triángulos). */
export function denseSphere(r: number, lat: number, lon: number): MeshData {
  const pos: number[] = [0, r, 0];
  for (let i = 1; i < lat; i++) {
    const th = (i * Math.PI) / lat;
    for (let j = 0; j < lon; j++) {
      const ph = (j * 2 * Math.PI) / lon;
      pos.push(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph));
    }
  }
  pos.push(0, -r, 0);
  const south = pos.length / 3 - 1;
  const at = (i: number, j: number) => 1 + (i - 1) * lon + (j % lon);
  const idx: number[] = [];
  for (let j = 0; j < lon; j++) idx.push(0, at(1, j + 1), at(1, j));
  for (let i = 1; i < lat - 1; i++) {
    for (let j = 0; j < lon; j++) {
      idx.push(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i + 1, j));
    }
  }
  for (let j = 0; j < lon; j++) idx.push(south, at(lat - 1, j), at(lat - 1, j + 1));
  return outward(pos, idx);
}

/** Prisma regular de `n` lados, radio `r` y alto `h` con la base centrada en `base`, a lo largo de +Y. */
export function prism(base: Vec3, r: number, h: number, n: number): MeshData {
  const pos: number[] = [];
  for (const y of [0, h]) {
    for (let k = 0; k < n; k++) {
      const a = (k * 2 * Math.PI) / n;
      pos.push(base[0] + r * Math.cos(a), base[1] + y, base[2] + r * Math.sin(a));
    }
  }
  pos.push(base[0], base[1], base[2], base[0], base[1] + h, base[2]);
  const cb = 2 * n, ct = 2 * n + 1;
  const idx: number[] = [];
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n;
    idx.push(k, k1, n + k1, k, n + k1, n + k, cb, k1, k, ct, n + k, n + k1);
  }
  return outward(pos, idx);
}
