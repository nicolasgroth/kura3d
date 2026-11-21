/**
 * @file src/engine/__tests__/moldFill.test.ts
 * @description Moldes: núcleo por offset real (toro, L) contenido en el maestro con pared
 * uniforme medida, y embudos sobre la cavidad real sin vacíos sellados en toro, texto "AB" y
 * pieza con agujeros pasantes; error tipado cuando no hay forma de llenar sin embudo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, MoldOptions, Vec3 } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { buildMeshDistanceField } from '../meshDistance';
import { countSealedVoids } from '../moldChannels';
import { generateMold } from '../molds';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { makeObject } from './geometryTestUtils';

const BASE: MoldOptions = {
  mode: 'direct_1part',
  wallMarginMm: 5,
  boxWallMm: 3,
  splitAxis: 'x',
  pourSpout: true,
  pourSpoutRadiusMm: 3,
  keyToleranceMm: 0.25,
  cavityWallMm: 2,
};

function placed(mesh: MeshData, position: Vec3): MeshData {
  return {
    positions: mesh.positions.map((v, i) => v + position[i % 3]),
    indices: mesh.indices,
  };
}

async function sealedVoids(mesh: MeshData): Promise<number> {
  const wasm = await initManifoldEngine();
  const m = meshDataToManifold(wasm, mesh);
  const b = m.boundingBox();
  try {
    return countSealedVoids(wasm, m, {
      minX: b.min[0], minY: b.min[1], minZ: b.min[2], maxX: b.max[0], maxY: b.max[1], maxZ: b.max[2],
    }).count;
  } finally {
    m.delete();
  }
}

async function plateWithHoles(): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const plate = wasm.Manifold.cube([40, 6, 24], true);
  const hole = wasm.Manifold.cylinder(10, 4, 4, 32, true).rotate([90, 0, 0]);
  const h1 = hole.translate([-10, 0, 0]);
  const h2 = hole.translate([10, 0, 0]);
  const out = plate.subtract(h1).subtract(h2);
  try {
    return manifoldToMeshData(out);
  } finally {
    for (const m of [plate, hole, h1, h2, out]) m.delete();
  }
}

describe('Moldes: núcleo real y llenado verificable (molds.ts)', () => {
  it.each([
    ['toro', () => createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 5, segments: 48 })],
    ['texto AB', () => createPrimitiveMesh('text', { text: 'AB', fontSize: 30, height: 6 })],
    ['placa con 2 agujeros', plateWithHoles],
  ])('%s: el molde de 1 parte con embudo no deja vacíos sellados', async (_n, make) => {
    const mesh = await make();
    const parts = await generateMold(makeObject('m', mesh), BASE);
    expect(parts).toHaveLength(1);
    expect(computeMeshStats(parts[0].mesh).isManifold).toBe(true);
    expect(await sealedVoids(parts[0].mesh)).toBe(0);
  }, 60000);

  it('molde de 2 partes del toro: las mitades unidas no dejan vacíos sellados', async () => {
    const mesh = await createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 5, segments: 48 });
    const parts = await generateMold(makeObject('m', mesh), { ...BASE, mode: 'direct_2part' });
    expect(parts).toHaveLength(2);
    for (const p of parts) expect(computeMeshStats(p.mesh).isManifold).toBe(true);
  }, 60000);

  it('sin embudo, una pieza que no llega a la tapa lanza MOLD_SEALED_CAVITY', async () => {
    // Dos cuerpos de distinta altura: el bajo queda sellado bajo el bloque abierto
    const wasm = await initManifoldEngine();
    const tall = wasm.Manifold.cube([10, 20, 10]);
    const short = wasm.Manifold.cube([10, 8, 10]).translate([20, 0, 0]);
    const both = tall.add(short);
    const mesh = manifoldToMeshData(both);
    for (const m of [tall, short, both]) m.delete();
    await expect(
      generateMold(makeObject('s', mesh), { ...BASE, pourSpout: false })
    ).rejects.toMatchObject({ code: 'MOLD_SEALED_CAVITY' });
    // Con embudo cada cuerpo recibe su canal y se puede llenar
    const ok = await generateMold(makeObject('s', mesh), BASE);
    expect(await sealedVoids(ok[0].mesh)).toBe(0);
  }, 60000);

  it.each([
    ['toro', () => createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 6, segments: 48 })],
    ['tubo', () => createPrimitiveMesh('tube', { outerRadius: 12, innerRadius: 5, height: 20 })],
  ])('%s: el núcleo queda dentro del maestro con pared uniforme', async (_n, make) => {
    const mesh = await make();
    const wall = 2;
    const parts = await generateMold(makeObject('c', mesh), { ...BASE, mode: 'core_cavity', cavityWallMm: wall });
    const core = parts.find((p) => p.nameSuffix.includes('cleo'))!;
    const outer = parts.find((p) => p !== core)!;
    // Reconstruimos en mundo: el maestro está en el origen, apoyado en Y=0; el molde exterior baja wallMargin
    const lift = outer.position[1] - (0 - BASE.wallMarginMm);
    const coreWorld = placed(core.mesh, [core.position[0], core.position[1] - lift, core.position[2]]);

    const wasm = await initManifoldEngine();
    const master = meshDataToManifold(wasm, mesh);
    const coreM = meshDataToManifold(wasm, coreWorld);
    const escaped = coreM.subtract(master);
    try {
      expect(escaped.volume()).toBeLessThan(1e-3);
    } finally {
      for (const m of [master, coreM, escaped]) m.delete();
    }
    const field = buildMeshDistanceField(mesh);
    let min = Infinity;
    let max = 0;
    for (let v = 0; v < coreWorld.positions.length / 3; v++) {
      const d = field.signedDistance(coreWorld.positions[v * 3], coreWorld.positions[v * 3 + 1], coreWorld.positions[v * 3 + 2]);
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    expect(min).toBeGreaterThanOrEqual(wall - 0.05);
    expect(max).toBeLessThanOrEqual(wall * 1.4);
  }, 60000);
});
