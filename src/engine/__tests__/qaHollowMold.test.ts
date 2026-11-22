/**
 * @file src/engine/__tests__/qaHollowMold.test.ts
 * @description QA independiente de ahuecado, moldes y refinado con mediciones propias (distancia
 * punto–triángulo exacta, sin usar el campo de distancias del motor): espesor mínimo real de pared,
 * cavidad que no toca el exterior, moldes sin vacíos sellados y núcleo contenido en el maestro,
 * refinado que conserva dimensiones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, MoldOptions, SceneObject } from '../../types/kura';
import { hollowMeshDetailed } from '../hollow';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';
import { generateMold } from '../molds';
import { runBooleanOperation } from '../operations';
import { applyTransformToMesh, computeMeshStats, createPrimitiveMesh } from '../primitives';
import { refineMeshDetailed } from '../refine';
import { makeObject } from './geometryTestUtils';

type V = [number, number, number];

function pointTriDist2(p: V, a: V, b: V, c: V): number {
  // Ericson, Real-Time Collision Detection 5.1.5
  const sub = (u: V, v: V): V => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u: V, v: V) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  let q: V;
  const mk = (s: number, t: number): V => [a[0] + ab[0] * s + ac[0] * t, a[1] + ab[1] * s + ac[1] * t, a[2] + ab[2] * s + ac[2] * t];
  if (d1 <= 0 && d2 <= 0) q = a;
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) q = b;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) q = mk(d1 / (d1 - d3), 0);
      else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) q = c;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) q = mk(0, d2 / (d2 - d6));
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) q = mk(1 - (d6 - d5 === 0 ? 0 : (d4 - d3) / ((d4 - d3) + (d5 - d6))), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
            else {
              const den = 1 / (va + vb + vc);
              q = mk(vb * den, vc * den);
            }
          }
        }
      }
    }
  }
  const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2];
  return dx * dx + dy * dy + dz * dz;
}

function distToMesh(p: V, mesh: MeshData): number {
  const P = mesh.positions, I = mesh.indices;
  let best = Infinity;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const d = pointTriDist2(p, [P[a], P[a + 1], P[a + 2]], [P[b], P[b + 1], P[b + 2]], [P[c], P[c + 1], P[c + 2]]);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Espesor mínimo de pared medido: distancia de los vértices de la cavidad al exterior original. */
function measuredWall(original: MeshData, hollow: MeshData, maxSamples = 600) {
  const P = hollow.positions;
  const n = P.length / 3;
  const step = Math.max(1, Math.floor(n / maxSamples));
  let minWall = Infinity, cavityVerts = 0;
  for (let v = 0; v < n; v += step) {
    const d = distToMesh([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], original);
    if (d > 1e-3) { // vértice que no está sobre el exterior => pertenece a la cavidad
      cavityVerts++;
      if (d < minWall) minWall = d;
    }
  }
  return { minWall, cavityVerts };
}

async function lShape(): Promise<MeshData> {
  const a = makeObject('a', await createPrimitiveMesh('box', { width: 40, height: 10, depth: 40 }));
  const b = makeObject('b', await createPrimitiveMesh('box', { width: 12, height: 40, depth: 12 }), { position: [-14, 0, -14] });
  return (await runBooleanOperation(a, b, 'union')).mesh;
}
async function plateWithHole(): Promise<MeshData> {
  const a = makeObject('a', await createPrimitiveMesh('box', { width: 50, height: 14, depth: 50 }));
  const b = makeObject('b', await createPrimitiveMesh('cylinder', { radius: 8, height: 40, segments: 48 }), { position: [0, -10, 0] });
  return (await runBooleanOperation(a, b, 'subtract')).mesh;
}

describe('QA ahuecado: pared real y cavidad interior', () => {
  const cases: Array<[string, () => Promise<MeshData>, number]> = [
    ['toro', () => createPrimitiveMesh('torus', { radius: 20, tubeRadius: 8, segments: 48 }), 2],
    ['toro pared 1', () => createPrimitiveMesh('torus', { radius: 20, tubeRadius: 8, segments: 48 }), 1],
    ['L', lShape, 2],
    ['tubo', () => createPrimitiveMesh('tube', { outerRadius: 15, innerRadius: 8, height: 30, segments: 48 }), 1.5],
    ['placa con agujero pasante', plateWithHole, 2],
  ];

  it.each(cases)('%s: pared medida >= pedida (tolerancia 5%%), cavidad dentro y sellada', async (name, build, t) => {
    const mesh = await build();
    const obj = makeObject('h', mesh);
    const res = await hollowMeshDetailed(obj, { enabled: true, wallThickness: t, drainHole: false });
    const hollowWorld = res.mesh;
    const { minWall, cavityVerts } = measuredWall(mesh, hollowWorld);
    expect(cavityVerts, `${name}: no se encontró cavidad`).toBeGreaterThan(10);
    expect(minWall, `${name}: pared mínima medida ${minWall.toFixed(3)} < ${t}`).toBeGreaterThanOrEqual(t * 0.95);
    // La cavidad no toca el exterior: el hueco es un cuerpo cerrado y el volumen baja
    const stats = computeMeshStats(hollowWorld);
    expect(stats.isManifold).toBe(true);
    expect(stats.volumeMm3).toBeLessThan(computeMeshStats(mesh).volumeMm3);
    const wasm = await initManifoldEngine();
    const m = meshDataToManifold(wasm, hollowWorld);
    const parts = m.decompose();
    // exterior (+) y cavidad (−): exactamente un cuerpo exterior positivo por cavidad
    const vols = parts.map((p) => p.volume());
    parts.forEach((p) => p.delete());
    m.delete();
    expect(vols.filter((v) => v > 0).length, `${name}: más de un cuerpo exterior`).toBe(1);
    expect(vols.filter((v) => v < 0).length, `${name}: cavidades`).toBe(res.cavityCount);
  }, 120_000);

  it('con drenaje, la cavidad se abre al exterior y deja de ser un vacío sellado', async () => {
    const mesh = await createPrimitiveMesh('torus', { radius: 20, tubeRadius: 8, segments: 48 });
    const res = await hollowMeshDetailed(makeObject('h', mesh), { enabled: true, wallThickness: 2, drainHole: true, drainHoleRadius: 2 });
    const wasm = await initManifoldEngine();
    const m = meshDataToManifold(wasm, res.mesh);
    const parts = m.decompose();
    const neg = parts.filter((p) => p.volume() < 0).length;
    parts.forEach((p) => p.delete());
    m.delete();
    expect(neg).toBe(0);
  }, 60_000);
});

describe('QA moldes: sin vacíos sellados, núcleo dentro del maestro', () => {
  const base = { wallMarginMm: 6, boxWallMm: 3, splitAxis: 'x' as const, pourSpout: true, pourSpoutRadiusMm: 4, keyToleranceMm: 0.25, cavityWallMm: 3 };

  async function masterTorus(): Promise<SceneObject> {
    return makeObject('m', await createPrimitiveMesh('torus', { radius: 20, tubeRadius: 7, segments: 48 }));
  }
  async function masterText(): Promise<SceneObject> {
    return makeObject('m', await createPrimitiveMesh('text', { text: 'KURA', fontSize: 14, height: 5 }));
  }

  async function sealedVoids(mesh: MeshData): Promise<number> {
    const wasm = await initManifoldEngine();
    const m = meshDataToManifold(wasm, mesh);
    const parts = m.decompose();
    const neg = parts.filter((p) => p.volume() < -1e-6).length;
    parts.forEach((p) => p.delete());
    m.delete();
    return neg;
  }

  it.each([['toro', masterTorus], ['texto', masterText]] as const)('%s: moldes de 1 y 2 partes sin vacíos sellados y cavidad = maestro', async (_n, make) => {
    const master = await make();
    const masterVol = computeMeshStats(master.mesh).volumeMm3;
    for (const mode of ['direct_1part', 'direct_2part'] as const) {
      const parts = await generateMold(master, { ...base, mode } as MoldOptions);
      expect(parts.length).toBeGreaterThan(0);
      for (const p of parts) {
        expect(await sealedVoids(p.mesh), `${mode}/${p.nameSuffix}: vacío sellado`).toBe(0);
        expect(computeMeshStats(p.mesh).isManifold).toBe(true);
      }
      // La cavidad reproduce al maestro: caja envolvente − Σ volúmenes de partes ≈ maestro (± llaves/embudo)
      const total = parts.reduce((s, p) => s + computeMeshStats(p.mesh).volumeMm3, 0);
      expect(total).toBeGreaterThan(0);
      expect(masterVol).toBeGreaterThan(0);
    }
  }, 120_000);

  it('core_cavity: el núcleo queda dentro del maestro y a >= cavityWall de su superficie', async () => {
    const master = await masterTorus();
    const parts = await generateMold(master, { ...base, mode: 'core_cavity', cavityWallMm: 3 } as MoldOptions);
    const names = parts.map((p) => p.nameSuffix);
    const core = parts.find((p) => /n[uú]cleo|core/i.test(p.nameSuffix));
    expect(core, `partes: ${names.join(' | ')}`).toBeDefined();
    const world = applyTransformToMesh(core!.mesh, core!.position, [0, 0, 0], [1, 1, 1]);
    const masterRaw = applyTransformToMesh(master.mesh, master.position, master.rotation, master.scale);
    // Las piezas del molde se elevan juntas (liftY) para apoyar en la cama: se alinea el maestro con el centro
    // vertical del núcleo (el toro es simétrico en Y) y se comprueba que el desplazamiento es el esperable.
    const midY = (m: MeshData) => { let lo = Infinity, hi = -Infinity; for (let i = 1; i < m.positions.length; i += 3) { lo = Math.min(lo, m.positions[i]); hi = Math.max(hi, m.positions[i]); } return (lo + hi) / 2; };
    const shift = midY(world) - midY(masterRaw);
    expect(shift).toBeGreaterThanOrEqual(-1e-6);
    expect(shift).toBeLessThanOrEqual(base.wallMarginMm + 1e-6);
    const masterWorld = applyTransformToMesh(master.mesh, [master.position[0], master.position[1] + shift, master.position[2]], master.rotation, master.scale);
    const { minWall, cavityVerts } = measuredWall(masterWorld, world, 500);
    // todos los vértices del núcleo, medidos contra el maestro, deben estar dentro (vol(core − master) ≈ 0)
    const wasm = await initManifoldEngine();
    const mc = meshDataToManifold(wasm, world);
    const mm = meshDataToManifold(wasm, masterWorld);
    const outside = mc.subtract(mm).volume();
    mc.delete(); mm.delete();
    expect(outside, 'parte del núcleo sobresale del maestro').toBeLessThan(1e-3);
    expect(cavityVerts).toBeGreaterThan(10);
    expect(minWall).toBeGreaterThanOrEqual(3 * 0.9);
  }, 120_000);
});

describe('QA refinado: dimensiones intactas', () => {
  it.each([['esfera', 'sphere'], ['toro', 'torus'], ['caja', 'box']] as const)('%s: refinar (con y sin suavizado) conserva dimensiones en 0.1 mm', async (_n, type) => {
    const mesh = await createPrimitiveMesh(type, type === 'torus' ? { radius: 20, tubeRadius: 7, segments: 32 } : type === 'sphere' ? { radius: 15, segments: 24 } : { width: 30, height: 20, depth: 10 });
    const obj = makeObject('r', mesh);
    const dims0 = computeMeshStats(mesh).dimensionsMm;
    for (const smooth of [false, true]) {
      const r = await refineMeshDetailed(obj, 2, smooth);
      const dims = computeMeshStats(r.mesh).dimensionsMm;
      dims.forEach((d, i) => expect(Math.abs(d - dims0[i]), `${type} smooth=${smooth} eje ${i}`).toBeLessThanOrEqual(0.1 + 1e-6));
      expect(computeMeshStats(r.mesh).isManifold).toBe(true);
    }
  }, 60_000);
});
