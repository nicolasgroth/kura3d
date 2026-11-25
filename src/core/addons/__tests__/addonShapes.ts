/**
 * @file src/core/addons/__tests__/addonShapes.ts
 * @description Mallas de prueba de los agregados (ojo de cerradura, paso de cable): caja cerrada con la base en
 * y = 0 y centrada en X y Z, y la caja desplazada a un origen dado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../../types/kura';

/** Caja de `w × h × d` con la base en y = 0, centrada en X y Z (más `dx`, `dz`). */
export function plateMesh(w: number, h: number, d: number, dx = 0, dz = 0): MeshData {
  const x = w / 2, z = d / 2;
  const v = [
    [-x, 0, -z], [x, 0, -z], [x, h, -z], [-x, h, -z],
    [-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z],
  ].flatMap(([a, b, c]) => [a + dx, b, c + dz]);
  const f = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
    3, 7, 6, 3, 6, 2,
    0, 1, 5, 0, 5, 4,
  ];
  return { positions: new Float32Array(v), indices: new Uint32Array(f) };
}
