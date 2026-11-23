/**
 * @file src/engine/paint/__tests__/plateFixtures.ts
 * @description Placa cerrada de 60×60×1 (celdas de 1 mm arriba y abajo, paredes largas) y conteo de
 * caras pintadas de espaldas a la cámara o en la cara inferior, para las pruebas de visibilidad del pincel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { computeMeshStats } from '../..';
import type { MeshData, SceneObject, Vec3 } from '../../../types/kura';
import { thinPlate } from './paintTestMeshes';

/** Placa cerrada (estanca) de 60×60×1: caras superior e inferior en celdas de 1 mm y cuatro paredes largas. */
export function closedPlate(): MeshData {
  const open = thinPlate(60, 1, 60);
  const pos = Array.from(open.positions);
  const idx = Array.from(open.indices);
  const n = 61;
  const top = (i: number, j: number) => i * n + j;
  const bot = (i: number, j: number) => n * n + i * n + j;
  // Borde recorrido en sentido antihorario visto desde arriba: paredes con normal hacia afuera.
  const ring: [number, number][] = [];
  for (let j = 0; j < 60; j++) ring.push([0, j]);
  for (let i = 0; i < 60; i++) ring.push([i, 60]);
  for (let j = 60; j > 0; j--) ring.push([60, j]);
  for (let i = 60; i > 0; i--) ring.push([i, 0]);
  for (let k = 0; k < ring.length; k++) {
    const [i0, j0] = ring[k];
    const [i1, j1] = ring[(k + 1) % ring.length];
    const a = top(i0, j0), b = top(i1, j1), c = bot(i1, j1), d = bot(i0, j0);
    idx.push(a, b, d, b, c, d);
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx) };
}

export function plateObject(mesh: MeshData): SceneObject {
  return {
    id: 'placa', name: 'placa', source: 'imported', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: '#cccccc', role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
  } as SceneObject;
}

/** Caras pintadas cuya normal no mira al ojo o que están en la cara inferior (y mínima). */
export function wrongFaces(mesh: MeshData, base: string, eye: Vec3, bottomY: number): { painted: number; back: number; bottom: number } {
  const fc = mesh.faceColors ?? [];
  const P = mesh.positions, I = mesh.indices;
  let painted = 0, back = 0, bottom = 0;
  for (let t = 0; t < fc.length; t++) {
    if (fc[t].toLowerCase() === base.toLowerCase()) continue;
    painted++;
    const v = [0, 1, 2].map((k) => [P[I[t * 3 + k] * 3], P[I[t * 3 + k] * 3 + 1], P[I[t * 3 + k] * 3 + 2]]);
    const e1 = v[1].map((x, k) => x - v[0][k]), e2 = v[2].map((x, k) => x - v[0][k]);
    const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const dot = nrm[0] * (eye[0] - v[0][0]) + nrm[1] * (eye[1] - v[0][1]) + nrm[2] * (eye[2] - v[0][2]);
    if (dot < 0) back++;
    if (v.every((p) => p[1] < bottomY + 0.05)) bottom++;
  }
  return { painted, back, bottom };
}
