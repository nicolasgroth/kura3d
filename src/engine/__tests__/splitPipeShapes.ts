/**
 * @file src/engine/__tests__/splitPipeShapes.ts
 * @description Formas de prueba de "dividir para imprimir" en pared delgada: tubería en L y en T de
 * 1 m, tubo vertical, dos columnas separadas y estatua con brazo fino, más el chequeo común de piezas
 * (cerradas, un solo cuerpo, sin aristas sueltas, sin interferencia, volumen conservado).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { expect } from 'vitest';
import type { SceneObject } from '../../types/kura';
import { manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { normalizeMeshToBed } from '../primitives';
import type { BedSplitResult } from '../split';
import { makeObject } from './geometryTestUtils';

/** Objeto de escena desde un manifold en mundo (malla local + posición centro-base). Libera `m`. */
export function objFrom(m: Manifold, name: string): SceneObject {
  const mesh = manifoldToMeshData(m);
  const bb = m.boundingBox();
  const obj = makeObject(name, normalizeMeshToBed(mesh), {
    position: [(bb.min[0] + bb.max[0]) / 2, bb.min[1], (bb.min[2] + bb.max[2]) / 2],
  });
  m.delete();
  return obj;
}

/** Cilindro de eje Y desde `y0`, alto `h`, centrado en (x, z). */
function cylY(w: ManifoldToplevel, h: number, r: number, x: number, y0: number, z = 0, seg = 64): Manifold {
  const c = w.Manifold.cylinder(h, r, r, seg);
  const up = c.rotate([-90, 0, 0]).translate([x, y0, z]);
  c.delete();
  return up;
}

/** Cilindro de eje X desde `x0`, largo `l`, a la altura `y`. */
function cylX(w: ManifoldToplevel, l: number, r: number, x0: number, y: number, seg = 64): Manifold {
  const c = w.Manifold.cylinder(l, r, r, seg);
  const along = c.rotate([0, 90, 0]).translate([x0, y, 0]);
  c.delete();
  return along;
}

function hollow(w: ManifoldToplevel, outers: Manifold[], inners: Manifold[]): Manifold {
  const o = w.Manifold.union(outers);
  const i = w.Manifold.union(inners);
  const r = o.subtract(i);
  for (const h of [o, i, ...outers, ...inners]) h.delete();
  return r;
}

/** Tubería en L de 1 m × 1 m, Ø`d`, pared `t`: tramo vertical a la izquierda y tramo horizontal abajo. */
export function lPipe(w: ManifoldToplevel, d = 150, t = 5): Manifold {
  const R = d / 2;
  const r = R - t;
  const xv = -500 + R;
  return hollow(
    w,
    [cylY(w, 1000, R, xv, 0), cylX(w, 1000, R, -500, R)],
    [cylY(w, 1000 - R + 1, r, xv, R), cylX(w, 1000 - R + 1, r, xv, R)],
  );
}

/** Tubería en T de 1 m: tubo vertical de 1 m y brazo horizontal de 1 m arriba, Ø`d`, pared `t`. */
export function tPipe(w: ManifoldToplevel, d = 150, t = 4): Manifold {
  const R = d / 2;
  const r = R - t;
  const yh = 1000 - R;
  return hollow(
    w,
    [cylY(w, 1000 - R, R, 0, 0), cylX(w, 1000, R, -500, yh)],
    [cylY(w, 1000 - R + 1, r, 0, -1), cylX(w, 1002, r, -501, yh)],
  );
}

/** Tubo vertical de diámetro `d`, alto `h` y pared `t`. */
export function bigTube(w: ManifoldToplevel, d = 1000, h = 1000, t = 4, seg = 160): Manifold {
  return hollow(w, [cylY(w, h, d / 2, 0, 0, 0, seg)], [cylY(w, h + 2, d / 2 - t, 0, -1, 0, seg)]);
}

/** Dos columnas macizas separadas 60 mm (no se tocan). */
export function twoColumns(w: ManifoldToplevel): Manifold {
  const a = w.Manifold.cube([120, 400, 120], false).translate([-150, 0, -60]);
  const b = w.Manifold.cube([120, 400, 120], false).translate([30, 0, -60]);
  const u = w.Manifold.union([a, b]);
  a.delete();
  b.delete();
  return u;
}

/** Comprueba todas las piezas de un resultado. Devuelve métricas para el informe. */
export function checkAllParts(w: ManifoldToplevel, res: BedSplitResult, usable = 240) {
  const placed = res.parts.map((p) => {
    const m = meshDataToManifold(w, p.mesh);
    expect(m.status()).toBe('NoError');
    expect(countUnpairedEdges(p.mesh)).toBe(0);
    const comps = m.decompose();
    expect(comps.length, `pieza ${p.code} con ${comps.length} cuerpos`).toBe(1);
    for (const c of comps) c.delete();
    const size = [0, 1, 2].map((a) => p.bounds.max[a] - p.bounds.min[a]).sort((a, b) => a - b);
    expect(size[2]).toBeLessThanOrEqual(usable + 1e-6);
    const t = m.translate(p.assembly.position);
    m.delete();
    return t;
  });
  let interference = 0;
  try {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const A = res.parts[i].bounds;
        const B = res.parts[j].bounds;
        if ([0, 1, 2].some((a) => A.max[a] < B.min[a] - 1e-3 || B.max[a] < A.min[a] - 1e-3)) continue;
        const inter = placed[i].intersect(placed[j]);
        interference += inter.volume();
        inter.delete();
      }
    }
  } finally {
    for (const m of placed) m.delete();
  }
  expect(interference).toBeLessThan(0.1);
  const sum = res.parts.reduce((s, p) => s + p.volumeMm3, 0);
  const expected = res.sourceVolumeMm3 - res.clearanceVolumeMm3 - res.engravedVolumeMm3;
  expect(Math.abs(sum - expected) / res.sourceVolumeMm3).toBeLessThan(1e-4);
  return { interference };
}
