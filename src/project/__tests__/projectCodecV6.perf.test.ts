/**
 * @file src/project/__tests__/projectCodecV6.perf.test.ts
 * @description Tiempo de guardar y abrir un .kura v6 grande (solo con `npm run test:perf`): esfera de 500 mil
 * triángulos, guardado por el camino nativo (`CompressionStream`) y por el respaldo (fflate), y apertura.
 * Umbrales holgados, en ms; los tiempos medidos quedan en la salida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';
import { computeMeshStats } from '../../engine/primitives';
import { DEFAULT_PRINTER_PROFILES, type MeshData, type SceneObject } from '../../types/kura';
import { decodeProject, encodeProjectCompressed, encodeProjectImage, type ProjectDocument } from '../projectCodec';

function sphereDocument(rings: number, segments: number): ProjectDocument {
  const positions = new Float32Array((rings + 1) * (segments + 1) * 3);
  let p = 0;
  for (let i = 0; i <= segments; i++) for (let j = 0; j <= rings; j++) {
    const theta = (i / segments) * Math.PI * 2, phi = (j / rings) * Math.PI;
    positions[p++] = 20 * Math.sin(phi) * Math.cos(theta);
    positions[p++] = 20 * Math.cos(phi);
    positions[p++] = 20 * Math.sin(phi) * Math.sin(theta);
  }
  const indices = new Uint32Array(segments * rings * 6);
  let k = 0;
  for (let i = 0; i < segments; i++) for (let j = 0; j < rings; j++) {
    const a = i * (rings + 1) + j, b = a + rings + 1;
    indices.set([a, b, a + 1, a + 1, b, b + 1], k);
    k += 6;
  }
  const mesh: MeshData = { positions, indices };
  const sphere: SceneObject = {
    id: 'esfera', name: 'esfera', source: 'imported', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: '#808080', role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
  };
  return {
    objects: [sphere], selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0],
    customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 0,
  };
}

async function timed<T>(fn: () => T | Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const value = await fn();
  return [value, performance.now() - t0];
}

describe('.kura v6: rendimiento', () => {
  it('guarda y abre 500 mil triángulos dentro de umbral por los dos caminos', async () => {
    const doc = sphereDocument(250, 1000);
    expect(doc.objects[0].mesh.indices.length / 3).toBe(500_000);
    encodeProjectImage(doc); // Calienta el JIT para no medir la primera compilación.
    const [image, imageMs] = await timed(() => encodeProjectImage(doc));
    const [native, nativeMs] = await timed(() => encodeProjectCompressed(doc));
    vi.stubGlobal('CompressionStream', undefined);
    const [fallback, fallbackMs] = await timed(() => encodeProjectCompressed(doc));
    vi.unstubAllGlobals();
    const [, openMs] = await timed(() => decodeProject(native));
    const [, openImageMs] = await timed(() => decodeProject(image));
    const mb = (n: number) => (n / 1e6).toFixed(2) + ' MB';
    console.log(`[kura v6] imagen sin comprimir ${mb(image.length)} en ${Math.round(imageMs)} ms`);
    console.log(`[kura v6] nativo ${mb(native.length)} en ${Math.round(nativeMs)} ms; respaldo fflate ${mb(fallback.length)} en ${Math.round(fallbackMs)} ms`);
    console.log(`[kura v6] abrir v6 ${Math.round(openMs)} ms; abrir imagen sin comprimir ${Math.round(openImageMs)} ms`);
    expect(native.length).toBeLessThan(image.length * 0.6);
    expect(fallback.length).toBeLessThan(image.length * 0.6);
    expect(nativeMs).toBeLessThan(5_000);
    expect(fallbackMs).toBeLessThan(8_000);
    expect(openMs).toBeLessThan(8_000);
  }, 120_000);
});
