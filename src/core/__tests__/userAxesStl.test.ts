/**
 * @file src/core/__tests__/userAxesStl.test.ts
 * @description Un STL Z-arriba de 10 × 20 × 30 (X × Y × Z) se muestra al usuario como 10 × 20 × 30 con
 * Z = 30 de alto tras importar (conversión interna a Y arriba + capa `displayAxes`) y al exportar vuelve igual.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneObject } from '../../types/kura';
import { computeMeshStats, initManifoldEngine } from '../../engine/index';
import { exportSceneToBinarySTL, readSTL } from '../../engine/ioFormats';
import { cubeGeometry, toBuffer } from '../../engine/__tests__/ioFixtures';
import { toUserBox, toUserSize } from '../scene/displayAxes';

const SIZE: [number, number, number] = [10, 20, 30];

/** STL binario de una caja [0..10] × [0..20] × [0..30] en Z-up. */
function boxStl(): ArrayBuffer {
  const { v, t } = cubeGeometry(1);
  const buffer = new ArrayBuffer(84 + t.length * 50);
  const view = new DataView(buffer);
  view.setUint32(80, t.length, true);
  let o = 84;
  for (const tri of t) {
    o += 12;
    for (const idx of tri) {
      for (let a = 0; a < 3; a += 1) view.setFloat32(o + a * 4, v[idx][a] * SIZE[a], true);
      o += 12;
    }
    o += 2;
  }
  return buffer;
}

/** Extensión X, Y, Z de los vértices de un STL binario. */
function stlExtent(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i += 1) {
    for (let k = 0; k < 3; k += 1) {
      const base = 84 + i * 50 + 12 + k * 12;
      for (let a = 0; a < 3; a += 1) {
        const value = view.getFloat32(base + a * 4, true);
        min[a] = Math.min(min[a], value);
        max[a] = Math.max(max[a], value);
      }
    }
  }
  return max.map((m, a) => Math.round((m - min[a]) * 1000) / 1000);
}

beforeAll(async () => {
  await initManifoldEngine();
});

describe('ejes del usuario con STL', () => {
  it('importar 10 × 20 × 30 se lee 10 × 20 × 30 con Z = 30 de alto, y exportar vuelve igual', () => {
    const model = readSTL(boxStl(), 'caja.stl');
    const mesh = model.parts[0].mesh;
    const stats = computeMeshStats(mesh);
    // Interno Y arriba: el alto (30) está en Y.
    expect(stats.dimensionsMm.map((d) => Math.round(d * 1000) / 1000)).toEqual([10, 30, 20]);
    expect(toUserSize(stats.dimensionsMm).map((d) => Math.round(d * 1000) / 1000)).toEqual([10, 20, 30]);

    const p = mesh.positions;
    const min = [Infinity, Infinity, Infinity] as [number, number, number];
    const max = [-Infinity, -Infinity, -Infinity] as [number, number, number];
    for (let i = 0; i < p.length; i += 3) {
      for (let a = 0; a < 3; a += 1) {
        min[a] = Math.min(min[a], p[i + a]);
        max[a] = Math.max(max[a], p[i + a]);
      }
    }
    const userBox = toUserBox({ min, max });
    expect(userBox.max[2] - userBox.min[2]).toBeCloseTo(30, 6);

    const obj = {
      id: 'caja', name: 'caja', source: 'import', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#cccccc', role: 'solid', visible: true, locked: false, mesh, stats,
    } as unknown as SceneObject;
    const bytes = exportSceneToBinarySTL([obj]);
    expect(stlExtent(bytes)).toEqual([10, 20, 30]);
    // Y la reimportación conserva la lectura.
    const again = readSTL(toBuffer(bytes), 'caja.stl');
    expect(toUserSize(computeMeshStats(again.parts[0].mesh).dimensionsMm).map((d) => Math.round(d * 1000) / 1000)).toEqual([10, 20, 30]);
  });
});
