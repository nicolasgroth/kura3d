/**
 * @file src/engine/__tests__/orientNoBase.test.ts
 * @description «Orientar para imprimir» en piezas sin base estable: una figura sin ninguna cara plana nunca
 * dice «ya es la mejor» y lleva el estado `noStableBase`; una esfera con un plano recortado pequeño propone
 * apoyarla en ese plano (parche de caras coplanares con contacto real), con base antes que sin base.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, Vec3 } from '../../types/kura';
import { analyzeOrientations } from '../orient';
import { planarPatchDirections } from '../orient/orientPatches';
import { prepareOrientWorld } from '../orient/orientWorld';
import { input } from './orientShapes';

/** Elipsoide UV (semiejes a, b, c) con normales hacia fuera; `cut` aplana lo que pase de `limit` en esa dirección. */
function ellipsoid(a: number, b: number, c: number, seg = 64, rings = 32, cut?: { dir: Vec3; limit: number }): MeshData {
  const pos: number[] = [];
  const idx: number[] = [];
  pos.push(0, b, 0);
  for (let i = 1; i < rings; i++) {
    const th = (Math.PI * i) / rings;
    for (let j = 0; j < seg; j++) {
      const ph = (2 * Math.PI * j) / seg;
      pos.push(a * Math.sin(th) * Math.cos(ph), b * Math.cos(th), c * Math.sin(th) * Math.sin(ph));
    }
  }
  pos.push(0, -b, 0);
  const last = pos.length / 3 - 1;
  const ring = (i: number, j: number) => 1 + (i - 1) * seg + (j % seg);
  for (let j = 0; j < seg; j++) idx.push(0, ring(1, j + 1), ring(1, j));
  for (let i = 1; i < rings - 1; i++) {
    for (let j = 0; j < seg; j++) {
      idx.push(ring(i, j), ring(i, j + 1), ring(i + 1, j + 1), ring(i, j), ring(i + 1, j + 1), ring(i + 1, j));
    }
  }
  for (let j = 0; j < seg; j++) idx.push(last, ring(rings - 1, j), ring(rings - 1, j + 1));
  if (cut) {
    const d = cut.dir, l = Math.hypot(...d);
    const n: Vec3 = [d[0] / l, d[1] / l, d[2] / l];
    for (let v = 0; v < pos.length; v += 3) {
      const s = pos[v] * n[0] + pos[v + 1] * n[1] + pos[v + 2] * n[2];
      if (s > cut.limit) for (let k = 0; k < 3; k++) pos[v + k] -= (s - cut.limit) * n[k];
    }
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx), normals: new Float32Array(pos.length) } as MeshData;
}

const CUT_DIR: Vec3 = [0.6, -0.3, 0.74];
const unit = (v: Vec3): Vec3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('Orientar: pieza sin base estable', () => {
  it('figura sin caras planas: nunca «ya es la mejor» y estado sin base estable', () => {
    const a = analyzeOrientations(input(ellipsoid(30, 20, 15)));
    const cur = a.candidates.find((c) => c.id === a.currentId)!;
    expect(cur.measures.stable).toBe(false);
    expect(a.candidates.every((c) => !c.measures.stable)).toBe(true);
    expect(a.currentIsBest).toBe(false);
    expect(a.baseStatus).toBe('noStableBase');
  });

  it('una pieza con base sigue en estado normal', () => {
    const a = analyzeOrientations(input(ellipsoid(20, 20, 20, 64, 32, { dir: [0, -1, 0], limit: 17 })));
    expect(a.baseStatus).toBe('ok');
    expect(a.currentIsBest).toBe(true);
  });

  it('esfera con plano recortado pequeño: el parche plano es candidato y queda primero', () => {
    const mesh = ellipsoid(20, 20, 20, 64, 32, { dir: CUT_DIR, limit: 18.5 });
    const world = prepareOrientWorld(input(mesh));
    const dirs = planarPatchDirections(world, 10, 4);
    expect(dirs.length).toBeGreaterThanOrEqual(1);
    expect(dot(dirs[0].down, unit(CUT_DIR))).toBeGreaterThan(Math.cos((0.5 * Math.PI) / 180));
    // Área del disco recortado: π (r² − l²) ≈ 181 mm² (la malla facetada da algo menos).
    expect(dirs[0].contactMm2).toBeGreaterThan(120);

    const a = analyzeOrientations(input(mesh));
    expect(a.baseStatus).toBe('ok');
    expect(a.currentIsBest).toBe(false);
    const best = a.candidates[0];
    expect(best.measures.stable).toBe(true);
    expect(best.measures.contactAreaMm2).toBeGreaterThan(120);
    expect(dot(best.down, unit(CUT_DIR))).toBeGreaterThan(Math.cos((1 * Math.PI) / 180));
  });
});
