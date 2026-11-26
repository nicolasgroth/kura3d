/**
 * @file src/project/__tests__/projectSaveProgress.test.ts
 * @description Avance del guardado .kura: la compresión informa los bytes entregados al compresor (camino nativo y
 * respaldo fflate), el códec lo traduce a un porcentaje creciente que termina en 100 y el Worker lo envía antes de
 * la respuesta. Con o sin avance, el archivo es el mismo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeMeshStats } from '../../engine/primitives';
import { DEFAULT_PRINTER_PROFILES, type MeshData } from '../../types/kura';
import { compressImage, compressImageSync } from '../kuraEnvelope';
import { decodeProject, encodeProject, encodeProjectCompressed, encodeProjectImage, type ProjectDocument } from '../projectCodec';
import type { ProjectCodecResponse } from '../projectCodecClient';

/** Malla de unos 3 MB: varias partes de compresión para ver avance intermedio. */
function bigDocument(): ProjectDocument {
  const n = 80_000;
  const positions = new Float32Array(n * 9).map((_, i) => Math.sin(i) * 20);
  const mesh: MeshData = { positions, indices: Uint32Array.from({ length: n * 3 }, (_, i) => i) };
  return {
    objects: [{ id: 'a', name: 'a', source: 'imported', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#808080', role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh) }],
    selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0],
    customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 0,
  };
}

const increasing = (values: number[]) => values.every((v, i) => i === 0 || v >= values[i - 1]);

afterEach(() => vi.unstubAllGlobals());

describe('avance del guardado .kura', () => {
  it('la compresión informa bytes entregados crecientes hasta el total, en los dos caminos', async () => {
    const image = encodeProjectImage(bigDocument());
    expect(image.length).toBeGreaterThan(3 * 1024 * 1024);
    for (const native of [true, false]) {
      if (!native) vi.stubGlobal('CompressionStream', undefined);
      const fed: number[] = [];
      const bytes = await compressImage(image, (done, total) => { expect(total).toBe(image.length); fed.push(done); });
      expect(fed.length).toBeGreaterThan(2);
      expect(increasing(fed)).toBe(true);
      expect(fed.at(-1)).toBe(image.length);
      expect(decodeProject(bytes)).toEqual(decodeProject(image));
    }
    const syncFed: number[] = [];
    compressImageSync(image, (done) => syncFed.push(done));
    expect(syncFed.at(-1)).toBe(image.length);
  });

  it('el códec da porcentajes crecientes (preparar y luego comprimir) que terminan en 100, sin cambiar el archivo', async () => {
    const doc = bigDocument();
    vi.stubGlobal('CompressionStream', undefined);
    const steps: { phase: string; percent: number }[] = [];
    const withProgress = await encodeProjectCompressed(doc, (percent, phase) => steps.push({ phase, percent }));
    const without = await encodeProjectCompressed(doc);
    expect(withProgress).toEqual(without);
    expect(withProgress).toEqual(encodeProject(doc));
    expect(steps[0]).toEqual({ phase: 'encode', percent: 0 });
    expect(steps.some((s) => s.phase === 'compress' && s.percent > 25 && s.percent < 100)).toBe(true);
    expect(increasing(steps.map((s) => s.percent))).toBe(true);
    expect(steps.at(-1)).toEqual({ phase: 'compress', percent: 100 });
  });

  it('el Worker envía los avances antes de la respuesta y la respuesta es el archivo', async () => {
    const messages: ProjectCodecResponse[] = [];
    vi.stubGlobal('self', { postMessage: (m: ProjectCodecResponse) => messages.push(m) });
    await import('../projectCodec.worker');
    const worker = (globalThis as unknown as { self: { onmessage: (e: { data: unknown }) => Promise<void> } }).self;
    const doc = bigDocument();
    await worker.onmessage({ data: { id: 7, operation: 'encode', document: doc } });
    expect(messages.every((m) => m.id === 7)).toBe(true);
    const final = messages.at(-1)!;
    expect('ok' in final && final.ok).toBe(true);
    const progress = messages.slice(0, -1).map((m) => ('progress' in m ? m.progress.percent : NaN));
    expect(progress.length).toBeGreaterThan(2);
    expect(increasing(progress)).toBe(true);
    expect(progress.at(-1)).toBe(100);
    expect(decodeProject((final as { value: Uint8Array }).value)).toEqual(decodeProject(encodeProject(doc)));
  });
});
