/**
 * @file src/project/recoveryDraftStore.ts
 * @description Escritura y lectura del borrador de recuperación v2 en IndexedDB: cada bloque de
 * geometría se guarda una sola vez (binario, clave por huella de contenido) y el borrador solo lleva
 * un manifiesto que lo referencia. Respeta la cuota real del navegador (`navigator.storage.estimate`),
 * escribe por trozos (una transacción por bloque, cediendo el hilo) y limpia bloques huérfanos y
 * borradores viejos. Lee también los borradores v1 (un .kura entero) para migrarlos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { decodeProjectAsync } from './projectCodecClient';
import type { ProjectDocument } from './projectSchema';
import {
  BLOCKS, checkInfo, MANIFESTS, readRecoveryDraft, result, transaction, type RecoveryDraftInfo,
} from './projectRecoveryStorage';
import {
  assembleDocument, blockBytes, isDraftManifest, manifestBlockKeys, splitDocument, type DraftBlock,
} from './recoveryDraftFormat';

/** Bloque guardado: binario más datos para limpiar huérfanos. */
interface StoredBlock { kind: 'f32' | 'u32'; data: ArrayBuffer; owner: string; writtenAt: number }

/** El borrador no cabe en la cuota del navegador: lleva las cifras para explicarlo. */
export class RecoveryQuotaError extends Error {
  constructor(public readonly neededBytes: number, public readonly availableBytes: number) {
    super('The recovery draft does not fit in the browser storage quota.');
    this.name = 'RecoveryQuotaError';
  }
}

const SESSION = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
/** Huérfanos de otras pestañas se respetan este tiempo (pueden estar a mitad de escribir su manifiesto). */
const FOREIGN_ORPHAN_GRACE_MS = 10 * 60_000;
/** Borradores sin tocar por más de esto se borran al limpiar (y sus bloques con ellos). */
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60_000;
/** Margen que se deja libre en la cuota (los navegadores fallan antes de llegar al 100 %). */
const QUOTA_HEADROOM = 0.9;

/** Bloques que esta sesión sabe que ya están guardados (evita consultar IndexedDB por cada uno). */
const persisted = new Set<string>();

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const estimate = await globalThis.navigator?.storage?.estimate?.();
    if (!estimate || !Number.isFinite(estimate.quota) || !estimate.quota) return null;
    return { usage: estimate.usage ?? 0, quota: estimate.quota };
  } catch {
    return null;
  }
}

async function missingBlocks(blocks: Map<string, DraftBlock>) {
  const unknown = [...blocks.values()].filter((block) => !persisted.has(block.key));
  if (!unknown.length) return [];
  const present = await transaction([BLOCKS], 'readonly', async (tx) => {
    const store = tx.objectStore(BLOCKS);
    return Promise.all(unknown.map((block) => result(store.getKey(block.key))));
  });
  return unknown.filter((block, i) => {
    if (present[i] === undefined) return true;
    persisted.add(block.key);
    return false;
  });
}

function copyBuffer(words: DraftBlock['words']): ArrayBuffer {
  const out = new ArrayBuffer(words.byteLength);
  new Uint8Array(out).set(new Uint8Array(words.buffer, words.byteOffset, words.byteLength));
  return out;
}

export interface DraftWriteResult { blocksWritten: number; bytesWritten: number; historyDropped: boolean }

/**
 * Escribe el borrador: primero los bloques nuevos (uno por transacción), luego el manifiesto y los
 * metadatos juntos. Si con historial no cabe en la cuota, lo intenta sin deshacer/rehacer; si
 * tampoco, lanza `RecoveryQuotaError` sin tocar el borrador anterior.
 */
export async function writeRecoveryDocument(info: RecoveryDraftInfo, document: ProjectDocument): Promise<DraftWriteResult> {
  checkInfo(info);
  let split = await splitDocument(document, true);
  let toWrite = await missingBlocks(split.blocks);
  let historyDropped = false;
  const estimate = await storageEstimate();
  if (estimate) {
    const free = () => Math.max(0, estimate.quota * QUOTA_HEADROOM - estimate.usage);
    if (blockBytes(toWrite) > free()) {
      await cleanupRecoveryStorage({ ownOrphansNow: true });
      const fresh = await storageEstimate();
      if (fresh) Object.assign(estimate, fresh);
    }
    if (blockBytes(toWrite) > free() && (document.past.length || document.future.length)) {
      split = await splitDocument(document, false);
      toWrite = await missingBlocks(split.blocks);
      historyDropped = true;
    }
    if (blockBytes(toWrite) > free()) throw new RecoveryQuotaError(blockBytes(toWrite), free());
  }
  let bytesWritten = 0;
  for (const block of toWrite) {
    const record: StoredBlock = { kind: block.kind, data: copyBuffer(block.words), owner: SESSION, writtenAt: Date.now() };
    await transaction([BLOCKS], 'readwrite', async (tx) => { tx.objectStore(BLOCKS).put(record, block.key); });
    persisted.add(block.key);
    bytesWritten += block.words.byteLength;
    await yieldToUi();
  }
  await transaction(['drafts', 'projectBytes', MANIFESTS], 'readwrite', async (tx) => {
    tx.objectStore('drafts').put({ id: info.id, name: info.name, updatedAt: info.updatedAt });
    tx.objectStore(MANIFESTS).put(split.manifest, info.id);
    // Migración: un borrador v1 con el mismo id queda reemplazado por el v2.
    tx.objectStore('projectBytes').delete(info.id);
  });
  return { blocksWritten: toWrite.length, bytesWritten, historyDropped };
}

export interface LoadedRecoveryDraft extends RecoveryDraftInfo { document: ProjectDocument }

/** Lee un borrador (v2 o v1) y devuelve el documento validado, o null si ya no existe. */
export async function loadRecoveryDocument(id: string): Promise<LoadedRecoveryDraft | null> {
  const v2 = await transaction(['drafts', MANIFESTS], 'readonly', async (tx) => {
    const info: RecoveryDraftInfo | undefined = await result(tx.objectStore('drafts').get(id));
    if (!info) return { info: null, manifest: undefined };
    const manifest: unknown = await result(tx.objectStore(MANIFESTS).get(id));
    return { info, manifest };
  });
  if (!v2.info) return null;
  if (v2.manifest === undefined) {
    // Borrador v1: un .kura completo. Al recuperarlo, el autoguardado lo reescribe en v2.
    const legacy = await readRecoveryDraft(id);
    if (!legacy) return null;
    const { bytes, ...info } = legacy;
    return { ...info, document: await decodeProjectAsync(bytes) };
  }
  if (!isDraftManifest(v2.manifest)) throw new Error('Unsupported recovery draft.');
  const keys = manifestBlockKeys(v2.manifest);
  const blocks = new Map<string, Float32Array | Uint32Array>();
  for (const key of keys) {
    const stored: StoredBlock | undefined = await transaction([BLOCKS], 'readonly', async (tx) => result(tx.objectStore(BLOCKS).get(key)));
    if (!stored || !(stored.data instanceof ArrayBuffer) || stored.data.byteLength % 4 !== 0) continue;
    blocks.set(key, stored.kind === 'f32' ? new Float32Array(stored.data) : new Uint32Array(stored.data));
    persisted.add(key);
  }
  return { ...v2.info, document: assembleDocument(v2.manifest, blocks) };
}

/**
 * Borra borradores de más de 30 días y bloques que ningún manifiesto referencia. Los huérfanos de
 * otra pestaña se respetan unos minutos; los de esta sesión, con `ownOrphansNow`, se borran ya.
 */
export async function cleanupRecoveryStorage({ ownOrphansNow = false, now = Date.now() } = {}) {
  const stale = await transaction(['drafts'], 'readonly', async (tx) => {
    const drafts: RecoveryDraftInfo[] = await result(tx.objectStore('drafts').getAll());
    return drafts.filter((d) => now - d.updatedAt > DRAFT_MAX_AGE_MS).map((d) => d.id);
  });
  if (stale.length) {
    await transaction(['drafts', 'projectBytes', MANIFESTS], 'readwrite', async (tx) => {
      for (const id of stale) {
        tx.objectStore('drafts').delete(id);
        tx.objectStore('projectBytes').delete(id);
        tx.objectStore(MANIFESTS).delete(id);
      }
    });
  }
  return transaction([MANIFESTS, BLOCKS], 'readwrite', async (tx) => {
    const manifests: unknown[] = await result(tx.objectStore(MANIFESTS).getAll());
    const referenced = new Set(manifests.flatMap(manifestBlockKeys));
    const store = tx.objectStore(BLOCKS);
    const keys = (await result(store.getAllKeys())) as string[];
    let removed = 0;
    for (const key of keys) {
      if (referenced.has(key)) continue;
      const block: StoredBlock | undefined = await result(store.get(key));
      const own = block?.owner === SESSION;
      if (!block || (own && ownOrphansNow) || now - block.writtenAt > FOREIGN_ORPHAN_GRACE_MS) {
        store.delete(key);
        persisted.delete(key);
        removed += 1;
      }
    }
    return { removedBlocks: removed, removedDrafts: stale.length };
  });
}

/** Solo para pruebas: olvida qué bloques se dieron por guardados. */
export function resetRecoveryDraftCache() {
  persisted.clear();
}
