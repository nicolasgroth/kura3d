/**
 * @file src/engine/__tests__/projectionRepeat.test.ts
 * @description Proyectar dos veces el mismo gráfico en el mismo lugar (paredes coincidentes con la
 * proyección anterior): relieve sobre relieve, grabado sobre grabado y grabado sobre relieve idénticos,
 * en cubo (cara superior) y cilindro. El resultado debe salir cerrado (definición del inspector).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';
import type { MeshData, SurfaceProjectionAxis } from '../../types/kura';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { projectGraphicOntoSurface } from '../surfaceProjection';
import { makeObject } from './geometryTestUtils';

vi.setConfig({ testTimeout: 120_000 });

type Mode = 'emboss' | 'deboss';

async function projectTwice(base: MeshData, axis: SurfaceProjectionAxis, first: Mode, second: Mode) {
  const opts = { kind: 'text' as const, text: 'KURA3D', axis, widthMm: 20, depthMm: 1.2, offsetU: 0, offsetV: 0, colorHex: '#f97316' };
  const once = await projectGraphicOntoSurface(makeObject('a', base), { ...opts, mode: first });
  expect(computeMeshStats(once.mesh).isManifold).toBe(true);
  const twice = await projectGraphicOntoSurface(makeObject('b', once.mesh, { position: once.position }), { ...opts, mode: second });
  const stats = computeMeshStats(twice.mesh);
  expect(stats.isManifold).toBe(true);
  return { once: computeMeshStats(once.mesh), twice: stats };
}

describe('proyección repetida en el mismo lugar', () => {
  const cube = () => createPrimitiveMesh('box', { width: 30, height: 30, depth: 30 });
  const cyl = () => createPrimitiveMesh('cylinder', { radius: 15, height: 30, segments: 64 });

  it('cubo: relieve sobre relieve idéntico', async () => {
    const r = await projectTwice(await cube(), '+y', 'emboss', 'emboss');
    expect(r.twice.dimensionsMm[1]).toBeGreaterThan(r.once.dimensionsMm[1] + 0.5);
  });
  it('cubo: grabado sobre grabado idéntico', async () => {
    const r = await projectTwice(await cube(), '+y', 'deboss', 'deboss');
    expect(r.twice.volumeMm3).toBeLessThan(r.once.volumeMm3);
  });
  it('cubo: grabado sobre relieve idéntico', async () => {
    await projectTwice(await cube(), '+y', 'emboss', 'deboss');
  });
  it('cilindro: relieve sobre relieve idéntico', async () => {
    await projectTwice(await cyl(), 'cylindrical', 'emboss', 'emboss');
  });
  it('cilindro: grabado sobre grabado idéntico cierra o falla con la causa real', async () => {
    // Límite conocido: en cilíndrico el segundo grabado idéntico puede no cerrar ni con la perturbación;
    // entonces el error debe nombrar la coincidencia (no "reduce el tamaño").
    try {
      await projectTwice(await cyl(), 'cylindrical', 'deboss', 'deboss');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('PROJECTION_COINCIDENT');
    }
  });
  it('cilindro: grabado sobre relieve idéntico', async () => {
    await projectTwice(await cyl(), 'cylindrical', 'emboss', 'deboss');
  });
});
