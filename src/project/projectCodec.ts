/**
 * @file src/project/projectCodec.ts
 * @description Códec binario del formato de proyecto .kura v1: serializa y valida escena, historial
 * y mallas con CRC-32 y límites de tamaño.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { computeMeshStats } from '../engine/primitives';
import type { MeshData, SceneObject } from '../types/kura';
import {
  check, color, id, limit, MAX_PROJECT_BYTES, nat, ProjectCodecError, record, shape, validSettings, validStoredObject,
  type ObjectMetadata, type ProjectDocument, type ProjectSceneSnapshot,
} from './projectSchema';

export { MAX_PROJECT_BYTES, ProjectCodecError, type ProjectDocument, type ProjectSceneSnapshot } from './projectSchema';
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
/** Pasos de historial (pasado + futuro) que admiten el store y el formato .kura: fuente única. */
export const MAX_UNDO_HISTORY = 40;
const MAX_HISTORY = MAX_UNDO_HISTORY;
const MAX_OBJECTS = 10000;
const MAX_MESHES = 20000;
const MAX_TRIANGLES_PER_MESH = 1_000_000;
const MAX_VERTICES_PER_MESH = 3_000_000;

// V1: "KURA", uint32 version, uint32 UTF-8 manifest length, uint32 CRC-32 of all
// remaining bytes, JSON manifest, tightly packed 32-bit blocks. All words are little-endian.
// Object coordinates remain local millimetres, Y-up, independent of the chosen display unit.
const MAGIC = [0x4b, 0x55, 0x52, 0x41];
const HEADER_SIZE = 16;
const VERSION = 1;
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  for (let bit = 0; bit < 8; bit++) i = (i >>> 1) ^ ((i & 1) ? 0xedb88320 : 0);
  return i >>> 0;
});
function checksum(bytes: Uint8Array, start = 0) {
  let value = 0xffffffff;
  for (let i = start; i < bytes.length; i++) value = (value >>> 8) ^ crcTable[(value ^ bytes[i]) & 255];
  return (value ^ 0xffffffff) >>> 0;
}

type Words = Float32Array | Uint32Array;
type Block = { kind: 'f32' | 'u32'; length: number };
type StoredMesh = {
  positions: number;
  indices: number;
  normals?: number;
  faceColors?: { palette: string[]; indices: number };
};
type StoredObject = ObjectMetadata & { mesh: number };
type Snapshot<T> = { objects: T[]; selectedIds: string[] };
const maybeIndex = (v: unknown) => v === undefined || nat(v);
const colorTable = shape({ palette: Array.isArray, indices: nat });
const validMesh = shape({
  positions: nat, indices: nat, normals: maybeIndex, faceColors: (v) => v === undefined || colorTable(v),
}) as (v: unknown) => v is StoredMesh;
const validBlock = shape({
  kind: (v) => v === 'f32' || v === 'u32', length: nat,
}) as (v: unknown) => v is Block;
const validSnapshot = shape({ objects: Array.isArray, selectedIds: Array.isArray }) as
  (v: unknown) => v is Snapshot<unknown>;

function copyWords(src: Uint8Array, dest: Uint8Array) {
  if (LITTLE_ENDIAN) {
    dest.set(src);
    return;
  }
  for (let i = 0; i < src.length; i += 4) {
    dest[i] = src[i + 3]; dest[i + 1] = src[i + 2];
    dest[i + 2] = src[i + 1]; dest[i + 3] = src[i];
  }
}

function asBytes(words: Words) {
  return new Uint8Array(words.buffer, words.byteOffset, words.byteLength);
}

// Bound work even when a small manifest references the same large block many times.
function geometryBudget() {
  let vertices = 0;
  let triangles = 0;
  return (positions: Float32Array, indices: Uint32Array) => {
    const n = positions.length / 3, t = indices.length / 3;
    check(Number.isInteger(n) && Number.isInteger(t));
    limit(n <= MAX_VERTICES_PER_MESH && t <= MAX_TRIANGLES_PER_MESH);
    vertices += n;
    triangles += t;
    limit(vertices <= 16_000_000 && triangles <= 8_000_000);
    for (const vertex of indices) check(vertex < n);
  };
}

function mapSnapshot<I, O extends { id: string }>(snapshot: Snapshot<I>, mapObject: (obj: I) => O): Snapshot<O> {
  check(validSnapshot(snapshot));
  limit(snapshot.objects.length <= MAX_OBJECTS);
  check(snapshot.selectedIds.length <= snapshot.objects.length);
  const ids = new Set<string>();
  const objects = Array.from(snapshot.objects, obj => {
    const mapped = mapObject(obj);
    check(!ids.has(mapped.id));
    ids.add(mapped.id);
    return mapped;
  });
  const selectedIds = Array.from(snapshot.selectedIds, selected => {
    check(id(selected) && ids.delete(selected), `selectedIds "${String(selected)}"`);
    return selected;
  });
  return { objects, selectedIds };
}

export function encodeProject(doc: ProjectDocument): Uint8Array {
  const { unitSystem, printerProfile, customBedDimensions, sectionPlane, snapGridMm } = doc;
  const settings = { unitSystem, printerProfile, customBedDimensions, sectionPlane, snapGridMm };
  check(validSettings(settings) && Array.isArray(doc.past) && Array.isArray(doc.future));
  limit(doc.past.length + doc.future.length <= MAX_HISTORY);

  const blocks: Words[] = [];
  const blockIds = new Map<Words, number>();
  const blocksByContent = new Map<string, number[]>();
  const meshes: StoredMesh[] = [];
  const meshIds = new Map<MeshData, number>();
  const validateGeometry = geometryBudget();
  let payloadLength = 0;
  let metadataCharacters = 0;
  function storeBlock(words: Words): number {
    const existing = blockIds.get(words);
    if (existing !== undefined) return existing;
    // Painting copies unchanged coordinates. Compare bytes within checksum buckets
    // so independent copies share storage and checksum collisions remain lossless.
    const bytes = asBytes(words);
    const key = [words instanceof Float32Array ? 'f' : 'u', words.length, checksum(bytes)].join('/');
    const candidates = blocksByContent.get(key) ?? [];
    for (const candidate of candidates) {
      const prior = asBytes(blocks[candidate]);
      if (bytes.every((value, i) => value === prior[i])) {
        blockIds.set(words, candidate);
        return candidate;
      }
    }
    payloadLength += words.byteLength;
    limit(payloadLength + HEADER_SIZE <= MAX_PROJECT_BYTES);
    if (words instanceof Float32Array) for (const value of words) check(Number.isFinite(value));
    candidates.push(blocks.length);
    blocksByContent.set(key, candidates);
    blockIds.set(words, blocks.length);
    return blocks.push(words) - 1;
  }

  function storeMesh(mesh: MeshData) {
    const existing = meshIds.get(mesh);
    if (existing !== undefined) return existing;
    limit(meshes.length < MAX_MESHES);
    check(record(mesh) && Object.keys(mesh).every(k => ['positions', 'indices', 'normals', 'faceColors'].includes(k)));
    const { positions, indices, normals, faceColors } = mesh;
    check(positions instanceof Float32Array && indices instanceof Uint32Array);
    validateGeometry(positions, indices);
    const stored: StoredMesh = { positions: storeBlock(positions), indices: storeBlock(indices) };
    if (normals !== undefined) {
      check(normals instanceof Float32Array && normals.length === positions.length);
      stored.normals = storeBlock(normals);
    }
    if (faceColors !== undefined) {
      check(Array.isArray(faceColors) && faceColors.length <= indices.length / 3);
      const colors = new Uint32Array(faceColors.length);
      const palette = new Map<string, number>();
      for (let i = 0; i < colors.length; i++) {
        const entry = faceColors[i];
        if (entry === undefined) continue;
        check(color(entry));
        if (!palette.has(entry)) palette.set(entry, palette.size + 1);
        colors[i] = palette.get(entry)!;
      }
      stored.faceColors = { palette: [...palette.keys()], indices: storeBlock(colors) };
      metadataCharacters += palette.size * 7;
      limit(metadataCharacters <= MAX_MANIFEST_BYTES);
    }
    meshIds.set(mesh, meshes.length);
    return meshes.push(stored) - 1;
  }

  function storeObject(obj: SceneObject): StoredObject {
    check(record(obj));
    const { mesh, stats: _cache, ...metadata } = obj;
    const stored = { ...metadata, mesh: storeMesh(mesh) };
    check(validStoredObject(stored), `object "${String(obj.name)}"`);
    // Enforce the metadata budget incrementally before constructing a whole-history JSON string.
    metadataCharacters += JSON.stringify(stored).length;
    limit(metadataCharacters <= MAX_MANIFEST_BYTES);
    return stored;
  }

  const snapshot = (s: ProjectSceneSnapshot) => mapSnapshot(s, storeObject);
  const current = snapshot({ objects: doc.objects, selectedIds: doc.selectedIds });
  const past = Array.from(doc.past, snapshot);
  const future = Array.from(doc.future, snapshot);
  const manifest = {
    settings, current, past, future, meshes,
    blocks: blocks.map(b => ({ kind: b instanceof Float32Array ? 'f32' : 'u32', length: b.length })),
  };
  const json = JSON.stringify(manifest);
  limit(json.length <= MAX_MANIFEST_BYTES);
  const metadataBytes = new TextEncoder().encode(json);
  const size = HEADER_SIZE + metadataBytes.length + payloadLength;
  limit(metadataBytes.length <= MAX_MANIFEST_BYTES && size <= MAX_PROJECT_BYTES);
  const bytes = new Uint8Array(size);
  const header = new DataView(bytes.buffer);
  bytes.set(MAGIC);
  header.setUint32(4, VERSION, true);
  header.setUint32(8, metadataBytes.length, true);
  bytes.set(metadataBytes, HEADER_SIZE);
  let offset = HEADER_SIZE + metadataBytes.length;
  for (const block of blocks) {
    copyWords(asBytes(block), bytes.subarray(offset, offset + block.byteLength));
    offset += block.byteLength;
  }
  header.setUint32(12, checksum(bytes, HEADER_SIZE), true);
  return bytes;
}

export function decodeProject(bytes: Uint8Array): ProjectDocument {
  limit(bytes.byteLength <= MAX_PROJECT_BYTES);
  check(bytes.length >= HEADER_SIZE && MAGIC.every((b, i) => bytes[i] === b));
  const header = new DataView(bytes.buffer, bytes.byteOffset, HEADER_SIZE);
  if (header.getUint32(4, true) !== VERSION) throw new ProjectCodecError('unsupported');
  const manifestLength = header.getUint32(8, true);
  limit(manifestLength <= MAX_MANIFEST_BYTES);
  let offset = HEADER_SIZE + manifestLength;
  check(offset <= bytes.length && header.getUint32(12, true) === checksum(bytes, HEADER_SIZE));
  let manifest: unknown;
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(HEADER_SIZE, offset)));
  } catch {
    throw new ProjectCodecError('invalid');
  }
  check(record(manifest) && Object.keys(manifest).length === 6);
  const { settings, current, past, future, meshes, blocks } = manifest;
  check(validSettings(settings) && validSnapshot(current) && Array.isArray(past) && Array.isArray(future));
  check(Array.isArray(meshes) && Array.isArray(blocks));
  limit(past.length + future.length <= MAX_HISTORY && meshes.length <= MAX_MESHES && blocks.length <= meshes.length * 4);

  const data = blocks.map((block: unknown) => {
    check(validBlock(block));
    const byteLength = block.length * 4;
    check(byteLength <= bytes.length - offset);
    // Own the memory so node Buffer slices and unaligned browser views work identically.
    const words = block.kind === 'f32' ? new Float32Array(block.length) : new Uint32Array(block.length);
    copyWords(bytes.subarray(offset, offset + byteLength), asBytes(words));
    offset += byteLength;
    if (words instanceof Float32Array) for (const value of words) check(Number.isFinite(value));
    return words;
  });
  check(offset === bytes.length);
  const validateGeometry = geometryBudget();
  const usedBlocks = new Set<number>();
  function block(index: number) {
    check(index < data.length);
    usedBlocks.add(index);
    return data[index];
  }
  const assets = meshes.map((stored: unknown) => {
    check(validMesh(stored));
    const positions = block(stored.positions), indices = block(stored.indices);
    check(positions instanceof Float32Array && indices instanceof Uint32Array);
    validateGeometry(positions, indices);
    const mesh: MeshData = { positions, indices };
    if (stored.normals !== undefined) {
      const normals = block(stored.normals);
      check(normals instanceof Float32Array && normals.length === positions.length);
      mesh.normals = normals;
    }
    if (stored.faceColors !== undefined) {
      const { palette } = stored.faceColors;
      const indicesByFace = block(stored.faceColors.indices);
      check(indicesByFace instanceof Uint32Array && indicesByFace.length <= indices.length / 3);
      check(palette.length <= indicesByFace.length && palette.every(color) && new Set(palette).size === palette.length);
      const colors = new Array<string>(indicesByFace.length);
      for (let i = 0; i < colors.length; i++) {
        const idx = indicesByFace[i];
        check(idx <= palette.length);
        if (idx > 0) colors[i] = palette[idx - 1];
      }
      mesh.faceColors = colors;
    }
    return { mesh, geometryKey: stored.positions + '/' + stored.indices };
  });
  check(usedBlocks.size === data.length);
  const usedMeshes = new Set<number>();
  const stats = new Map<string, SceneObject['stats']>();
  function restoreObject(stored: unknown): SceneObject {
    check(validStoredObject(stored) && stored.mesh < assets.length, `object "${String((stored as { name?: unknown }).name)}"`);
    const { mesh, geometryKey } = assets[stored.mesh];
    usedMeshes.add(stored.mesh);
    let cache = stats.get(geometryKey);
    if (!cache) {
      cache = computeMeshStats(mesh);
      stats.set(geometryKey, cache);
    }
    return { ...stored, mesh, stats: { ...cache, dimensionsMm: [...cache.dimensionsMm] } };
  }
  function snapshot(s: unknown) {
    check(validSnapshot(s));
    return mapSnapshot(s, restoreObject);
  }
  const document = { ...settings, ...snapshot(current), past: past.map(snapshot), future: future.map(snapshot) };
  check(usedMeshes.size === assets.length);
  return document;
}
