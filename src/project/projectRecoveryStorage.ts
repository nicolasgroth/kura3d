/**
 * @file src/project/projectRecoveryStorage.ts
 * @description Almacenamiento local en IndexedDB de borradores de recuperación de proyectos.
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

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) throw new Error('Local recovery storage is unavailable.');
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore(INFO, { keyPath: 'id' });
      request.result.createObjectStore(DATA);
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

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(
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

function checkInfo({ id, name, updatedAt }: RecoveryDraftInfo) {
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
  return transaction([INFO, DATA], 'readwrite', async tx => {
    const metadata = tx.objectStore(INFO);
    const info: RecoveryDraftInfo | undefined = await result(metadata.get(id));
    if (!info || (expectedUpdatedAt !== undefined && info.updatedAt !== expectedUpdatedAt)) return false;
    metadata.delete(id);
    tx.objectStore(DATA).delete(id);
    return true;
  });
}

export function moveRecoveryDraft(from: { id: string; updatedAt: number }, destinationId: string): Promise<boolean> {
  return transaction([INFO, DATA], 'readwrite', async tx => {
    const metadata = tx.objectStore(INFO);
    const data = tx.objectStore(DATA);
    const info: RecoveryDraftInfo | undefined = await result(metadata.get(from.id));
    if (!info || info.updatedAt !== from.updatedAt) return false;
    if (from.id === destinationId) return true;
    const destination = { id: destinationId, name: info.name, updatedAt: info.updatedAt };
    checkInfo(destination);
    const bytes: unknown = await result(data.get(from.id));
    checkBytes(bytes);
    metadata.add(destination);
    data.add(bytes, destinationId);
    metadata.delete(from.id);
    data.delete(from.id);
    return true;
  });
}
