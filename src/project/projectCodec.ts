/**
 * @file src/project/projectCodec.ts
 * @description Códec binario del formato de proyecto .kura: escribe v6 (sobre comprimido, ver `kuraEnvelope.ts`) con una
 * imagen interior v3, v4 si el proyecto usa placas o v5 si lleva datos del proyecto; lee v1 a v6. Serializa y valida
 * escena, historial y mallas con CRC-32 y límites de tamaño.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { computeMeshStats } from '../engine/primitives';
import { MAX_GROUPS } from '../core/scene/groups';
import { MAX_PLATES } from '../core/scene/plates';
import type { MeshData, SceneGroup, SceneObject } from '../types/kura';
import type { SceneLayout, ScenePlate } from '../types/plates';
import { geometryBudget, MAX_HISTORY, MAX_MESHES, MAX_OBJECTS } from './codecLimits';
import { FILE_HISTORY_MAX_STEPS } from './historyBudget';
import {
  check, color, id, limit, MAX_PROJECT_BYTES, nat, ProjectCodecError, record, shape, validSettings, validStoredGroups, validStoredLayout, validStoredObject, validStoredPlates,
  type ObjectMetadata, type ProjectDocument, type ProjectSceneSnapshot,
} from './projectSchema';
import { compactInfo, validStoredInfo, type ProjectInfo } from './projectInfo';
import { migrateStoredRole, ROLE_FORMAT_VERSION } from './projectRoleMigration';
import { withBoundedParams } from './primitiveParamsBounds';
import { reconcileSceneStructure } from './sceneStructure';
import { crc32 as checksum } from './crc32';
import { compressImage, compressImageSync, COMPRESSED_FORMAT_VERSION, hasKuraMagic, inflateImage, KURA_HEADER_SIZE, KURA_MAGIC } from './kuraEnvelope';

export { MAX_PROJECT_BYTES, ProjectCodecError, type ProjectDocument, type ProjectSceneSnapshot } from './projectSchema';
export { COMPRESSED_FORMAT_VERSION } from './kuraEnvelope';
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
/**
 * Pasos de historial (pasado + futuro) que admite el formato .kura. El store conserva más (por
 * presupuesto de memoria, ver `historyBudget.ts`); al guardar se recortan a los más recientes que
 * caben en `FILE_HISTORY_MAX_STEPS` pasos o `FILE_HISTORY_BUDGET_MB` MB. Los archivos ya escritos
 * (máximo 40 pasos) siguen leyéndose igual.
 */
export const MAX_UNDO_HISTORY = FILE_HISTORY_MAX_STEPS;

// V1: "KURA", uint32 version, uint32 UTF-8 manifest length, uint32 CRC-32 of all
// remaining bytes, JSON manifest, tightly packed 32-bit blocks. All words are little-endian.
// Object coordinates remain local millimetres, Y-up, independent of the chosen display unit.
const MAGIC = KURA_MAGIC;
const HEADER_SIZE = KURA_HEADER_SIZE;
// Versiones: 1 = formato inicial; 2 = agrega el campo opcional `parametric` a cada objeto.
// Se escribe siempre la última; se leen todas las listadas. Un archivo v1 no puede traer campos de v2.
// v3: `role` reemplaza a `isHole` (objetos de referencia); ver `projectRoleMigration.ts`.
// v4: placas de impresión (`plates` en cada instantánea y `plateRef` en cada objeto). Se escribe SOLO si el
// proyecto usa placas (en la escena o en su historial); si no, se sigue escribiendo la 3 para que una
// versión anterior de la app lo abra. Un archivo anterior a v4 no puede traer campos de placas.
// También v4: las dos poses (`restPose` en cada objeto y `layout` = 'assembly' en la instantánea).
// v5: datos del proyecto (`info` en el manifiesto: descripción, notas, autor, fechas, tiempo de trabajo). Se escribe
// SOLO si el proyecto tiene alguno (en la práctica, todo guardado lleva `modifiedAt`). El manifiesto de v1 a v4 es
// estricto (seis claves exactas), así que una app anterior no puede ignorar el campo nuevo: lo rechaza como versión
// no admitida en vez de abrirlo perdiendo datos. Esta versión sí lee v1 a v5; un archivo anterior a v5 no puede
// traer `info`.
// v6: sobre comprimido (`kuraEnvelope.ts`). Todo guardado sale v6; dentro va la imagen v3/v4/v5 de siempre, que sigue
// marcando qué campos admite. Una app anterior lo rechaza como versión no admitida. La imagen interior no puede ser v6.
const VERSION = ROLE_FORMAT_VERSION;
export const PLATES_FORMAT_VERSION = 4;
export const INFO_FORMAT_VERSION = 5;
const READABLE_VERSIONS = new Set([1, 2, ROLE_FORMAT_VERSION, PLATES_FORMAT_VERSION, INFO_FORMAT_VERSION]);
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

type Words = Float32Array | Uint32Array;
type Block = { kind: 'f32' | 'u32'; length: number };
type StoredMesh = {
  positions: number;
  indices: number;
  normals?: number;
  faceColors?: { palette: string[]; indices: number };
};
type StoredObject = ObjectMetadata & { mesh: number };
type Snapshot<T> = { objects: T[]; selectedIds: string[]; groups?: SceneGroup[]; plates?: ScenePlate[]; layout?: SceneLayout };
const maybeIndex = (v: unknown) => v === undefined || nat(v);
const colorTable = shape({ palette: Array.isArray, indices: nat });
const validMesh = shape({
  positions: nat, indices: nat, normals: maybeIndex, faceColors: (v) => v === undefined || colorTable(v),
}) as (v: unknown) => v is StoredMesh;
const validBlock = shape({
  kind: (v) => v === 'f32' || v === 'u32', length: nat,
}) as (v: unknown) => v is Block;
const optionalList = (v: unknown) => v === undefined || Array.isArray(v);
const validSnapshot = shape({ objects: Array.isArray, selectedIds: Array.isArray, groups: optionalList, plates: optionalList, layout: validStoredLayout }) as
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
    check(id(selected) && ids.delete(selected), `selection:${String(selected)}`);
    return selected;
  });
  const out: Snapshot<O> = { objects, selectedIds };
  if (snapshot.groups !== undefined && snapshot.groups.length > 0) {
    // Grupos: forma estricta y cantidad acotada; ciclos, huérfanos y vacíos se sanean, no rechazan el archivo.
    limit(snapshot.groups.length <= MAX_GROUPS);
    check(validStoredGroups(snapshot.groups), 'groups');
    out.groups = snapshot.groups.map((g) => ({ ...g }));
  }
  if (snapshot.plates !== undefined && snapshot.plates.length > 0) {
    // Placas: igual que los grupos; ids repetidos y referencias rotas se sanean (la pieza no se pierde).
    limit(snapshot.plates.length <= MAX_PLATES);
    check(validStoredPlates(snapshot.plates), 'plates');
    out.plates = snapshot.plates.map((p) => ({ ...p, origin: [p.origin[0], p.origin[1]], ...(p.bed ? { bed: { ...p.bed } } : {}) }));
  }
  // Modo de vista: solo se escribe 'assembly' ('print' es el de siempre y equivale a no tenerlo).
  if (snapshot.layout === 'assembly') out.layout = 'assembly';
  return out;
}

/** true si la instantánea usa placas o dos poses (lista, referencia, `restPose` o modo armado): obliga a la versión 4. */
function usesPlates(s: ProjectSceneSnapshot): boolean {
  return (s.plates?.length ?? 0) > 0 || s.layout === 'assembly'
    || s.objects.some((o) => o.plateRef !== undefined || o.restPose !== undefined);
}

/** Guarda un proyecto como .kura v6 comprimido con fflate (síncrono; el Worker usa `encodeProjectCompressed`). */
export function encodeProject(doc: ProjectDocument): Uint8Array {
  return compressImageSync(encodeProjectImage(doc));
}

/** Guarda un proyecto como .kura v6 con el deflate nativo de la plataforma, o fflate si no lo hay. */
export async function encodeProjectCompressed(doc: ProjectDocument): Promise<Uint8Array> {
  return compressImage(encodeProjectImage(doc));
}

/** Imagen .kura sin comprimir (v3, v4 o v5): el contenido del sobre v6 y el formato que escribían versiones anteriores. */
export function encodeProjectImage(doc: ProjectDocument): Uint8Array {
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
    const valid = { ...metadata, mesh: storeMesh(mesh) };
    check(validStoredObject(valid), `object:${String(obj.name)}`);
    const stored = withBoundedParams(valid);
    // Enforce the metadata budget incrementally before constructing a whole-history JSON string.
    metadataCharacters += JSON.stringify(stored).length;
    limit(metadataCharacters <= MAX_MANIFEST_BYTES);
    return stored;
  }

  const snapshot = (s: ProjectSceneSnapshot) => mapSnapshot(s, storeObject);
  const current = snapshot({
    objects: doc.objects, selectedIds: doc.selectedIds,
    ...(doc.groups?.length ? { groups: doc.groups } : {}),
    ...(doc.plates?.length ? { plates: doc.plates } : {}),
    ...(doc.layout === 'assembly' ? { layout: doc.layout } : {}),
  });
  const past = Array.from(doc.past, snapshot);
  const future = Array.from(doc.future, snapshot);
  const info = compactInfo(doc.info);
  if (info) check(validStoredInfo(info), 'info');
  const manifest = {
    settings, current, past, future, meshes,
    ...(info ? { info } : {}),
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
  const withPlates = usesPlates(doc) || doc.past.some(usesPlates) || doc.future.some(usesPlates);
  header.setUint32(4, info ? INFO_FORMAT_VERSION : withPlates ? PLATES_FORMAT_VERSION : VERSION, true);
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

/** Abre un .kura v1 a v6. Lanza siempre `ProjectCodecError` ante datos dañados, truncados o fuera de límites. */
export function decodeProject(bytes: Uint8Array): ProjectDocument {
  limit(bytes.byteLength <= MAX_PROJECT_BYTES);
  check(hasKuraMagic(bytes));
  const version = new DataView(bytes.buffer, bytes.byteOffset, HEADER_SIZE).getUint32(4, true);
  if (version !== COMPRESSED_FORMAT_VERSION) return decodeImage(bytes);
  const image = inflateImage(bytes);
  // Sin anidar: dentro de un v6 solo va una imagen v1 a v5.
  check(hasKuraMagic(image) && READABLE_VERSIONS.has(new DataView(image.buffer).getUint32(4, true)), 'inner-version');
  return decodeImage(image);
}

function decodeImage(bytes: Uint8Array): ProjectDocument {
  check(hasKuraMagic(bytes));
  const header = new DataView(bytes.buffer, bytes.byteOffset, HEADER_SIZE);
  const version = header.getUint32(4, true);
  if (!READABLE_VERSIONS.has(version)) throw new ProjectCodecError('unsupported');
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
  // Seis claves de siempre; `info` (datos del proyecto) solo desde la versión 5.
  check(record(manifest) && Object.keys(manifest).length === (manifest.info === undefined ? 6 : 7));
  check(manifest.info === undefined || version >= INFO_FORMAT_VERSION, 'info');
  const { settings, current, past, future, meshes, blocks } = manifest;
  check(manifest.info === undefined || validStoredInfo(manifest.info), 'info');
  const info: ProjectInfo | undefined = compactInfo(manifest.info as ProjectInfo | undefined);
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
  function restoreObject(raw: unknown): SceneObject {
    const stored = migrateStoredRole(raw, version);
    check(validStoredObject(stored) && stored.mesh < assets.length, `object:${String((stored as { name?: unknown }).name)}`);
    check(version >= 2 || stored.parametric === undefined, `object:${String(stored.name)}`);
    check(version >= PLATES_FORMAT_VERSION || (stored.plateRef === undefined && stored.restPose === undefined), `object:${String(stored.name)}`);
    const { mesh, geometryKey } = assets[stored.mesh];
    usedMeshes.add(stored.mesh);
    let cache = stats.get(geometryKey);
    if (!cache) {
      cache = computeMeshStats(mesh);
      stats.set(geometryKey, cache);
    }
    return { ...withBoundedParams(stored), mesh, stats: { ...cache, dimensionsMm: [...cache.dimensionsMm] } };
  }
  function snapshot(s: unknown) {
    check(validSnapshot(s));
    check(version >= PLATES_FORMAT_VERSION || s.plates === undefined, 'plates');
    check(version >= PLATES_FORMAT_VERSION || s.layout === undefined, 'layout');
    return reconcileSceneStructure(mapSnapshot(s, restoreObject));
  }
  const document = { ...settings, ...snapshot(current), past: past.map(snapshot), future: future.map(snapshot), ...(info ? { info } : {}) };
  check(usedMeshes.size === assets.length);
  return document;
}
