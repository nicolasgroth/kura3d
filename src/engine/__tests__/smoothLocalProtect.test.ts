/**
 * @file src/engine/__tests__/smoothLocalProtect.test.ts
 * @description Protección local de «Suavizar malla»: cuando unos pocos triángulos se invierten o se cortan, se fijan solo
 * esos vértices y sus anillos y el resto se suaviza con la intensidad pedida (antes la intensidad bajaba para toda la
 * pieza). También: medidas del informe y ángulo de arista viva en coordenadas de mundo (escala del objeto).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { initManifoldEngine } from '../manifoldKernel';
import { isClosedMesh } from '../meshClosure';
import { signedVolume, smoothMesh } from '../smooth';
import { detectSmoothDamage } from '../smooth/smoothDamage';
import { buildSmoothGraph } from '../smooth/smoothGraph';
import { resolveSmoothOptions } from '../smooth/smoothOptions';
import { radialStdDev, thinFold, uvSphere, withRadialNoise } from './smoothFixtures';

/** Une dos mallas en una sola (componentes separados). */
function joinMeshes(a: MeshData, b: MeshData): MeshData {
  const n = a.positions.length / 3;
  const positions = new Float32Array(a.positions.length + b.positions.length);
  positions.set(a.positions);
  positions.set(b.positions, a.positions.length);
  const indices = new Uint32Array(a.indices.length + b.indices.length);
  indices.set(a.indices);
  for (let i = 0; i < b.indices.length; i++) indices[a.indices.length + i] = b.indices[i] + n;
  return { positions, indices };
}

/** Desplaza una malla en x. */
function shifted(m: MeshData, dx: number): MeshData {
  const p = m.positions.slice();
  for (let i = 0; i < p.length; i += 3) p[i] += dx;
  return { ...m, positions: p };
}

/** Sub-malla con los vértices `[from, to)` (los índices de esos vértices, rebajados). */
function part(m: MeshData, from: number, to: number): MeshData {
  return { positions: m.positions.slice(from * 3, to * 3), indices: m.indices };
}

/** Tejado abierto: placa n×n en xz con perfil en V `y = slope·|x − size/2|` (cumbrera en x = size/2). */
function tentGrid(n: number, size: number, slope: number): MeshData {
  const pos: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = (i / n) * size;
    pos.push(x, slope * Math.abs(x - size / 2), (j / n) * size);
  }
  const idx: number[] = [];
  const v = (i: number, j: number) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) idx.push(v(i, j), v(i, j + 1), v(i + 1, j), v(i + 1, j), v(i, j + 1), v(i + 1, j + 1));
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

const RAW_FOLD = { preserveSharpEdges: false, iterations: 60 } as const;

describe('protección local ante daño', () => {
  beforeAll(async () => { await initManifoldEngine(); });

  it('un pliegue que se invierte ya no frena el suavizado de una superficie ruidosa en la misma malla', async () => {
    const sphere = withRadialNoise(uvSphere(20, 96, 48), 0.15);
    const fold = shifted(await thinFold(), 40);
    const mesh = joinMeshes(sphere, fold);
    const sphereVerts = sphere.positions.length / 3;
    const res = smoothMesh(mesh, RAW_FOLD);

    // Antes: la fuerza bajaba a 0,25 para toda la pieza. Ahora la esfera recibe la fuerza pedida.
    expect(res.report.appliedStrength).toBe(1);
    expect(res.report.damageProtectedVertices).toBeGreaterThan(0);
    expect(res.report.strengthCoverage).toBeGreaterThanOrEqual(0.95);
    expect(res.report.attempts[0].invertedTriangles + res.report.attempts[0].newIntersections).toBeGreaterThan(0);

    // La esfera queda como si se suavizara sola con la fuerza pedida (componentes independientes). Solo difieren los
    // vértices recortados a x máxima de la caja: la caja de la malla unida llega hasta el pliegue.
    const alone = smoothMesh(sphere, RAW_FOLD).mesh;
    const joined = part(res.mesh, 0, sphereVerts).positions;
    let maxX = -Infinity;
    for (let v = 0; v < sphereVerts; v++) maxX = Math.max(maxX, sphere.positions[v * 3]);
    let compared = 0;
    for (let v = 0; v < sphereVerts; v++) {
      if (alone.positions[v * 3] >= maxX) continue;
      compared++;
      for (let k = 0; k < 3; k++) expect(joined[v * 3 + k]).toBe(alone.positions[v * 3 + k]);
    }
    expect(compared).toBeGreaterThan(sphereVerts * 0.95);
    expect(radialStdDev(alone)).toBeLessThan(radialStdDev(sphere) * 0.5);

    // Sin daño nuevo y cerrada.
    const graph = buildSmoothGraph(mesh, resolveSmoothOptions(RAW_FOLD));
    const all = new Uint8Array(mesh.positions.length / 3).fill(1);
    expect(detectSmoothDamage(mesh.positions, res.mesh.positions, mesh.indices, graph.weld, all)).toEqual({ invertedTriangles: 0, newIntersections: 0 });
    expect(isClosedMesh(res.mesh)).toBe(true);
    expect(res.warnings.map((w) => w.code)).not.toContain('SMOOTH_STRENGTH_REDUCED');
  });

  it('en el pliegue solo se protege una parte: el resto del pliegue también se suaviza', async () => {
    const fold = await thinFold();
    const res = smoothMesh(fold, RAW_FOLD);
    expect(res.report.appliedStrength).toBe(1);
    expect(res.report.damageProtectedVertices).toBeGreaterThan(0);
    expect(res.report.damageProtectedVertices).toBeLessThan(res.report.movableVertices * 0.5);
    expect(res.report.movedVertices).toBeGreaterThan(res.report.damageProtectedVertices);
  });

  it('si el daño no es local (ruido fuerte en toda la pieza), recurre a bajar la intensidad global y avisa', () => {
    // Medido: 389 invertidos; tras proteger 1303 vértices (> 20 % de los movibles) quedan 134 → fuerza 0,5 → 0,25.
    const noisy = withRadialNoise(uvSphere(20, 96, 48), 1.5);
    const res = smoothMesh(noisy, RAW_FOLD);
    expect(res.report.appliedStrength).toBeLessThan(1);
    expect(res.warnings).toContainEqual({ code: 'SMOOTH_STRENGTH_REDUCED', params: { requested: 1, applied: res.report.appliedStrength } });
    const graph = buildSmoothGraph(noisy, resolveSmoothOptions(RAW_FOLD));
    const all = new Uint8Array(noisy.positions.length / 3).fill(1);
    expect(detectSmoothDamage(noisy.positions, res.mesh.positions, noisy.indices, graph.weld, all)).toEqual({ invertedTriangles: 0, newIntersections: 0 });
  });

  it('sin daño, nada queda protegido y la cobertura es total', () => {
    const res = smoothMesh(withRadialNoise(uvSphere(20, 48, 24), 0.1));
    expect(res.report.damageProtectedVertices).toBe(0);
    expect(res.report.strengthCoverage).toBe(1);
    expect(res.report.attempts).toHaveLength(1);
  });
});

describe('informe y aristas vivas en coordenadas de mundo', () => {
  it('con escala [1, 2, 1] el volumen del informe es el de mundo (doble del local) y el % no cambia', () => {
    const mesh = withRadialNoise(uvSphere(10, 48, 24), 0.05);
    // Sin aristas vivas: con escala no uniforme el ángulo cambia y fijaría otros vértices (lo prueba la cumbrera).
    const local = smoothMesh(mesh, { preserveSharpEdges: false });
    const world = smoothMesh(mesh, { preserveSharpEdges: false, scale: [1, 2, 1] });
    const v0 = signedVolume(mesh.positions, mesh.indices);
    expect(local.report.volumeBeforeMm3).toBeCloseTo(v0, 6);
    expect(world.report.volumeBeforeMm3).toBeCloseTo(2 * v0, 6);
    expect(world.report.volumeAfterMm3).toBeCloseTo(2 * local.report.volumeAfterMm3, 6);
    expect(world.report.volumeChangePct).toBeCloseTo(local.report.volumeChangePct, 9);
    expect(world.report.maxDisplacementMm).toBeGreaterThanOrEqual(local.report.maxDisplacementMm);
  });

  it('el desplazamiento máximo se mide en mundo (escala uniforme ×3 → ×3)', () => {
    const mesh = withRadialNoise(uvSphere(10, 48, 24), 0.05);
    const local = smoothMesh(mesh);
    const world = smoothMesh(mesh, { scale: [3, 3, 3] });
    expect(world.report.maxDisplacementMm).toBeCloseTo(3 * local.report.maxDisplacementMm, 5);
    expect(world.mesh.positions).toEqual(local.mesh.positions); // la malla se suaviza igual (en local)
  });

  it('una cumbrera suave en local (17°) que en mundo es viva (112°, escala y ×10) queda fija', () => {
    const tent = tentGrid(20, 20, 0.15);
    const ridge = [...Array(tent.positions.length / 3).keys()].filter((v) => Math.abs(tent.positions[v * 3] - 10) < 1e-5 &&
      tent.positions[v * 3 + 2] > 0.5 && tent.positions[v * 3 + 2] < 19.5);
    const moved = (out: MeshData, v: number) => out.positions[v * 3 + 1] !== tent.positions[v * 3 + 1];
    const local = smoothMesh(tent).mesh;
    expect(ridge.some((v) => moved(local, v))).toBe(true);
    const world = smoothMesh(tent, { scale: [1, 10, 1] }).mesh;
    for (const v of ridge) expect(moved(world, v)).toBe(false);
  });
});
