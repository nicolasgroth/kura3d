/**
 * @file src/project/__tests__/projectCodecV6.test.ts
 * @description Pruebas del formato .kura 6 (sobre comprimido): ida y vuelta completa, los dos caminos de
 * compresión (nativo `CompressionStream` y respaldo fflate), lectura de imágenes v3/v4/v5 del escritor
 * anterior, bomba de descompresión, truncado, bits cambiados y versión futura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { deflateSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeMeshStats } from '../../engine/primitives';
import { DEFAULT_PRINTER_PROFILES, type MeshData, type SceneObject } from '../../types/kura';
import { crc32 } from '../crc32';
import { COMPRESSED_FORMAT_VERSION } from '../kuraEnvelope';
import {
  decodeProject, encodeProject, encodeProjectCompressed, encodeProjectImage, INFO_FORMAT_VERSION, PLATES_FORMAT_VERSION,
  MAX_PROJECT_BYTES, ProjectCodecError, type ProjectDocument,
} from '../projectCodec';
import { ROLE_FORMAT_VERSION } from '../projectRoleMigration';

const u32 = (bytes: Uint8Array, at: number) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(at, true);

function paintedMesh(): MeshData {
  const faceColors = new Array<string>(4);
  faceColors[0] = '#ff0000';
  faceColors[2] = '#00ff00';
  return {
    positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
    indices: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]),
    normals: new Float32Array(12).fill(0.5), faceColors,
  };
}
const obj = (id: string, mesh: MeshData, extra: Partial<SceneObject> = {}): SceneObject => ({
  id, name: id, source: 'imported', position: [1, 2, 3], rotation: [0, 0.5, 0], scale: [1, 1, 1],
  color: '#808080', role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh), ...extra,
});
const base = (extra: Partial<ProjectDocument> = {}): ProjectDocument => ({
  objects: [], selectedIds: [], past: [], future: [],
  unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
  sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 0, ...extra,
});

/** Escena, historial, placas, datos del proyecto y pintura: todo lo que guarda un `.kura`. */
function fullDocument(): ProjectDocument {
  const mesh = paintedMesh();
  const a = obj('a', mesh, { plateRef: 'p1' });
  const b = obj('b', mesh, { plateRef: 'p2', role: 'negative' });
  const { faceColors: _unpainted, ...plain } = paintedMesh();
  const plates = [{ id: 'p1', name: 'Placa 1', origin: [0, 0] as [number, number] }, { id: 'p2', name: 'Cabeza', origin: [260, 0] as [number, number], locked: true }];
  return base({
    objects: [a, b], selectedIds: ['b'],
    plates,
    past: [{ objects: [], selectedIds: [] }, { objects: [obj('a', plain)], selectedIds: ['a'] }],
    future: [{ objects: [a], selectedIds: [], plates }],
    info: { description: 'Soporte', notes: 'ñ 文', author: 'Ana', createdAt: '2026-11-20T10:00:00Z', modifiedAt: '2026-11-23T14:05:09.123Z', workSeconds: 90 },
  });
}

/** Arma un sobre v6 a mano: versión, largo declarado y datos comprimidos, con CRC correcto salvo que se pida otro. */
function envelope(compressed: Uint8Array, declared: number, version = COMPRESSED_FORMAT_VERSION, crc?: number) {
  const out = new Uint8Array(16 + compressed.length);
  out.set([0x4b, 0x55, 0x52, 0x41]);
  out.set(compressed, 16);
  const view = new DataView(out.buffer);
  view.setUint32(4, version, true);
  view.setUint32(8, declared, true);
  view.setUint32(12, crc ?? crc32(out, 16), true);
  return out;
}
const codeOf = (fn: () => unknown) => {
  try { fn(); } catch (error) { return error instanceof ProjectCodecError ? error.code : 'untyped'; }
  return 'ok';
};

afterEach(() => vi.unstubAllGlobals());

describe('.kura v6: sobre comprimido', () => {
  it('todo guardado sale v6 y la ida y vuelta es idéntica (escena, historial, placas, datos y pintura)', () => {
    const doc = fullDocument();
    const bytes = encodeProject(doc);
    expect(u32(bytes, 4)).toBe(COMPRESSED_FORMAT_VERSION);
    expect(u32(bytes, 8)).toBe(encodeProjectImage(doc).length);
    const back = decodeProject(bytes);
    expect(back).toEqual(doc);
    expect(back.objects[0].mesh).toBe(back.objects[1].mesh);
    expect(back.objects[0].mesh.faceColors![2]).toBe('#00ff00');
    expect(encodeProject(back)).toEqual(bytes);
  });

  it('el camino nativo (CompressionStream) y el respaldo (fflate) abren con el mismo lector', async () => {
    expect(typeof CompressionStream).toBe('function');
    const doc = fullDocument();
    const native = await encodeProjectCompressed(doc);
    vi.stubGlobal('CompressionStream', undefined);
    const fallback = await encodeProjectCompressed(doc);
    expect(fallback).toEqual(encodeProject(doc));
    vi.stubGlobal('CompressionStream', class { constructor() { throw new TypeError('deflate-raw no soportado'); } });
    const failing = await encodeProjectCompressed(doc);
    expect(failing).toEqual(fallback);
    for (const bytes of [native, fallback]) {
      expect(u32(bytes, 4)).toBe(COMPRESSED_FORMAT_VERSION);
      expect(decodeProject(bytes)).toEqual(doc);
    }
  });

  it('comprime de verdad una malla grande', () => {
    const n = 30_000;
    const positions = new Float32Array(n * 9).map((_, i) => (i % 9) + Math.floor(i / 9) * 0.01);
    const mesh: MeshData = { positions, indices: Uint32Array.from({ length: n * 3 }, (_, i) => i) };
    const doc = base({ objects: [obj('big', mesh)] });
    expect(encodeProject(doc).length).toBeLessThan(encodeProjectImage(doc).length * 0.7);
  });

  it('sigue leyendo imágenes v3, v4 y v5 del escritor anterior, sin comprimir', () => {
    const mesh = paintedMesh();
    const cases: [ProjectDocument, number][] = [
      [base({ objects: [obj('a', mesh)] }), ROLE_FORMAT_VERSION],
      [base({ objects: [obj('a', mesh, { plateRef: 'p1' })], plates: [{ id: 'p1', name: 'P', origin: [0, 0] }] }), PLATES_FORMAT_VERSION],
      [fullDocument(), INFO_FORMAT_VERSION],
    ];
    for (const [doc, version] of cases) {
      const image = encodeProjectImage(doc);
      expect(u32(image, 4)).toBe(version);
      expect(decodeProject(image)).toEqual(doc);
    }
  });

  it('una versión futura (7) se rechaza como versión no soportada', () => {
    const bytes = encodeProject(fullDocument());
    bytes[4] = 7;
    expect(codeOf(() => decodeProject(bytes))).toBe('unsupported');
  });

  it('la imagen interior no puede ser otro v6 ni algo que no sea .kura', () => {
    const inner = encodeProject(fullDocument());
    expect(codeOf(() => decodeProject(envelope(deflateSync(inner), inner.length)))).toBe('invalid');
    const junk = new TextEncoder().encode('no es un proyecto, solo texto suficiente para pasar la cabecera');
    expect(codeOf(() => decodeProject(envelope(deflateSync(junk), junk.length)))).toBe('invalid');
  });

  it('bomba de descompresión: el tamaño real no puede pasar el declarado', () => {
    const zeros = new Uint8Array(32 * 1024 * 1024);
    const bomb = deflateSync(zeros, { level: 9 });
    expect(bomb.length).toBeLessThan(64 * 1024);
    expect(codeOf(() => decodeProject(envelope(bomb, 1024 * 1024)))).toBe('invalid');
  });

  it('bomba de descompresión: declarado sobre el tope o imposible para deflate se rechaza sin inflar', () => {
    const tiny = deflateSync(new Uint8Array(4096));
    expect(codeOf(() => decodeProject(envelope(tiny, MAX_PROJECT_BYTES + 1)))).toBe('too-large');
    // ~1 MiB declarado desde 30 bytes: deflate no pasa de ~1032:1, el archivo miente.
    expect(codeOf(() => decodeProject(envelope(tiny, 64 * 1024 * 1024)))).toBe('too-large');
    expect(codeOf(() => decodeProject(envelope(tiny, 8)))).toBe('invalid');
  });

  it('un archivo truncado o con un bit cambiado da ProjectCodecError (nunca otra excepción)', () => {
    const bytes = encodeProject(fullDocument());
    for (const cut of [0, 3, 8, 15, 16, 17, bytes.length >> 1, bytes.length - 1]) {
      expect(codeOf(() => decodeProject(bytes.subarray(0, cut)))).toBe('invalid');
    }
    const flipped = bytes.slice();
    flipped[flipped.length >> 1] ^= 4;
    expect(codeOf(() => decodeProject(flipped))).toBe('invalid');
    // Aunque quien lo dañó recalcule el CRC exterior, el inflado, el largo y el CRC interior lo atajan.
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    const compressed = bytes.subarray(16);
    for (let k = 0; k < 300; k++) {
      const damaged = compressed.slice();
      damaged[rand() % damaged.length] ^= 1 << (rand() % 8);
      const result = codeOf(() => decodeProject(envelope(damaged, u32(bytes, 8))));
      expect(['invalid', 'too-large', 'ok']).toContain(result);
    }
    const garbage = Uint8Array.from({ length: 4096 }, () => rand() & 255);
    expect(codeOf(() => decodeProject(envelope(garbage, 100_000)))).toBe('invalid');
  });
});
