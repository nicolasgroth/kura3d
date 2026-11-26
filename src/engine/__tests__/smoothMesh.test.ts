/**
 * @file src/engine/__tests__/smoothMesh.test.ts
 * @description «Suavizar malla» (Taubin λ/μ) con motor real: la malla sigue cerrada y Manifold la
 * acepta, no cambia la cantidad de vértices ni triángulos, el volumen cambia poco, la caja no crece,
 * el ruido baja, las aristas vivas y los bordes protegidos no se mueven, la zona tiene transición
 * sin escalón y los parámetros fuera de rango se rechazan con `INVALID_PARAMETER`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { isEngineError } from '../engineErrors';
import { initManifoldEngine } from '../manifoldKernel';
import { isClosedMesh } from '../meshClosure';
import { manifoldAccepts } from '../repair';
import { signedVolume, smoothMesh, trianglesWithColor } from '../smooth';
import { bbox, noisyOpenGrid, radialStdDev, refinedBox, toSoup, uvSphere, withRadialNoise } from './smoothFixtures';

const volPct = (a: MeshData, b: MeshData) =>
  (100 * (signedVolume(b.positions, b.indices) - signedVolume(a.positions, a.indices))) / signedVolume(a.positions, a.indices);

function expectBoxNotGrown(before: MeshData, after: MeshData): void {
  const [min0, max0] = bbox(before), [min1, max1] = bbox(after);
  for (let k = 0; k < 3; k++) {
    expect(min1[k]).toBeGreaterThanOrEqual(min0[k]);
    expect(max1[k]).toBeLessThanOrEqual(max0[k]);
  }
}

function vertexMoved(a: MeshData, b: MeshData, v: number): boolean {
  return a.positions[v * 3] !== b.positions[v * 3] || a.positions[v * 3 + 1] !== b.positions[v * 3 + 1] ||
    a.positions[v * 3 + 2] !== b.positions[v * 3 + 2];
}

describe('smoothMesh: garantías', () => {
  beforeAll(async () => { await initManifoldEngine(); });

  it('esfera facetada: cerrada, misma topología, volumen < 1 %, caja no crece', async () => {
    const mesh = uvSphere(20, 48, 24);
    expect(signedVolume(mesh.positions, mesh.indices)).toBeGreaterThan(0);
    const { mesh: out, report, warnings } = smoothMesh(mesh);
    expect(out.positions.length).toBe(mesh.positions.length);
    expect(out.indices).toEqual(mesh.indices);
    expect(isClosedMesh(out)).toBe(true);
    expect(await manifoldAccepts(out)).toBe(true);
    const pct = volPct(mesh, out);
    expect(Math.abs(pct)).toBeLessThan(1);
    expect(report.volumeChangePct).toBeCloseTo(pct, 6);
    expect(report.appliedStrength).toBe(1);
    expect(warnings).toEqual([]);
    expectBoxNotGrown(mesh, out);
    console.info(`[suavizar] esfera facetada 48×24: volumen ${pct.toFixed(3)} %, desplazamiento máx ${report.maxDisplacementMm.toFixed(3)} mm`);
  });

  it('esfera con ruido (±8 % de la arista): el ruido radial baja a menos de la mitad y el volumen cambia < 2 %', () => {
    const noisy = withRadialNoise(uvSphere(20, 96, 48), 0.1);
    const { mesh: out } = smoothMesh(noisy);
    const before = radialStdDev(noisy), after = radialStdDev(out);
    expect(after).toBeLessThan(before * 0.5);
    const pct = volPct(noisy, out);
    expect(Math.abs(pct)).toBeLessThan(2);
    expect(isClosedMesh(out)).toBe(true);
    expectBoxNotGrown(noisy, out);
    console.info(`[suavizar] ruido radial ${before.toFixed(3)} → ${after.toFixed(3)} mm, volumen ${pct.toFixed(3)} %`);
  });

  it('Taubin no encoge como Laplace puro: con 50 iteraciones el volumen sigue < 2 %', () => {
    const noisy = withRadialNoise(uvSphere(20, 96, 48), 0.3);
    const { mesh: out } = smoothMesh(noisy, { iterations: 50 });
    expect(Math.abs(volPct(noisy, out))).toBeLessThan(2);
  });

  it('sopa de triángulos (costuras sin soldar): los duplicados se mueven juntos y sigue cerrada', () => {
    const soup = toSoup(withRadialNoise(uvSphere(20, 32, 16), 0.2));
    const { mesh: out } = smoothMesh(soup);
    expect(out.positions.length).toBe(soup.positions.length);
    expect(isClosedMesh(out)).toBe(true);
  });

  it('cubo refinado: las aristas vivas no se mueven y las caras siguen planas', async () => {
    const cube = await refinedBox(20, 2);
    const { mesh: out } = smoothMesh(cube);
    let onEdge = 0;
    for (let v = 0; v < cube.positions.length / 3; v++) {
      const c = [0, 1, 2].filter((k) => Math.abs(Math.abs(cube.positions[v * 3 + k]) - 10) < 1e-4).length;
      if (c >= 2) {
        onEdge++;
        expect(vertexMoved(cube, out, v)).toBe(false);
      }
      // Todo vértice que estaba en una cara sigue en ella.
      for (let k = 0; k < 3; k++) {
        if (Math.abs(Math.abs(cube.positions[v * 3 + k]) - 10) < 1e-4) {
          expect(Math.abs(out.positions[v * 3 + k])).toBeCloseTo(10, 4);
        }
      }
    }
    expect(onEdge).toBeGreaterThan(0);
    expect(Math.abs(volPct(cube, out))).toBeLessThan(1e-3);
  });

  it('sin proteger aristas, la esquina del cubo sí se mueve', async () => {
    const cube = await refinedBox(20, 2);
    const corner = [...Array(cube.positions.length / 3).keys()].find((v) =>
      [0, 1, 2].every((k) => Math.abs(Math.abs(cube.positions[v * 3 + k]) - 10) < 1e-4))!;
    const { mesh: out } = smoothMesh(cube, { preserveSharpEdges: false });
    expect(vertexMoved(cube, out, corner)).toBe(true);
    expectBoxNotGrown(cube, out);
  });

  it('borde abierto protegido: no se mueve; sin protección, sí', () => {
    const grid = noisyOpenGrid(30, 30, 0.2);
    const boundary = [...Array(grid.positions.length / 3).keys()].filter((v) => {
      const x = grid.positions[v * 3], z = grid.positions[v * 3 + 2];
      return x === 0 || z === 0 || Math.abs(x - 30) < 1e-5 || Math.abs(z - 30) < 1e-5;
    });
    const kept = smoothMesh(grid).mesh;
    for (const v of boundary) expect(vertexMoved(grid, kept, v)).toBe(false);
    const free = smoothMesh(grid, { preserveBoundary: false }).mesh;
    expect(boundary.some((v) => vertexMoved(grid, free, v))).toBe(true);
  });
});

describe('smoothMesh: zona con atenuación', () => {
  it('solo cambia la zona y su anillo; la atenuación evita el escalón', () => {
    const noisy = withRadialNoise(uvSphere(20, 96, 48), 0.3);
    const tris: number[] = [];
    for (let t = 0; t < noisy.indices.length / 3; t++) {
      const y = [0, 1, 2].reduce((s, k) => s + noisy.positions[noisy.indices[t * 3 + k] * 3 + 1], 0) / 3;
      if (y > 10) tris.push(t);
    }
    const { mesh: out, report } = smoothMesh(noisy, { zone: { triangles: tris, falloffRings: 3 } });
    expect(report.movedVertices).toBeGreaterThan(0);
    // Más abajo que la zona + 3 anillos (~3·1,3 mm) nada se mueve.
    const disp = (v: number) => Math.hypot(...[0, 1, 2].map((k) => out.positions[v * 3 + k] - noisy.positions[v * 3 + k]));
    let inside = 0, ring = 0, insideN = 0, ringN = 0;
    for (let v = 0; v < noisy.positions.length / 3; v++) {
      const y = noisy.positions[v * 3 + 1];
      if (y < 4) expect(disp(v)).toBe(0);
      else if (y > 12) { inside += disp(v); insideN++; }
      else if (y < 9) { ring += disp(v); ringN++; }
    }
    // El desplazamiento medio en la franja de transición es menor que dentro de la zona.
    expect(ring / Math.max(1, ringN)).toBeLessThan(inside / insideN);
    expect(isClosedMesh(out)).toBe(true);
  });

  it('zona por color pintado y por vértices', () => {
    const mesh = withRadialNoise(uvSphere(20, 48, 24), 0.3);
    const faceColors = Array.from({ length: mesh.indices.length / 3 }, (_, t) => (t < 200 ? '#ff0000' : '#38bdf8'));
    const painted = { ...mesh, faceColors };
    const zone = trianglesWithColor(painted, '#FF0000');
    expect(zone.length).toBe(200);
    const res = smoothMesh(painted, { zone: { triangles: zone, falloffRings: 0 } });
    expect(res.mesh.faceColors).toEqual(faceColors);
    const touched = new Set<number>();
    for (const t of zone) for (let k = 0; k < 3; k++) touched.add(mesh.indices[t * 3 + k]);
    for (let v = 0; v < mesh.positions.length / 3; v++) {
      if (!touched.has(v)) expect(vertexMoved(mesh, res.mesh, v)).toBe(false);
    }
    const byVertex = smoothMesh(mesh, { zone: { vertices: [5, 6, 7], falloffRings: 0 } });
    expect(byVertex.report.movedVertices).toBeLessThanOrEqual(3);
  });

  it('zona vacía: avisa SMOOTH_NO_EFFECT y devuelve la malla igual', () => {
    const mesh = uvSphere(10, 16, 8);
    const res = smoothMesh(mesh, { zone: { triangles: [] } });
    expect(res.warnings.map((w) => w.code)).toEqual(['SMOOTH_NO_EFFECT']);
    expect(res.mesh.positions).toEqual(mesh.positions);
  });
});

describe('smoothMesh: validación', () => {
  const mesh = uvSphere(10, 16, 8);
  it.each([
    [{ iterations: 0 }],
    [{ iterations: 101 }],
    [{ iterations: 2.5 }],
    [{ strength: 0 }],
    [{ strength: 1.5 }],
    [{ sharpAngleDeg: 0 }],
    [{ zone: { triangles: [1], falloffRings: 11 } }],
  ])('rechaza %o con INVALID_PARAMETER', (opts) => {
    let err: unknown;
    try { smoothMesh(mesh, opts); } catch (e) { err = e; }
    expect(isEngineError(err) && err.code === 'INVALID_PARAMETER').toBe(true);
  });

  it('malla vacía → MESH_EMPTY', () => {
    let err: unknown;
    try { smoothMesh({ positions: new Float32Array(), indices: new Uint32Array() }); } catch (e) { err = e; }
    expect(isEngineError(err) && err.code === 'MESH_EMPTY').toBe(true);
  });
});
