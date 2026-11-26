/**
 * @file src/project/__tests__/projectCodecSharedWorker.test.ts
 * @description Cliente del códec con un Worker compartido (se crea una vez y se reutiliza; se puede precalentar):
 * peticiones simultáneas reciben cada una su respuesta, el avance llega a la petición correcta y un fallo del
 * Worker rechaza lo pendiente y el siguiente pedido crea uno nuevo. El Worker se simula en proceso con su
 * mismo código.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { computeMeshStats } from '../../engine/meshStats';
import { DEFAULT_PRINTER_PROFILES, type MeshData } from '../../types/kura';
import { encodeProject, type ProjectDocument } from '../projectCodec';

type Handler = (event: { data: unknown }) => Promise<void>;
let handler: Handler;
let current: FakeWorker | null = null;

class FakeWorker {
  static created = 0;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string; preventDefault: () => void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  constructor() { FakeWorker.created++; current = this; }
  postMessage(data: unknown) { setTimeout(() => void handler({ data: structuredClone(data) }), 0); }
  terminate() { this.terminated = true; }
  crash() { this.onerror?.({ message: 'boom', preventDefault: () => {} }); }
}

function doc(name: string, triangles = 2000): ProjectDocument {
  const mesh: MeshData = { positions: new Float32Array(triangles * 9).map((_, i) => i % 97), indices: Uint32Array.from({ length: triangles * 3 }, (_, i) => i) };
  return {
    objects: [{ id: name, name, source: 'imported', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#808080',
      role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh) }],
    selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0],
    customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 0,
  };
}

let client: typeof import('../projectCodecClient');

beforeAll(async () => {
  vi.stubGlobal('CompressionStream', undefined); // Mismo camino que `encodeProject` para comparar bytes.
  vi.stubGlobal('self', { postMessage: (m: unknown) => current?.onmessage?.({ data: m }) });
  await import('../projectCodec.worker');
  handler = (globalThis as unknown as { self: { onmessage: Handler } }).self.onmessage;
  vi.stubGlobal('Worker', FakeWorker);
  client = await import('../projectCodecClient');
});

afterEach(() => client.resetProjectCodecWorker());

describe('Worker compartido del códec', () => {
  it('se crea una sola vez, se precalienta y atiende peticiones simultáneas con su propio avance', async () => {
    FakeWorker.created = 0;
    client.prewarmProjectCodec();
    expect(FakeWorker.created).toBe(1);
    const a = doc('a'), b = doc('b', 30_000);
    const progressA: number[] = [], progressB: number[] = [];
    const [bytesA, bytesB] = await Promise.all([
      client.encodeProjectAsync(a, (p) => progressA.push(p)),
      client.encodeProjectAsync(b, (p) => progressB.push(p)),
    ]);
    expect(bytesA).toEqual(encodeProject(a));
    expect(bytesB).toEqual(encodeProject(b));
    expect(progressA.at(-1)).toBe(100);
    expect(progressB.at(-1)).toBe(100);
    const opened = await client.decodeProjectAsync(bytesB.slice());
    expect(opened.objects[0].id).toBe('b');
    expect(FakeWorker.created).toBe(1);
  });

  it('si el Worker falla, lo pendiente se rechaza y el siguiente pedido usa uno nuevo', async () => {
    FakeWorker.created = 0;
    const pending = client.encodeProjectAsync(doc('a'));
    const crashed = current!;
    crashed.crash();
    await expect(pending).rejects.toThrow('boom');
    expect(crashed.terminated).toBe(true);
    expect(await client.encodeProjectAsync(doc('c'))).toEqual(encodeProject(doc('c')));
    expect(FakeWorker.created).toBe(2);
  });
});
