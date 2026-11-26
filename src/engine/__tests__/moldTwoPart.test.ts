/**
 * @file src/engine/__tests__/moldTwoPart.test.ts
 * @description Molde bivalvo (`direct_2part`) de esfera, pieza no convexa en L y pieza con agujero
 * pasante, en ambos ejes de partición: las dos mitades son mallas cerradas, la cavidad (caja del
 * molde armado menos el molde) reproduce el volumen de la pieza, la pared mínima respeta el
 * parámetro, las mitades no se intersecan y los pines de registro calzan con su holgura (se
 * deslizan 0,9 × holgura sin chocar y chocan al moverse 3 × holgura).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterAll, describe, expect, it } from 'vitest';
import type { Manifold } from 'manifold-3d';
import type { MeshData, MoldOptions, Vec3 } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { generateMold } from '../molds';
import { computeMeshStats, createPrimitiveMesh, normalizeMeshToBed } from '../primitives';
import { makeObject } from './geometryTestUtils';

const WALL = 6;
const TOL = 0.25;
/** Separación visual que aplica el generador entre las mitades. */
const VISUAL_OFFSET = 8;

const handles: Manifold[] = [];
const own = (m: Manifold): Manifold => (handles.push(m), m);
afterAll(() => handles.forEach((h) => h.delete()));

async function lShape(): Promise<MeshData> {
  const w = await initManifoldEngine();
  return normalizeMeshToBed(manifoldToMeshData(own(w.Manifold.union([
    own(w.Manifold.cube([40, 12, 12])),
    own(w.Manifold.cube([12, 12, 36])),
  ]))));
}

async function holedBlock(): Promise<MeshData> {
  const w = await initManifoldEngine();
  // Bloque 30 × 16 × 30 con agujero pasante vertical de radio 5.
  const block = own(w.Manifold.cube([30, 16, 30], true));
  const hole = own(own(w.Manifold.cylinder(30, 5, 5, 32, true)).rotate([90, 0, 0]));
  return normalizeMeshToBed(manifoldToMeshData(own(block.subtract(hole))));
}

const translated = (mesh: MeshData, d: Vec3): MeshData => {
  const positions = new Float32Array(mesh.positions);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += d[0];
    positions[i + 1] += d[1];
    positions[i + 2] += d[2];
  }
  return { ...mesh, positions, faceColors: undefined };
};

const boxVolume = (m: Manifold) => {
  const b = m.boundingBox();
  return (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
};

describe.each<['x' | 'z']>([['x'], ['z']])('molde bivalvo, partición en %s', (axis) => {
  const options: MoldOptions = {
    mode: 'direct_2part', wallMarginMm: WALL, boxWallMm: 3, splitAxis: axis, pourSpout: false,
    pourSpoutRadiusMm: 4, keyToleranceMm: TOL, cavityWallMm: 3,
  };

  // La esfera solo toca la cara abierta en un punto: sin embudo su cavidad quedaría sellada.
  it.each<[string, () => Promise<MeshData>, boolean]>([
    ['esfera (con embudo)', async () => normalizeMeshToBed(await createPrimitiveMesh('sphere', { radius: 12, segments: 40 })), true],
    ['L no convexa', lShape, false],
    ['bloque con agujero pasante', holedBlock, false],
  ])('%s', async (_name, make, pourSpout) => {
    const wasm = await initManifoldEngine();
    const master = await make();
    const masterStats = computeMeshStats(master);
    const parts = await generateMold(makeObject('m', master), { ...options, pourSpout });
    expect(parts.map((p) => p.label)).toEqual(['halfA', 'halfB']);

    // 1. Mitades cerradas.
    for (const p of parts) expect(computeMeshStats(p.mesh).isManifold).toBe(true);

    // Armado: se deshace la separación visual (A va en −eje, B en +eje).
    const off: Vec3 = axis === 'x' ? [VISUAL_OFFSET, 0, 0] : [0, 0, VISUAL_OFFSET];
    const [pa, pb] = parts;
    const a = own(meshDataToManifold(wasm, translated(pa.mesh, [pa.position[0] + off[0], pa.position[1], pa.position[2] + off[2]])));
    const b = own(meshDataToManifold(wasm, translated(pb.mesh, [pb.position[0] - off[0], pb.position[1], pb.position[2] - off[2]])));

    // 2. Las mitades no se intersecan.
    expect(own(a.intersect(b)).volume()).toBeLessThan(1e-3);

    // 3. La cavidad reproduce la pieza (± 0,5 %): dentro de la caja de la pieza (los pines y el
    // embudo quedan fuera de ella), el hueco del molde armado mide lo mismo que la pieza.
    const assembled = own(a.add(b));
    const bb = assembled.boundingBox();
    const md = masterStats.dimensionsMm;
    const pieceBox = own(own(wasm.Manifold.cube(md, false)).translate([bb.min[0] + WALL, bb.min[1] + WALL, bb.min[2] + WALL]));
    const cavity = boxVolume(pieceBox) - own(assembled.intersect(pieceBox)).volume();
    expect(Math.abs(cavity / masterStats.volumeMm3 - 1)).toBeLessThan(0.005);

    // 4. Pared mínima: la caja del molde es la de la pieza + pared en X, Z y en la base; arriba,
    // abierto o (con embudo) con tapa de pared completa.
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(md[0] + 2 * WALL, 2);
    expect(bb.max[2] - bb.min[2]).toBeCloseTo(md[2] + 2 * WALL, 2);
    expect(bb.max[1] - bb.min[1]).toBeCloseTo(md[1] + (pourSpout ? 2 : 1) * WALL, 2);
    // La pared entre la pieza y el exterior es material macizo de al menos WALL: una caja de la pieza
    // agrandada en (WALL − 0,05) mm, menos la caja de la pieza, queda llena de molde salvo el embudo.
    const grown = own(own(wasm.Manifold.cube([md[0] + 2 * (WALL - 0.05), md[1] + (WALL - 0.05), md[2] + 2 * (WALL - 0.05)], false))
      .translate([bb.min[0] + 0.05, bb.min[1] + 0.05, bb.min[2] + 0.05]));
    const shell = own(grown.subtract(pieceBox));
    const shellFill = own(assembled.intersect(shell)).volume() / shell.volume();
    // Lo único vacío en la pared es el embudo y la holgura de los alojamientos de los pines.
    expect(shellFill).toBeGreaterThan(pourSpout ? 0.97 : 0.995);

    // 5. Pines de registro: deslizan dentro de la holgura y registran fuera de ella.
    const perpendicular: Vec3[] = axis === 'x' ? [[0, 1, 0], [0, 0, 1]] : [[0, 1, 0], [1, 0, 0]];
    for (const dir of perpendicular) {
      for (const sign of [1, -1]) {
        const slide = (k: number) => own(own(a.translate([dir[0] * sign * k, dir[1] * sign * k, dir[2] * sign * k])).intersect(b)).volume();
        expect(slide(0.9 * TOL)).toBeLessThan(1e-3);
        expect(slide(3 * TOL)).toBeGreaterThan(1e-3);
      }
    }
  }, 60000);
});
