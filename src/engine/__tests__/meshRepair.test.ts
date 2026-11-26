/**
 * @file src/engine/__tests__/meshRepair.test.ts
 * @description Diagnóstico y reparación de mallas con defectos sintéticos: esfera sin casquete, cubo
 * sin una cara, dos agujeros, normales invertidas, cara duplicada, arista con 4 caras y astilla. La
 * malla reparada debe ser cerrada, aceptada por Manifold y conservar volumen y dimensiones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { isEngineError } from '../engineErrors';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { diagnoseMesh, isMeshClosed, manifoldAccepts, repairMeshData, repairMeshVerified } from '../repair';

const mesh = (positions: number[], indices: number[]): MeshData => ({
  positions: new Float32Array(positions),
  indices: new Uint32Array(indices),
  normals: new Float32Array(positions.length),
});

/** Cubo indexado de lado `s` con origen en `o`, normales hacia fuera. */
function cube(s = 10, o: number[] = [0, 0, 0]): MeshData {
  const p: number[] = [];
  for (let i = 0; i < 8; i++) p.push(o[0] + (i & 1 ? s : 0), o[1] + (i & 2 ? s : 0), o[2] + (i & 4 ? s : 0));
  // Caras: -z, +z, -y, +y, -x, +x (antihorario visto desde fuera).
  const idx = [0, 2, 3, 0, 3, 1, 4, 5, 7, 4, 7, 6, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5];
  return mesh(p, idx);
}

const dropTriangles = (m: MeshData, drop: (t: number) => boolean): MeshData => {
  const idx: number[] = [];
  for (let t = 0; t < m.indices.length / 3; t++) if (!drop(t)) idx.push(m.indices[t * 3], m.indices[t * 3 + 1], m.indices[t * 3 + 2]);
  return mesh(Array.from(m.positions), idx);
};

function volume(m: MeshData): number {
  const p = m.positions;
  let v = 0;
  for (let i = 0; i < m.indices.length; i += 3) {
    const a = m.indices[i] * 3, b = m.indices[i + 1] * 3, c = m.indices[i + 2] * 3;
    v += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return v;
}

function size(m: MeshData): number[] {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) {
    mn[k] = Math.min(mn[k], m.positions[i + k]);
    mx[k] = Math.max(mx[k], m.positions[i + k]);
  }
  return mx.map((x, k) => x - mn[k]);
}

async function expectSolid(m: MeshData) {
  expect(isMeshClosed(m.positions, m.indices)).toBe(true);
  expect(diagnoseMesh(m).clean).toBe(true);
  expect(await manifoldAccepts(m)).toBe(true);
}

let sphere: MeshData;

describe('Reparar malla', () => {
  beforeAll(async () => {
    const wasm = await initManifoldEngine();
    const s = wasm.Manifold.sphere(10, 48);
    sphere = manifoldToMeshData(s);
    s.delete();
  });

  it('un sólido limpio no cambia', async () => {
    const c = cube();
    expect(diagnoseMesh(c).clean).toBe(true);
    const r = repairMeshData(c);
    expect(r.report.changed).toBe(false);
    expect(r.mesh).toBe(c);
  });

  it('cubo sin una cara: un agujero de 10 mm diagnosticado y cerrado con volumen 1000', async () => {
    const open = dropTriangles(cube(), (t) => t === 2 || t === 3);
    const d = diagnoseMesh(open);
    expect(d.closed).toBe(false);
    expect(d.holeCount).toBe(1);
    expect(d.boundaryEdges).toBe(4);
    expect(d.holes[0].sizeMm).toBeCloseTo(10, 5);
    expect(d.holes[0].center[2]).toBeCloseTo(10, 5);
    expect(d.openEdgeSegments.length).toBe(4 * 6);
    const { mesh: fixed, report } = await repairMeshVerified(open);
    expect(report.filledHoles).toBe(1);
    await expectSolid(fixed);
    expect(volume(fixed)).toBeCloseTo(1000, 3);
    expect(size(fixed)).toEqual([10, 10, 10]);
  });

  it('esfera sin casquete (bucle no plano de 48 vértices): cerrada y con volumen cercano', async () => {
    const p = sphere.positions;
    const open = dropTriangles(sphere, (t) => [0, 1, 2].every((c) => p[sphere.indices[t * 3 + c] * 3 + 1] > 8));
    const d = diagnoseMesh(open);
    expect(d.holeCount).toBe(1);
    const { mesh: fixed } = await repairMeshVerified(open);
    await expectSolid(fixed);
    const full = volume(sphere);
    // El casquete quitado (h = 2 mm) pesa ~2,3 % del volumen; la tapa recupera casi todo.
    expect(volume(fixed)).toBeGreaterThan(full * 0.97);
    expect(volume(fixed)).toBeLessThanOrEqual(full + 1e-3);
  });

  it('dos agujeros: ambos se cierran; con maxHoleMm chico quedan y la verificación falla tipada', async () => {
    const open = dropTriangles(cube(), (t) => t <= 3);
    expect(diagnoseMesh(open).holeCount).toBe(2);
    const { mesh: fixed, report } = await repairMeshVerified(open);
    expect(report.filledHoles).toBe(2);
    await expectSolid(fixed);
    expect(volume(fixed)).toBeCloseTo(1000, 3);
    await expect(repairMeshVerified(open, { maxHoleMm: 5 })).rejects.toSatisfy(
      (e: unknown) => isEngineError(e) && e.code === 'MESH_REPAIR_FAILED' && e.params.holes === 2,
    );
  });

  it('normales invertidas (todo el sólido y una cara suelta) se orientan hacia fuera', async () => {
    const c = cube();
    const inv = mesh(Array.from(c.positions), Array.from(c.indices).map((_, i, a) => a[i - (i % 3) + [0, 2, 1][i % 3]]));
    expect(volume(inv)).toBeCloseTo(-1000, 3);
    const d = diagnoseMesh(inv);
    expect(d.closed).toBe(true);
    expect(d.invertedShells).toBe(1);
    const fixedAll = (await repairMeshVerified(inv)).mesh;
    expect(volume(fixedAll)).toBeCloseTo(1000, 3);
    const one = cube();
    const i0 = one.indices[1];
    one.indices[1] = one.indices[2];
    one.indices[2] = i0;
    expect(diagnoseMesh(one).misorientedEdges).toBe(3);
    const r = await repairMeshVerified(one);
    expect(r.report.flippedFaces).toBe(1);
    await expectSolid(r.mesh);
    expect(volume(r.mesh)).toBeCloseTo(1000, 3);
  });

  it('una cavidad interior conserva sus normales hacia dentro', async () => {
    const outer = cube(20);
    const inner = cube(10, [5, 5, 5]);
    const innerFlipped = Array.from(inner.indices).map((_, i, a) => a[i - (i % 3) + [0, 2, 1][i % 3]] + 8);
    const hollow = mesh([...outer.positions, ...inner.positions], [...outer.indices, ...innerFlipped]);
    expect(diagnoseMesh(hollow).invertedShells).toBe(0);
    expect(repairMeshData(hollow).report.changed).toBe(false);
  });

  it('cara duplicada y degenerada se quitan', async () => {
    const c = cube();
    const dup = mesh(Array.from(c.positions), [...c.indices, c.indices[0], c.indices[1], c.indices[2], 0, 0, 1]);
    const d = diagnoseMesh(dup);
    expect(d.duplicateFaces).toBe(1);
    expect(d.degenerateFaces).toBe(1);
    expect(d.closed).toBe(false);
    const r = await repairMeshVerified(dup);
    expect(r.report.removedDuplicate).toBe(1);
    expect(r.report.removedDegenerate).toBe(1);
    await expectSolid(r.mesh);
    expect(r.mesh.indices.length).toBe(36);
  });

  it('arista con 4 caras (dos cubos que se tocan por una arista) se separa en dos sólidos', async () => {
    const a = cube(10);
    const b = cube(10, [10, 10, 0]);
    // Comparten la arista x=10, y=10 (vértices 3 y 7 de a = vértices 0 y 4 de b).
    const pos = [...a.positions];
    const map: number[] = [];
    for (let i = 0; i < 8; i++) {
      const v = [b.positions[i * 3], b.positions[i * 3 + 1], b.positions[i * 3 + 2]];
      const same = [3, 7].find((j) => pos[j * 3] === v[0] && pos[j * 3 + 1] === v[1] && pos[j * 3 + 2] === v[2]);
      if (same !== undefined) map.push(same);
      else {
        map.push(pos.length / 3);
        pos.push(...v);
      }
    }
    const nm = mesh(pos, [...a.indices, ...Array.from(b.indices, (i) => map[i])]);
    expect(diagnoseMesh(nm).nonManifoldEdges).toBe(1);
    expect(isMeshClosed(nm.positions, nm.indices)).toBe(false);
    const r = await repairMeshVerified(nm);
    expect(r.report.splitVertices).toBe(2);
    await expectSolid(r.mesh);
    // Las copias se separan 2 µm: el volumen cambia menos de 0,03 %.
    expect(Math.abs(volume(r.mesh) - 2000)).toBeLessThan(0.5);
  });

  it('astilla diminuta suelta y casco de volumen cero se descartan', async () => {
    const c = cube(10);
    const sliver = cube(0.05, [20, 0, 0]);
    const flat = mesh([30, 0, 0, 31, 0, 0, 30, 1, 0, 31, 1, 0], [0, 1, 2, 1, 3, 2, 0, 2, 1, 1, 2, 3]);
    const pos = [...c.positions, ...sliver.positions, ...flat.positions];
    const idx = [...c.indices, ...Array.from(sliver.indices, (i) => i + 8), ...Array.from(flat.indices, (i) => i + 16)];
    const m = mesh(pos, idx);
    const d = diagnoseMesh(m);
    expect(d.tinyShells).toBeGreaterThanOrEqual(1);
    const r = await repairMeshVerified(m);
    expect(r.report.removedShells + r.report.removedDuplicate).toBeGreaterThanOrEqual(2);
    expect(volume(r.mesh)).toBeCloseTo(1000, 3);
    await expectSolid(r.mesh);
  });

  it('triángulos sin soldar (sopa STL) con huecos menores que la tolerancia se sueldan', async () => {
    const c = cube();
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < c.indices.length; i++) {
      const v = c.indices[i];
      pos.push(c.positions[v * 3] + (i % 2) * 2e-4, c.positions[v * 3 + 1], c.positions[v * 3 + 2]);
      idx.push(i);
    }
    const soup = mesh(pos, idx);
    expect(isMeshClosed(soup.positions, soup.indices)).toBe(false);
    const r = await repairMeshVerified(soup);
    expect(r.report.changed).toBe(true);
    await expectSolid(r.mesh);
  });
});
