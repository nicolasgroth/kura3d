/**
 * @file src/engine/__tests__/orientShapes.ts
 * @description Geometría conocida para las pruebas de «Orientar para imprimir»: perfiles 2D (con
 * agujeros) extruidos en Z en ejes internos (Y arriba), cerrados y con normales hacia fuera.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { MeshData, Vec3 } from '../../types/kura';
import { signedVolumeMm3 } from '../meshOrientation';
import type { OrientInput } from '../orient';

type P2 = [number, number];

/** Extruye el perfil (plano XY, Y arriba) entre z = 0 y z = `depth`. */
export function extrude(outer: P2[], holes: P2[][], depth: number): MeshData {
  const ccw = (loop: P2[], want: boolean) => (THREE.ShapeUtils.isClockWise(loop.map(([x, y]) => new THREE.Vector2(x, y))) === want ? [...loop].reverse() : loop);
  const o = ccw(outer, true);
  const hs = holes.map((h) => ccw(h, false));
  const loops = [o, ...hs];
  const flat = loops.flat();
  const n = flat.length;
  const pos: number[] = [];
  for (const [x, y] of flat) pos.push(x, y, 0);
  for (const [x, y] of flat) pos.push(x, y, depth);
  const idx: number[] = [];
  const tris = THREE.ShapeUtils.triangulateShape(o.map(([x, y]) => new THREE.Vector2(x, y)), hs.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y))));
  for (const [a, b, c] of tris) {
    idx.push(a, c, b);
    idx.push(n + a, n + b, n + c);
  }
  let off = 0;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const a = off + i, b = off + ((i + 1) % loop.length);
      idx.push(a, b, n + b, a, n + b, n + a);
    }
    off += loop.length;
  }
  let indices = new Uint32Array(idx);
  const mesh = { positions: new Float32Array(pos), indices, normals: new Float32Array(pos.length) } as MeshData;
  if (signedVolumeMm3(mesh) < 0) {
    indices = new Uint32Array(idx.length);
    for (let t = 0; t < idx.length; t += 3) { indices[t] = idx[t]; indices[t + 1] = idx[t + 2]; indices[t + 2] = idx[t + 1]; }
    mesh.indices = indices;
  }
  return mesh;
}

export const rect = (x0: number, y0: number, x1: number, y1: number): P2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** «T» de pie: tallo 10 × 40, travesaño 60 × 10 arriba, 10 de espesor. */
export const tUpright = () => extrude([[-5, 0], [5, 0], [5, 40], [30, 40], [30, 50], [-30, 50], [-30, 40], [-5, 40]], [], 10);

/** «Γ»: pata 10 × 50 y brazo de 30 × 10 arriba que vuela hacia +X, 10 de espesor. */
export const gamma = () => extrude([[0, 0], [10, 0], [10, 40], [40, 40], [40, 50], [0, 50]], [], 10);

/** Cubo de 30 con agujero cuadrado pasante de 10 × 10 a lo largo de Z (horizontal). */
export const cubeWithHole = () => extrude(rect(-15, 0, 15, 30), [rect(-5, 10, 5, 20)], 30);

/** Caja cerrada de tamaño interno (x, y altura, z) apoyada en y = 0. */
export const box = (x: number, y: number, z: number) => extrude(rect(-x / 2, 0, x / 2, y), [], z);

/** Junta mallas cerradas desplazadas en una sola (varios cuerpos, sin unirlos). */
export function bodies(parts: Array<{ mesh: MeshData; offset: Vec3 }>): MeshData {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const { mesh, offset } of parts) {
    const base = pos.length / 3;
    for (let i = 0; i < mesh.positions.length; i += 3) pos.push(mesh.positions[i] + offset[0], mesh.positions[i + 1] + offset[1], mesh.positions[i + 2] + offset[2]);
    for (const k of mesh.indices) idx.push(base + k);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx), normals: new Float32Array(pos.length) } as MeshData;
}

/** Caso de QA (25-nov): cajas 10×10×40 (centro usuario [0,0,20]) y 40×10×10 (centro [0,0,45]) que no se tocan. */
export const qaCross = () => bodies([
  // A: x ∈ [−5, 5], y ∈ [15, 25], z ∈ [−20, 20]
  { mesh: box(10, 10, 40), offset: [0, 15, -20] },
  // B: x ∈ [−20, 20], y ∈ [40, 50], z ∈ [−5, 5]
  { mesh: box(40, 10, 10), offset: [0, 40, -5] },
]);

/** Dos cubos de 10 separados en diagonal y a distinta altura. */
export const stepCubes = () => bodies([
  { mesh: box(10, 10, 10), offset: [0, 0, 0] },
  { mesh: box(10, 10, 10), offset: [25, 12, 0] },
]);

export const input =(mesh: MeshData, position: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): OrientInput =>
  ({ mesh, position, rotation, scale });
