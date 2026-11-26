/**
 * @file src/components/viewport/ghostGeometry.perf.test.ts
 * @description Costo en el hilo principal de armar la geometría de un fantasma (buffers + normales) con mallas
 * sintéticas de 500 mil y 2 millones de triángulos, y comprobación de que los buffers no se copian. Umbrales
 * holgados: el valor medido va en la salida (`[perf]`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { buildGhostGeometry } from './ghostGeometry';

/** Rejilla n×n de cuadrados (2·n² triángulos) con vértices compartidos. */
function grid(n: number): MeshData {
  const w = n + 1;
  const positions = new Float32Array(w * w * 3);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 3;
    positions[o] = x;
    positions[o + 1] = Math.sin(x * 0.01) * Math.cos(y * 0.01) * 5;
    positions[o + 2] = y;
  }
  const indices = new Uint32Array(n * n * 6);
  let k = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = y * w + x, b = a + 1, c = a + w, d = c + 1;
    indices[k++] = a; indices[k++] = c; indices[k++] = b;
    indices[k++] = b; indices[k++] = c; indices[k++] = d;
  }
  return { positions, indices } as MeshData;
}

describe('fantasma: armado de la geometría (perf)', () => {
  it.each([[500_000, 500], [2_000_000, 1000]])('%i triángulos: sin copiar buffers y normales en tiempo acotado', (tris, n) => {
    const mesh = grid(n);
    expect(mesh.indices.length / 3).toBe(2 * n * n);
    const t0 = performance.now();
    const solid = buildGhostGeometry(mesh, { normals: true });
    const solidMs = performance.now() - t0;
    const t1 = performance.now();
    const wire = buildGhostGeometry(mesh, { normals: false });
    const wireMs = performance.now() - t1;
    console.info(`[perf] fantasma ${tris} tri: sólido con normales ${solidMs.toFixed(0)} ms, alambre ${wireMs.toFixed(1)} ms`);
    expect(solid.getAttribute('position').array).toBe(mesh.positions);
    expect(solid.getIndex()!.array).toBe(mesh.indices);
    expect(wire.getAttribute('normal')).toBeUndefined();
    expect(wireMs).toBeLessThan(50);
    expect(solidMs).toBeLessThan(tris === 2_000_000 ? 4000 : 1500);
  });
});
