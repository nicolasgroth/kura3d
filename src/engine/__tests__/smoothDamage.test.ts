/**
 * @file src/engine/__tests__/smoothDamage.test.ts
 * @description Detección de daño de «Suavizar malla»: triángulos invertidos y autointersecciones
 * nuevas (BVH), sin contar las que ya existían; en un pliegue de pared fina el suavizado agresivo
 * daña la malla y `smoothMesh` baja la fuerza y avisa, o falla con `SMOOTH_DAMAGE`; nunca entrega
 * una malla con daño nuevo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { isEngineError, localizeEngineError } from '../engineErrors';
import { initManifoldEngine } from '../manifoldKernel';
import { isClosedMesh } from '../meshClosure';
import { smoothMesh } from '../smooth';
import { detectSmoothDamage } from '../smooth/smoothDamage';
import { buildSmoothGraph } from '../smooth/smoothGraph';
import { resolveSmoothOptions } from '../smooth/smoothOptions';
import { taubinSmooth } from '../smooth/taubin';
import { refinedBox, thinFold } from './smoothFixtures';

const allMoved = (m: MeshData) => new Uint8Array(m.positions.length / 3).fill(1);
const identity = (m: MeshData) => Uint32Array.from({ length: m.positions.length / 3 }, (_, i) => i);

/** Dos cubos separados en una sola malla (B desplazado en x). */
async function twoBoxes(gap: number): Promise<MeshData> {
  const a = await refinedBox(10, 5);
  const n = a.positions.length / 3;
  const positions = new Float32Array(n * 6);
  positions.set(a.positions);
  for (let i = 0; i < n; i++) {
    positions[(n + i) * 3] = a.positions[i * 3] + 10 + gap;
    positions[(n + i) * 3 + 1] = a.positions[i * 3 + 1];
    positions[(n + i) * 3 + 2] = a.positions[i * 3 + 2];
  }
  const indices = new Uint32Array(a.indices.length * 2);
  indices.set(a.indices);
  for (let i = 0; i < a.indices.length; i++) indices[a.indices.length + i] = a.indices[i] + n;
  return { positions, indices };
}

/** Vértice de A con x máxima (cara que mira a B). */
function rightmostOfA(m: MeshData): number {
  let best = 0;
  for (let v = 0; v < m.positions.length / 6; v++) if (m.positions[v * 3] > m.positions[best * 3]) best = v;
  return best;
}

describe('detectSmoothDamage', () => {
  beforeAll(async () => { await initManifoldEngine(); });

  it('malla sin cambios: sin daño', async () => {
    const m = await twoBoxes(1);
    expect(detectSmoothDamage(m.positions, m.positions, m.indices, identity(m), allMoved(m))).toEqual({
      invertedTriangles: 0,
      newIntersections: 0,
    });
  });

  it('un vértice empujado dentro del otro cubo: autointersección nueva', async () => {
    const m = await twoBoxes(1);
    const after = m.positions.slice();
    after[rightmostOfA(m) * 3] += 3; // cruza la cara de B (a 1 mm)
    const d = detectSmoothDamage(m.positions, after, m.indices, identity(m), allMoved(m));
    expect(d.newIntersections).toBeGreaterThan(0);
  });

  it('una intersección que ya existía no cuenta como nueva', async () => {
    const m = await twoBoxes(-1); // B ya se mete 1 mm en A
    const after = m.positions.slice();
    after[rightmostOfA(m) * 3 + 1] += 1e-3;
    expect(detectSmoothDamage(m.positions, after, m.indices, identity(m), allMoved(m)).newIntersections).toBe(0);
  });

  it('un vértice cruzado al otro lado de su cara: triángulos invertidos', async () => {
    const m = await refinedBox(10, 5);
    const after = m.positions.slice();
    let v = 0; // vértice de la cara +x que no es arista
    for (let i = 0; i < m.positions.length / 3; i++) {
      const [x, y, z] = [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
      if (Math.abs(x - 5) < 1e-5 && Math.abs(y) < 4 && Math.abs(z) < 4) { v = i; break; }
    }
    after[v * 3 + 1] += 6; // lo arrastra por encima de sus vecinos
    expect(detectSmoothDamage(m.positions, after, m.indices, identity(m), allMoved(m)).invertedTriangles).toBeGreaterThan(0);
  });
});

describe('smoothMesh en pared fina', () => {
  it('el suavizado crudo agresivo daña el pliegue (la prueba tiene sentido)', async () => {
    const fold = await thinFold();
    const opts = resolveSmoothOptions({ preserveSharpEdges: false, iterations: 60 });
    const graph = buildSmoothGraph(fold, opts);
    const raw = taubinSmooth(fold.positions, graph, 1, 60);
    const d = detectSmoothDamage(fold.positions, raw, fold.indices, graph.weld, allMoved(fold));
    expect(d.invertedTriangles + d.newIntersections).toBeGreaterThan(0);
  });

  it('con onDamage "error" falla con SMOOTH_DAMAGE traducible', async () => {
    const fold = await thinFold();
    let err: unknown;
    try { smoothMesh(fold, { preserveSharpEdges: false, iterations: 60, onDamage: 'error' }); } catch (e) { err = e; }
    expect(isEngineError(err) && err.code === 'SMOOTH_DAMAGE').toBe(true);
    expect(localizeEngineError('en', err)).toMatch(/not applied/);
  });

  it('por defecto baja la fuerza a la mitad hasta quedar sano y avisa; no entrega daño nuevo', async () => {
    const fold = await thinFold();
    const res = smoothMesh(fold, { preserveSharpEdges: false, iterations: 60 });
    // Medido: fuerza 1 → 7 invertidos, 0,5 → 3, 0,25 → 0.
    expect(res.report.attempts.length).toBeGreaterThan(1);
    expect(res.report.attempts[0].invertedTriangles).toBeGreaterThan(0);
    expect(res.warnings).toContainEqual({
      code: 'SMOOTH_STRENGTH_REDUCED',
      params: { requested: 1, applied: res.report.appliedStrength },
    });
    expect(res.report.appliedStrength).toBeLessThan(1);
    const graph = buildSmoothGraph(fold, resolveSmoothOptions({ preserveSharpEdges: false }));
    const d = detectSmoothDamage(fold.positions, res.mesh.positions, fold.indices, graph.weld, allMoved(fold));
    expect(d).toEqual({ invertedTriangles: 0, newIntersections: 0 });
    expect(isClosedMesh(res.mesh)).toBe(true);
  });

  it('con aristas vivas protegidas (por defecto), el pliegue se suaviza sin daño', async () => {
    const fold = await thinFold();
    const res = smoothMesh(fold);
    expect(res.report.attempts).toHaveLength(1);
    expect(res.warnings.map((w) => w.code)).not.toContain('SMOOTH_STRENGTH_REDUCED');
  });
});
