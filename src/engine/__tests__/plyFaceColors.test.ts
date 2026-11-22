/**
 * @file src/engine/__tests__/plyFaceColors.test.ts
 * @description PLY de ida y vuelta con 3 colores por cara en un mismo objeto: la cabecera declara
 * color por cara, cada triángulo vuelve con su color (mismo conteo por color) y la malla sigue
 * cerrada con su volumen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, SceneObject } from '../../types/kura';
import { exportSceneToPLY, readPLY } from '../io/ply';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { makeObject } from './geometryTestUtils';
import { toBuffer } from './ioFixtures';

const PALETTE = ['#ff0000', '#00ff00', '#0000ff'];
const tally = (colors: string[] | undefined) => {
  const m = new Map<string, number>();
  for (const c of colors ?? []) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
};

describe('PLY: colores por cara', () => {
  it('3 colores en un objeto vuelven cara por cara', async () => {
    const cube = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    const triCount = cube.indices.length / 3;
    const painted: MeshData = { ...cube, faceColors: Array.from({ length: triCount }, (_, t) => PALETTE[Math.floor(t / 4) % 3]) };
    const obj: SceneObject = makeObject('c', painted, { color: '#999999' });
    const bytes = exportSceneToPLY([obj]);
    const header = new TextDecoder().decode(bytes.subarray(0, 400));
    expect(header).toMatch(/element face \d+\nproperty list uchar int vertex_indices\nproperty uchar red\nproperty uchar green\nproperty uchar blue\n/);

    const model = readPLY(toBuffer(bytes), 'c.ply');
    const mesh = model.parts[0].mesh;
    expect(tally(mesh.faceColors)).toEqual(tally(painted.faceColors));
    const stats = computeMeshStats(mesh);
    expect(stats.isManifold).toBe(true);
    expect(stats.volumeMm3).toBeCloseTo(1000, 2);
  });
});
