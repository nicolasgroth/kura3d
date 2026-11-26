/**
 * @file src/project/projectCodec.test.ts
 * @description Pruebas del códec binario de proyectos .kura (imagen sin comprimir v1 a v5 y ida y vuelta v6; CRC y límites).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../engine/primitives';
import { DEFAULT_PRINTER_PROFILES, type MeshData, type SceneObject } from '../types/kura';
import { decodeProject, encodeProject, encodeProjectImage, type ProjectDocument } from './projectCodec';

function fixture(): ProjectDocument {
  const faceColors = new Array<string>(4);
  faceColors[1] = '#aBcDeF';
  faceColors[3] = '#aBcDeF';
  const mesh: MeshData = {
    positions: new Float32Array([99, -0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 88]).subarray(1, 13),
    indices: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]),
    normals: new Float32Array(12).fill(0.25), faceColors,
  };
  const object: SceneObject = {
    id: 'part-a', name: 'cúpula 🧊', source: 'primitive', primitiveType: 'text',
    primitiveParams: { text: 'Àrbol 文', width: 22, segments: 18, bevel: 1.5 },
    position: [-1.25, 3, 0], rotation: [0.125, -0.5, 0], scale: [-1, 1, 2],
    color: '#aBBacf', materialPreset: 'wax_candle', role: 'negative', visible: false, locked: true,
    hollow: { enabled: true, wallThickness: 1.25, drainHole: true, drainHoleRadius: 0.8 },
    texture: { pattern: 'honeycomb', depth: 1, scale: 3 },
    mesh, stats: computeMeshStats(mesh),
  };
  const previous: SceneObject = {
    ...object, name: 'before', mesh: {
      positions: mesh.positions.slice(), indices: mesh.indices.slice(), normals: mesh.normals!.slice(),
    },
  };
  const copy: SceneObject = { ...object, id: 'part-b', position: [10, 0, 7] };
  return {
    objects: [object, copy], selectedIds: ['part-b', 'part-a'],
    past: [{ objects: [], selectedIds: [] }, { objects: [previous], selectedIds: ['part-a'] }],
    future: [{ objects: [copy], selectedIds: [] }],
    unitSystem: 'in', printerProfile: DEFAULT_PRINTER_PROFILES[0],
    customBedDimensions: { width: 256, depth: 280, height: 310.5 },
    sectionPlane: { enabled: true, heightMm: 12.5 }, snapGridMm: 0.5,
  };
}

// Build deliberately malformed v1 samples with a valid, independently computed checksum.
function repack(bytes: Uint8Array, edit: (manifest: any, payload: Uint8Array) => void) {
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(8, true);
  const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + length)));
  const payload = bytes.slice(16 + length);
  edit(manifest, payload);
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  const out = new Uint8Array(16 + json.length + payload.length);
  out.set(bytes.subarray(0, 16));
  out.set(json, 16);
  out.set(payload, 16 + json.length);
  const header = new DataView(out.buffer);
  header.setUint32(8, json.length, true);
  let crc = -1;
  for (const byte of out.subarray(16)) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  header.setUint32(12, ~crc, true);
  return out;
}

describe('Kura project v1', () => {
  it('opens a frozen v1 fixture without using the current writer', () => {
    const json = '{"settings":{"unitSystem":"in","printerProfile":{"id":"bench","name":"Bench","brand":"generic","bedWidthMm":220,"bedDepthMm":220,"maxHeightMm":250,"showPrintVolume":false,"colorSlots":1},"customBedDimensions":null,"sectionPlane":{"enabled":false,"heightMm":25},"snapGridMm":0},"current":{"objects":[],"selectedIds":[]},"past":[],"future":[],"meshes":[],"blocks":[]}';
    const bytes = Uint8Array.from([75, 85, 82, 65, 1, 0, 0, 0, 109, 1, 0, 0, 240, 72, 201, 141,
      ...new TextEncoder().encode(json)]);
    expect(decodeProject(bytes)).toMatchObject({ objects: [], unitSystem: 'in', printerProfile: { id: 'bench' } });
  });

  it('restores typed geometry, material, selection, project settings and both history stacks', () => {
    const doc = fixture();
    const encoded = encodeProject(doc);
    const withOffset = new Uint8Array(encoded.length + 2);
    withOffset.set(encoded, 1);
    const restored = decodeProject(withOffset.subarray(1, -1));
    withOffset.fill(0);
    expect(restored).toEqual(doc);
    const mesh = restored.objects[0].mesh;
    expect(mesh).toBe(restored.objects[1].mesh);
    expect(mesh).toBe(restored.future[0].objects[0].mesh);
    expect(mesh.positions).toBe(restored.past[1].objects[0].mesh.positions);
    expect(mesh.positions).toBeInstanceOf(Float32Array);
    expect(mesh.indices).toBeInstanceOf(Uint32Array);
    expect(mesh.normals).toBeInstanceOf(Float32Array);
    expect(Object.is(mesh.positions[0], -0)).toBe(true);
    expect(0 in mesh.faceColors!).toBe(false);
    expect(mesh.faceColors![1]).toBe('#aBcDeF');
    expect(restored.objects[0].stats.volumeMm3).toBe(4);
    expect(encodeProject(restored)).toEqual(encoded);
  });

  it('allows an empty project and rebuilds cached measurements without persisting session state', () => {
    const doc = fixture();
    doc.objects[0].stats.volumeMm3 = 987654;
    const session = { ...doc, aiConfig: { apiKey: 'secret-test-value' }, mcpConfig: { authToken: 'secret-test-value' } };
    const bytes = encodeProjectImage(session);
    const text = new TextDecoder().decode(bytes);
    expect(text).not.toMatch(/secret-test-value|aiConfig|mcpConfig|volumeMm3|stats/);
    expect(decodeProject(bytes).objects[0].stats.volumeMm3).toBe(4);
    const empty = { ...doc, objects: [], selectedIds: [], past: [], future: [], customBedDimensions: null, snapGridMm: 0 };
    expect(decodeProject(encodeProject(empty))).toEqual(empty);
  });

  it('rejects damaged bytes, unknown versions and oversized metadata with distinct errors', () => {
    const bytes = encodeProjectImage(fixture());
    expect(() => decodeProject(bytes.subarray(0, -1))).toThrowError(expect.objectContaining({ code: 'invalid' }));
    const broken = bytes.slice();
    broken[broken.length - 1] ^= 1;
    expect(() => decodeProject(broken)).toThrowError(expect.objectContaining({ code: 'invalid' }));
    // La 4 (placas), la 5 (datos del proyecto) y la 6 (comprimido) ya existen: la primera versión desconocida es la 7.
    broken[4] = 7;
    expect(() => decodeProject(broken)).toThrowError(expect.objectContaining({ code: 'unsupported' }));
    broken[4] = 3;
    new DataView(broken.buffer).setUint32(8, 16 * 1024 * 1024 + 1, true);
    expect(() => decodeProject(broken)).toThrowError(expect.objectContaining({ code: 'too-large' }));
  });

  const malformed: [string, (m: any, data: Uint8Array) => void][] = [
    ['unexpected root key', m => { m.camera = {}; }],
    ['sensitive settings', m => { m.settings.apiKey = 'key'; }],
    ['prototype field in metadata', m => { m.current.objects[0].primitiveParams = JSON.parse('{"__proto__":{"polluted":true}}'); }],
    ['duplicate object ID', m => { m.current.objects[1].id = m.current.objects[0].id; }],
    ['duplicate selection ID', m => { m.current.selectedIds = ['part-a', 'part-a']; }],
    ['dangling selection inside undo', m => { m.past[1].selectedIds[0] = 'missing'; }],
    ['invalid object inside redo', m => { m.future[0].objects[0].materialPreset = 'bad'; }],
    ['out-of-range mesh reference', m => { m.current.objects[0].mesh = 99; }],
    ['bad transform', m => { m.current.objects[0].rotation = [1, 2]; }],
    ['invalid project units', m => { m.settings.unitSystem = 'px'; }],
    ['invalid bed dimension', m => { m.settings.customBedDimensions.depth = -1; }],
    ['invalid triangle index', (m, data) => { new DataView(data.buffer).setUint32(m.blocks[0].length * 4, 10000, true); }],
    ['nonfinite position', (_, data) => { new DataView(data.buffer).setFloat32(0, NaN, true); }],
    ['invalid normal reference', m => { m.meshes[0].normals = m.meshes[0].indices; }],
    ['invalid face color', m => { m.meshes[0].faceColors.palette[0] = '#zzzzzz'; }],
    ['unclaimed binary bytes', m => { m.blocks.at(-1).length--; }],
  ];
  it.each(malformed)('rejects %s even with a matching checksum', (_, edit) => {
    const bytes = repack(encodeProjectImage(fixture()), edit);
    expect(() => decodeProject(bytes)).toThrowError(expect.objectContaining({ code: 'invalid' }));
  });

  it('checks undo limits and invalid source geometry while saving', () => {
    const doc = fixture();
    doc.past = Array(40).fill(doc.past[0]);
    expect(() => encodeProject(doc)).toThrowError(expect.objectContaining({ code: 'too-large' }));
    doc.past = [];
    doc.objects[0].mesh.indices[2] = 99;
    expect(() => encodeProject(doc)).toThrowError(expect.objectContaining({ code: 'invalid' }));
  });
});
