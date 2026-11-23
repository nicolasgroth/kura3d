/**
 * @file src/project/projectRecoveryStorage.ts
 * @description Almacenamiento local en IndexedDB de borradores de recuperación de proyectos. Esquema v2:
 * `drafts` (metadatos), `projectBytes` (borradores antiguos: un .kura entero, solo lectura y migración),
 * `draftManifests` (borrador nuevo: escena e historial sin geometría) y `meshBlocks` (cada bloque de
 * geometría una sola vez, binario, con clave por huella de contenido; ver `recoveryDraftStore.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MAX_PROJECT_BYTES, ProjectCodecError } from './projectSchema';

export interface RecoveryDraftInfo {
  id: string;
  name: string | null;
  updatedAt: number;
}

export interface RecoveryDraft extends RecoveryDraftInfo {
  bytes: Uint8Array;
}

const DATABASE = 'kura3d-project-recovery';
const INFO = 'drafts';
const DATA = 'projectBytes';
/** Manifiesto del borrador v2 (escena, historial y ajustes; la geometría va por referencia). */
export const MANIFESTS = 'draftManifests';
/** Bloques binarios de geometría compartidos entre borradores (clave = huella de contenido). */
export const BLOCKS = 'meshBlocks';
const DB_VERSION = 2;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) throw new Error('Local recovery storage is unavailable.');
    const request = indexedDB.open(DATABASE, DB_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      // Migración aditiva: los borradores v1 (`projectBytes`) se conservan y se siguen leyendo.
      const db = request.result;
      const names = db.objectStoreNames;
      if (!names?.contains?.(INFO)) db.createObjectStore(INFO, { keyPath: 'id' });
      if (!names?.contains?.(DATA)) db.createObjectStore(DATA);
      if (!names?.contains?.(MANIFESTS)) db.createObjectStore(MANIFESTS);
      if (!names?.contains?.(BLOCKS)) db.createObjectStore(BLOCKS);
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Another window is blocking access to local recovery storage.'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function transaction<T>(
  stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(stores, mode, { durability: mode === 'readwrite' ? 'strict' : 'default' });
    const committed = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Recovery transaction was aborted.'));
    });
    try {
      // A successful individual request does not guarantee the write reached storage.
      const [value] = await Promise.all([work(tx), committed]);
      return value;
    } catch (error) {
      try { tx.abort(); } catch { /* It may have already aborted. */ }
      await committed.catch(() => undefined);
      throw error;
    }
  } finally {
    db.close();
  }
}

export function checkInfo({ id, name, updatedAt }: RecoveryDraftInfo) {
  if (typeof id !== 'string' || !id.length || id.length > 256 || /[/\\\u0000]/.test(id)
    || !(name === null || (typeof name === 'string' && !/[/\\\u0000]/.test(name)))
    || !Number.isSafeInteger(updatedAt) || updatedAt < 0) {
    throw new Error('Invalid recovery draft metadata.');
  }
}

function checkBytes(bytes: unknown): asserts bytes is Uint8Array {
  if (!(bytes instanceof Uint8Array)) throw new Error('Recovery draft has no project data.');
  if (bytes.byteLength > MAX_PROJECT_BYTES) throw new ProjectCodecError('too-large');
}

export function listRecoveryDrafts(): Promise<RecoveryDraftInfo[]> {
  return transaction([INFO], 'readonly', async tx => {
    const drafts: RecoveryDraftInfo[] = await result(tx.objectStore(INFO).getAll());
    return drafts.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  });
}

export function readRecoveryDraft(id: string): Promise<RecoveryDraft | null> {
  return transaction([INFO, DATA], 'readonly', async tx => {
    const info: RecoveryDraftInfo | undefined = await result(tx.objectStore(INFO).get(id));
    if (!info) return null;
    const bytes: unknown = await result(tx.objectStore(DATA).get(id));
    checkBytes(bytes);
    return { ...info, bytes };
  });
}

export async function writeRecoveryDraft({ id, name, updatedAt, bytes }: RecoveryDraft): Promise<void> {
  const info = { id, name, updatedAt };
  checkInfo(info);
  checkBytes(bytes);
  // A sliced view can retain unrelated bytes in its backing buffer; persist only the file.
  const data = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer
    ? bytes : new Uint8Array(bytes);
  await transaction([INFO, DATA], 'readwrite', async tx => {
    tx.objectStore(INFO).put(info);
    tx.objectStore(DATA).put(data, id);
  });
}

export function discardRecoveryDraft(id: string, expectedUpdatedAt?: number): Promise<boolean> {
  return transaction([INFO, DATA, MANIFESTS], 'readwrite', async tx => {
    const metadata = tx.objectStore(INFO);
    const info: RecoveryDraftInfo | undefined = await result(metadata.get(id));
    if (!info || (expectedUpdatedAt !== undefined && info.updatedAt !== expectedUpdatedAt)) return false;
    metadata.delete(id);
    tx.objectStore(DATA).delete(id);
    // Los bloques de geometría que queden sin referencia los limpia `recoveryDraftStore`.
    tx.objectStore(MANIFESTS).delete(id);
    return true;
  });
}

export function moveRecoveryDraft(from: { id: string; updatedAt: number }, destinationId: string): Promise<boolean> {
  return transaction([INFO, DATA, MANIFESTS], 'readwrite', async tx => {
    const metadata = tx.objectStore(INFO);
    const data = tx.objectStore(DATA);
    const manifests = tx.objectStore(MANIFESTS);
    const info: RecoveryDraftInfo | undefined = await result(metadata.get(from.id));
    if (!info || info.updatedAt !== from.updatedAt) return false;
    if (from.id === destinationId) return true;
    const destination = { id: destinationId, name: info.name, updatedAt: info.updatedAt };
    checkInfo(destination);
    const manifest: unknown = await result(manifests.get(from.id));
    if (manifest !== undefined) {
      // Borrador v2: se mueve solo el manifiesto; los bloques de geometría son compartidos.
      metadata.add(destination);
      manifests.add(manifest, destinationId);
      metadata.delete(from.id);
      manifests.delete(from.id);
      return true;
    }
    const bytes: unknown = await result(data.get(from.id));
    checkBytes(bytes);
    metadata.add(destination);
    data.add(bytes, destinationId);
    metadata.delete(from.id);
    data.delete(from.id);
    return true;
  });
}
