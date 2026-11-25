/**
 * @file src/project/recoveryDraftFormat.ts
 * @description Formato del borrador de recuperación v2: separa un `ProjectDocument` en un manifiesto
 * liviano (escena, historial, ajustes) y bloques binarios de geometría con clave por huella de
 * contenido, y lo rearma validando cada campo. Una malla que no cambia conserva su clave, así mover
 * o pintar un objeto no vuelve a escribir sus megabytes. Funciones puras: el almacenamiento va en
 * `recoveryDraftStore.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { computeMeshStats } from '../engine/primitives';
import { reconcileGroups } from '../core/scene/groups';
import { reconcilePlates } from '../core/scene/plates';
import type { MeshData, SceneGroup, SceneObject } from '../types/kura';
import type { SceneLayout, ScenePlate } from '../types/plates';
import { withBoundedParams } from './primitiveParamsBounds';
import {
  check, color, id, nat, record, validSettings, validStoredGroups, validStoredLayout, validStoredObject, validStoredPlates,
  type ObjectMetadata, type ProjectDocument, type ProjectSceneSnapshot,
} from './projectSchema';

export const DRAFT_FORMAT = 2;
type Words = Float32Array | Uint32Array;
export type BlockKind = 'f32' | 'u32';

/** Referencia de una malla en el manifiesto: cada atributo apunta a un bloque por su clave. */
export interface DraftMeshRef {
  positions: string;
  indices: string;
  normals?: string;
  faceColors?: { palette: string[]; indices: string };
}
type DraftObject = ObjectMetadata & { mesh: number };
interface DraftSnapshot { objects: DraftObject[]; selectedIds: string[]; groups?: SceneGroup[]; plates?: ScenePlate[]; layout?: SceneLayout }
export interface DraftManifest {
  format: typeof DRAFT_FORMAT;
  settings: Pick<ProjectDocument, 'unitSystem' | 'printerProfile' | 'customBedDimensions' | 'sectionPlane' | 'snapGridMm'>;
  meshes: DraftMeshRef[];
  current: DraftSnapshot;
  past: DraftSnapshot[];
  future: DraftSnapshot[];
}

/** Bloque pendiente de guardar: los bytes se copian recién al escribirlo. */
export interface DraftBlock { key: string; kind: BlockKind; words: Words }

const HASH_CHUNK = 1 << 21;
const keyCache = new WeakMap<Words, string>();

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Huella de contenido (dos FNV-1a de 32 bits sobre las palabras, con semillas distintas) calculada por
 * trozos que ceden el hilo, para no congelar la interfaz con mallas de millones de triángulos. Se
 * memoriza por identidad del arreglo: las mallas del editor son inmutables.
 */
export async function blockKey(words: Words): Promise<string> {
  const cached = keyCache.get(words);
  if (cached) return cached;
  const view = new Uint32Array(words.buffer, words.byteOffset, words.length);
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  for (let start = 0; start < view.length; start += HASH_CHUNK) {
    const end = Math.min(view.length, start + HASH_CHUNK);
    for (let i = start; i < end; i++) {
      const w = view[i];
      a = Math.imul(a ^ w, 0x01000193);
      b = Math.imul(b ^ ((w >>> 16) | (w << 16)), 0x01000193) ^ i;
    }
    if (end < view.length) await yieldToUi();
  }
  const key = `${words instanceof Float32Array ? 'f' : 'u'}${words.length}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
  keyCache.set(words, key);
  return key;
}

const colorCache = new WeakMap<string[], { palette: string[]; indices: Uint32Array }>();
function packColors(faceColors: string[]) {
  const cached = colorCache.get(faceColors);
  if (cached) return cached;
  const indices = new Uint32Array(faceColors.length);
  const palette = new Map<string, number>();
  for (let i = 0; i < indices.length; i++) {
    const entry = faceColors[i];
    if (entry === undefined) continue;
    check(color(entry));
    if (!palette.has(entry)) palette.set(entry, palette.size + 1);
    indices[i] = palette.get(entry)!;
  }
  const packed = { palette: [...palette.keys()], indices };
  colorCache.set(faceColors, packed);
  return packed;
}

/** Bytes de geometría únicos de un conjunto de bloques. */
export const blockBytes = (blocks: Iterable<DraftBlock>) => {
  let total = 0;
  for (const block of blocks) total += block.words.byteLength;
  return total;
};

/**
 * Separa el documento en manifiesto y bloques. `withHistory: false` omite deshacer/rehacer (se usa
 * cuando el borrador con historial no cabe en la cuota del navegador).
 */
export async function splitDocument(doc: ProjectDocument, withHistory = true) {
  const blocks = new Map<string, DraftBlock>();
  const meshes: DraftMeshRef[] = [];
  const meshIndex = new Map<MeshData, number>();
  async function store(words: Words) {
    const key = await blockKey(words);
    if (!blocks.has(key)) blocks.set(key, { key, kind: words instanceof Float32Array ? 'f32' : 'u32', words });
    return key;
  }
  async function storeMesh(mesh: MeshData) {
    const known = meshIndex.get(mesh);
    if (known !== undefined) return known;
    check(mesh.positions instanceof Float32Array && mesh.indices instanceof Uint32Array);
    const ref: DraftMeshRef = { positions: await store(mesh.positions), indices: await store(mesh.indices) };
    if (mesh.normals) ref.normals = await store(mesh.normals);
    if (mesh.faceColors) {
      const packed = packColors(mesh.faceColors);
      ref.faceColors = { palette: packed.palette, indices: await store(packed.indices) };
    }
    meshIndex.set(mesh, meshes.length);
    return meshes.push(ref) - 1;
  }
  async function snapshot(s: ProjectSceneSnapshot): Promise<DraftSnapshot> {
    const objects: DraftObject[] = [];
    for (const obj of s.objects) {
      const { mesh, stats: _stats, ...metadata } = obj;
      objects.push({ ...metadata, mesh: await storeMesh(mesh) });
    }
    return {
      objects, selectedIds: [...s.selectedIds],
      ...(s.groups?.length ? { groups: s.groups } : {}),
      ...(s.plates?.length ? { plates: s.plates } : {}),
      ...(s.layout === 'assembly' ? { layout: s.layout } : {}),
    };
  }
  const { unitSystem, printerProfile, customBedDimensions, sectionPlane, snapGridMm } = doc;
  const current = await snapshot(doc);
  const past: DraftSnapshot[] = [];
  const future: DraftSnapshot[] = [];
  if (withHistory) {
    for (const s of doc.past) past.push(await snapshot(s));
    for (const s of doc.future) future.push(await snapshot(s));
  }
  const manifest: DraftManifest = {
    format: DRAFT_FORMAT,
    settings: { unitSystem, printerProfile, customBedDimensions, sectionPlane, snapGridMm },
    meshes, current, past, future,
  };
  return { manifest, blocks };
}

/** Claves de bloque que referencia un manifiesto (para limpiar huérfanos y leerlo). */
export function manifestBlockKeys(manifest: unknown): string[] {
  if (!record(manifest) || !Array.isArray(manifest.meshes)) return [];
  const keys = new Set<string>();
  for (const mesh of manifest.meshes as unknown[]) {
    if (!record(mesh)) continue;
    for (const key of [mesh.positions, mesh.indices, mesh.normals, record(mesh.faceColors) ? mesh.faceColors.indices : undefined]) {
      if (typeof key === 'string') keys.add(key);
    }
  }
  return [...keys];
}

export function isDraftManifest(value: unknown): value is DraftManifest {
  return record(value) && value.format === DRAFT_FORMAT;
}

/** Rearma y valida el documento a partir del manifiesto y sus bloques ya leídos. */
export function assembleDocument(manifest: unknown, blocks: Map<string, Words>): ProjectDocument {
  check(isDraftManifest(manifest) && validSettings(manifest.settings), 'draft');
  check(Array.isArray(manifest.meshes) && Array.isArray(manifest.past) && Array.isArray(manifest.future), 'draft');
  const block = (key: unknown) => {
    check(typeof key === 'string' && blocks.has(key), 'draft-block');
    return blocks.get(key as string)!;
  };
  const meshes = manifest.meshes.map((ref: unknown) => {
    check(record(ref), 'draft-mesh');
    const positions = block(ref.positions), indices = block(ref.indices);
    check(positions instanceof Float32Array && indices instanceof Uint32Array && positions.length % 3 === 0 && indices.length % 3 === 0);
    const vertices = positions.length / 3;
    for (const value of positions) check(Number.isFinite(value));
    for (const vertex of indices) check(vertex < vertices);
    const mesh: MeshData = { positions, indices };
    if (ref.normals !== undefined) {
      const normals = block(ref.normals);
      check(normals instanceof Float32Array && normals.length === positions.length);
      mesh.normals = normals;
    }
    if (ref.faceColors !== undefined) {
      check(record(ref.faceColors) && Array.isArray(ref.faceColors.palette));
      const palette = ref.faceColors.palette as unknown[];
      check(palette.every(color));
      const byFace = block(ref.faceColors.indices);
      check(byFace instanceof Uint32Array && byFace.length <= indices.length / 3);
      const colors = new Array<string>(byFace.length);
      for (let i = 0; i < byFace.length; i++) {
        check(byFace[i] <= palette.length);
        if (byFace[i] > 0) colors[i] = palette[byFace[i] - 1] as string;
      }
      mesh.faceColors = colors;
    }
    return { mesh, stats: computeMeshStats(mesh) };
  });
  function snapshot(s: unknown): ProjectSceneSnapshot {
    check(record(s) && Array.isArray(s.objects) && Array.isArray(s.selectedIds), 'draft-scene');
    const ids = new Set<string>();
    const objects: SceneObject[] = (s.objects as unknown[]).map((stored) => {
      check(validStoredObject(stored) && nat(stored.mesh) && stored.mesh < meshes.length && !ids.has(stored.id), 'draft-object');
      ids.add(stored.id);
      const { mesh, stats } = meshes[stored.mesh];
      const { mesh: _ref, ...metadata } = withBoundedParams(stored);
      return { ...metadata, mesh, stats: { ...stats, dimensionsMm: [...stats.dimensionsMm] } } as SceneObject;
    });
    const selectedIds = (s.selectedIds as unknown[]).filter((v): v is string => id(v) && ids.has(v));
    check(validStoredGroups(s.groups), 'draft-groups');
    check(validStoredPlates(s.plates), 'draft-plates');
    check(validStoredLayout(s.layout), 'draft-layout');
    const groups = (s.groups as SceneGroup[] | undefined) ?? [];
    const rawPlates = (s.plates as ScenePlate[] | undefined) ?? [];
    let scene = { objects, groups: [] as SceneGroup[], plates: [] as ScenePlate[] };
    if (groups.length || objects.some((o) => o.groupRef !== undefined)) scene = { ...scene, ...reconcileGroups({ objects, groups }) };
    if (rawPlates.length || scene.objects.some((o) => o.plateRef !== undefined)) {
      scene = { ...scene, ...reconcilePlates({ objects: scene.objects, plates: rawPlates }) };
    }
    return {
      objects: scene.objects, selectedIds,
      ...(scene.groups.length ? { groups: scene.groups } : {}),
      ...(scene.plates.length ? { plates: scene.plates } : {}),
      ...(s.layout === 'assembly' ? { layout: 'assembly' as const } : {}),
    };
  }
  return {
    ...manifest.settings,
    ...snapshot(manifest.current),
    past: manifest.past.map(snapshot),
    future: manifest.future.map(snapshot),
  };
}
