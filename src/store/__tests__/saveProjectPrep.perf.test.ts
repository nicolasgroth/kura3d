/**
 * @file src/store/__tests__/saveProjectPrep.perf.test.ts
 * @description Tramo previo al códec al guardar un proyecto grande (solo con `npm run test:perf`): un STL binario de
 * ~500 mil triángulos importado como en la app, y el tiempo de `saveProject` hasta el primer aviso del códec,
 * desglosado (captura del proyecto, copia estructurada que haría `postMessage`). Umbrales holgados, en ms.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it, vi } from 'vitest';
import { saveProjectFile } from '../../project/projectFiles';
import { captureProject } from '../projectDocument';
import { useKuraStore } from '../useKuraStore';

vi.mock('../../project/projectFiles', async (importActual) => ({
  ...(await importActual<typeof import('../../project/projectFiles')>()),
  saveProjectFile: vi.fn(),
}));

/** STL binario de una esfera UV: `segments × rings × 2` triángulos. */
function sphereStl(rings: number, segments: number): ArrayBuffer {
  const point = (i: number, j: number) => {
    const theta = (i / segments) * Math.PI * 2, phi = (j / rings) * Math.PI;
    return [20 * Math.sin(phi) * Math.cos(theta), 20 * Math.cos(phi), 20 * Math.sin(phi) * Math.sin(theta)];
  };
  const count = segments * rings * 2;
  const buffer = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buffer);
  view.setUint32(80, count, true);
  let at = 84;
  const tri = (a: number[], b: number[], c: number[]) => {
    at += 12;
    for (const p of [a, b, c]) for (const v of p) { view.setFloat32(at, v, true); at += 4; }
    at += 2;
  };
  for (let i = 0; i < segments; i++) for (let j = 0; j < rings; j++) {
    tri(point(i, j), point(i + 1, j), point(i, j + 1));
    tri(point(i, j + 1), point(i + 1, j), point(i + 1, j + 1));
  }
  return buffer;
}

describe('guardar: tramo previo al códec', () => {
  it('con ~500 mil triángulos importados, el primer aviso del códec llega pronto', async () => {
    const store = useKuraStore.getState;
    await store().initEngine();
    const stl = sphereStl(250, 1000);
    expect(await store().importModelFiles([{ name: 'esfera.stl', size: stl.byteLength, read: async () => stl }])).toBe(true);
    const object = store().objects[0];
    expect(object.mesh.indices.length / 3).toBeGreaterThan(450_000);

    let t0 = performance.now();
    const doc = captureProject(store());
    const captureMs = performance.now() - t0;
    t0 = performance.now();
    structuredClone(doc);
    const cloneMs = performance.now() - t0;

    let firstProgressMs = NaN, imageMs = NaN, compressedMs = NaN;
    let start = 0;
    vi.mocked(saveProjectFile).mockImplementation(async (name, data) => {
      if (typeof data === 'function') await data();
      return { name, location: 'C:/esfera.kura' };
    });
    const unsubscribe = useKuraStore.subscribe((s) => {
      if (Number.isNaN(firstProgressMs) && s.busyProgress?.name === 'project_save') firstProgressMs = performance.now() - start;
      if (s.busyProgress?.phase === 'save:compress:25' && Number.isNaN(imageMs)) imageMs = performance.now() - start;
      if (s.busyProgress?.phase === 'save:write' && Number.isNaN(compressedMs)) compressedMs = performance.now() - start;
    });
    start = performance.now();
    expect(await store().saveProject()).toBe(true);
    const totalMs = performance.now() - start;
    unsubscribe();
    console.log(`[guardar] captura ${Math.round(captureMs)} ms; copia estructurada ${Math.round(cloneMs)} ms; `
      + `primer avance ${Math.round(firstProgressMs)} ms; imagen lista ${Math.round(imageMs)} ms; comprimido ${Math.round(compressedMs)} ms; `
      + `total ${Math.round(totalMs)} ms`);
    expect(firstProgressMs).toBeLessThan(300);
    expect(totalMs).toBeLessThan(10_000);
  }, 180_000);
});
