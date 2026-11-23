/**
 * @file src/engine/__tests__/primitiveEdges.test.ts
 * @description Bordes redondeados y chaflanes exactos en Caja, Cilindro, Tubo y Prisma: malla cerrada,
 * medidas exteriores iguales a la pieza recta y volumen contra la fórmula analítica (exacta para el
 * polígono cuando la construcción es lineal; con tolerancia según segmentos cuando hay arcos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData, PrimitiveParams, PrimitiveType } from '../../types/kura';
import { edgeQuarterSegments } from '../edgedSolids';
import { initManifoldEngine } from '../manifoldKernel';
import { maxEdgeSize, resolveEdges } from '../primitiveEdges';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { isMeshClosed } from '../repair/meshTopology';

let quarter: (e: number) => number;

beforeAll(async () => {
  const wasm = await initManifoldEngine();
  quarter = (e) => edgeQuarterSegments(wasm, e);
});

async function build(type: PrimitiveType, params: PrimitiveParams) {
  const mesh = await createPrimitiveMesh(type, params);
  const stats = computeMeshStats(mesh);
  return { mesh, stats };
}

function expectClosed(mesh: MeshData) {
  expect(isMeshClosed(mesh.positions, mesh.indices)).toBe(true);
}

/** Medidas internas: [X, Y (altura), Z (fondo)]. */
function expectDims(dims: readonly number[], expected: readonly number[], tol = 1e-3) {
  expected.forEach((v, i) => expect(Math.abs(dims[i] - v)).toBeLessThan(tol));
}

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe('caja con bordes', () => {
  const W = 40, D = 30, H = 20;
  const base = { width: W, depth: D, height: H };

  it('sin campos nuevos (o sharp) da exactamente la misma malla que antes', async () => {
    const a = await createPrimitiveMesh('box', base);
    const b = await createPrimitiveMesh('box', { ...base, edgeStyle: 'sharp', edgeSize: 5, edgeScope: 'all' });
    expect(Array.from(b.positions)).toEqual(Array.from(a.positions));
    expect(Array.from(b.indices)).toEqual(Array.from(a.indices));
  });

  it('verticales redondeadas: medidas exactas y V = h·(ab − 4r² + (n/2)·r²·sin(2π/n)) ≈ h·(ab − (4−π)r²)', async () => {
    const r = 5;
    const { mesh, stats } = await build('box', { ...base, edgeStyle: 'round', edgeSize: r, edgeScope: 'vertical' });
    expectClosed(mesh);
    expect(stats.isManifold).toBe(true);
    expectDims(stats.dimensionsMm, [W, H, D]);
    const n = 4 * quarter(r);
    const polygonal = H * (W * D - 4 * r * r + (n / 2) * r * r * Math.sin((2 * Math.PI) / n));
    expect(rel(stats.volumeMm3, polygonal)).toBeLessThan(1e-4);
    const analytic = H * (W * D - (4 - Math.PI) * r * r);
    expect(rel(stats.volumeMm3, analytic)).toBeLessThan(0.002);
  });

  it('todas redondeadas: medidas exactas y volumen de la caja redondeada (Minkowski)', async () => {
    const r = 4;
    const { mesh, stats } = await build('box', { ...base, edgeStyle: 'round', edgeSize: r, edgeScope: 'all' });
    expectClosed(mesh);
    expectDims(stats.dimensionsMm, [W, H, D]);
    const [a, b, c] = [W - 2 * r, D - 2 * r, H - 2 * r];
    const analytic = a * b * c + 2 * r * (a * b + a * c + b * c) + Math.PI * r * r * (a + b + c) + (4 / 3) * Math.PI * r ** 3;
    // Polígono inscrito: nunca más que la fórmula continua, y muy cerca.
    expect(stats.volumeMm3).toBeLessThanOrEqual(analytic + 1e-3);
    expect(rel(stats.volumeMm3, analytic)).toBeLessThan(0.006);
  });

  it('solo superior redondeada: verticales rectas, medidas exactas y volumen por secciones', async () => {
    const r = 3;
    const { mesh, stats } = await build('box', { ...base, edgeStyle: 'round', edgeSize: r, edgeScope: 'top' });
    expectClosed(mesh);
    expectDims(stats.dimensionsMm, [W, H, D]);
    // ∫ (W − 2δ)(D − 2δ) dt con δ(t) = r − √(r² − t²) en la franja superior.
    const steps = 4000;
    let top = 0;
    for (let i = 0; i < steps; i++) {
      const t = ((i + 0.5) / steps) * r;
      const delta = r - Math.sqrt(r * r - t * t);
      top += (W - 2 * delta) * (D - 2 * delta) * (r / steps);
    }
    const analytic = W * D * (H - r) + top;
    expect(rel(stats.volumeMm3, analytic)).toBeLessThan(0.002);
    expect(stats.volumeMm3).toBeLessThan(W * D * H);
  });

  it('chaflán vertical exacto: V = h·(ab − 2c²)', async () => {
    const c = 3;
    const { mesh, stats } = await build('box', { ...base, edgeStyle: 'chamfer', edgeSize: c, edgeScope: 'vertical' });
    expectClosed(mesh);
    expectDims(stats.dimensionsMm, [W, H, D]);
    expect(rel(stats.volumeMm3, H * (W * D - 2 * c * c))).toBeLessThan(1e-5);
  });

  it('chaflán en todas las aristas exacto (casco de tres cajas)', async () => {
    const c = 2.5;
    const { mesh, stats } = await build('box', { ...base, edgeStyle: 'chamfer', edgeSize: c, edgeScope: 'all' });
    expectClosed(mesh);
    expectDims(stats.dimensionsMm, [W, H, D]);
    const [A, B, C] = [W / 2, D / 2, H / 2];
    const exact = (2 * C - 2 * c) * (4 * A * B - 2 * c * c) + 8 * A * B * c - 4 * (A + B) * c * c + (4 / 3) * c ** 3;
    expect(rel(stats.volumeMm3, exact)).toBeLessThan(1e-5);
  });

  it('chaflán solo superior exacto', async () => {
    const c = 2;
    const { mesh, stats } = await build('box', { ...base, edgeStyle: 'chamfer', edgeSize: c, edgeScope: 'top' });
    expectClosed(mesh);
    expectDims(stats.dimensionsMm, [W, H, D]);
    const exact = W * D * (H - c) + W * D * c - (W + D) * c * c + (4 / 3) * c ** 3;
    expect(rel(stats.volumeMm3, exact)).toBeLessThan(1e-5);
  });

  it('el tamaño se acota al tope (mitad de la menor medida afectada menos margen) y la malla sigue cerrada', async () => {
    const params: PrimitiveParams = { width: 10, depth: 30, height: 20, edgeStyle: 'round', edgeSize: 8, edgeScope: 'vertical' };
    const max = maxEdgeSize('box', params);
    expect(max).toBeLessThan(5);
    expect(max).toBeGreaterThan(4.98);
    const resolved = resolveEdges('box', params)!;
    expect(resolved.clamped).toBe(true);
    expect(resolved.size).toBeCloseTo(max, 9);
    expect(resolved.requested).toBe(8);
    const { mesh, stats } = await build('box', params);
    expectClosed(mesh);
    expectDims(stats.dimensionsMm, [10, 20, 30]);
    // En el tope exacto no se acota.
    expect(resolveEdges('box', { ...params, edgeSize: max })!.clamped).toBe(false);
    const atMax = await build('box', { ...params, edgeSize: max });
    expectClosed(atMax.mesh);
  });

  it('fuera del rango global o con alcance inválido es un error tipado', async () => {
    await expect(createPrimitiveMesh('box', { ...base, edgeStyle: 'round', edgeSize: 5000 })).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
    await expect(createPrimitiveMesh('box', { ...base, edgeStyle: 'round', edgeSize: -1 })).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
    await expect(createPrimitiveMesh('cylinder', { edgeStyle: 'round', edgeScope: 'vertical' })).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
    await expect(createPrimitiveMesh('box', { ...base, edgeStyle: 'wavy' as never })).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
    await expect(createPrimitiveMesh('sphere', { edgeStyle: 'round' })).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
  });

  it('tamaño 0 equivale a aristas rectas', async () => {
    const a = await build('box', base);
    const b = await build('box', { ...base, edgeStyle: 'round', edgeSize: 0 });
    expect(b.stats.volumeMm3).toBeCloseTo(a.stats.volumeMm3, 6);
  });
});

describe('cilindro y tubo con bordes (revolución de perfil)', () => {
  const R = 10, H = 20, SEG = 64;
  const k = (SEG / (2 * Math.PI)) * Math.sin((2 * Math.PI) / SEG);

  it('chaflán en ambos bordes exacto: V = k·[πR²h − 2·2π(R − c/3)·c²/2]', async () => {
    const c = 2;
    const { mesh, stats } = await build('cylinder', { radius: R, height: H, segments: SEG, edgeStyle: 'chamfer', edgeSize: c, edgeScope: 'all' });
    expectClosed(mesh);
    expectDims(stats.dimensionsMm, [2 * R, H], 1e-3);
    const exact = k * (Math.PI * R * R * H - 2 * 2 * Math.PI * (R - c / 3) * (c * c) / 2);
    expect(rel(stats.volumeMm3, exact)).toBeLessThan(1e-5);
  });

  it('borde superior redondeado: Pappus con tolerancia por segmentos del arco', async () => {
    const r = 3;
    const { mesh, stats } = await build('cylinder', { radius: R, height: H, segments: SEG, edgeStyle: 'round', edgeSize: r, edgeScope: 'top' });
    expectClosed(mesh);
    expectDims(stats.dimensionsMm, [2 * R, H], 1e-3);
    const area = r * r * (1 - Math.PI / 4);
    const xBar = (r * r * (R - r / 2) - (Math.PI * r * r / 4) * (R - r + (4 * r) / (3 * Math.PI))) / area;
    const exact = k * (Math.PI * R * R * H - 2 * Math.PI * xBar * area);
    expect(rel(stats.volumeMm3, exact)).toBeLessThan(0.002);
  });

  it('tubo redondeado arriba: cerrado, mismas medidas y menos volumen que el recto', async () => {
    const params = { outerRadius: 12, innerRadius: 8, height: 20, segments: 48 };
    const sharp = await build('tube', params);
    const { mesh, stats } = await build('tube', { ...params, edgeStyle: 'round', edgeSize: 1.5, edgeScope: 'top' });
    expectClosed(mesh);
    expectDims(stats.dimensionsMm, sharp.stats.dimensionsMm);
    expect(stats.volumeMm3).toBeLessThan(sharp.stats.volumeMm3);
    // Cuatro esquinas en anillo de radio ~10: pérdida ≈ 2·2π·10·(1 − π/4)·1,5².
    const loss = sharp.stats.volumeMm3 - stats.volumeMm3;
    expect(loss).toBeGreaterThan(40);
    expect(loss).toBeLessThan(80);
  });

  it('tubo: el tope es la mitad de la pared', () => {
    const max = maxEdgeSize('tube', { outerRadius: 12, innerRadius: 8, height: 20, edgeStyle: 'round', edgeScope: 'all' });
    expect(max).toBeGreaterThan(1.98);
    expect(max).toBeLessThan(2);
  });
});

describe('prisma con bordes', () => {
  it('verticales redondeadas: conserva la medida entre caras planas y queda cerrado', async () => {
    const params = { radius: 12, height: 15, sides: 6 };
    const sharp = await build('prism', params);
    for (const scope of ['vertical', 'all', 'top'] as const) {
      for (const edgeStyle of ['round', 'chamfer'] as const) {
        const { mesh, stats } = await build('prism', { ...params, edgeStyle, edgeSize: 2, edgeScope: scope });
        expectClosed(mesh);
        expect(stats.volumeMm3).toBeLessThan(sharp.stats.volumeMm3);
        // Fondo (Z interno): entre caras planas del hexágono = 2·apotema.
        expect(Math.abs(stats.dimensionsMm[2] - sharp.stats.dimensionsMm[2])).toBeLessThan(1e-3);
        expect(Math.abs(stats.dimensionsMm[1] - 15)).toBeLessThan(1e-3);
      }
    }
  });
});
