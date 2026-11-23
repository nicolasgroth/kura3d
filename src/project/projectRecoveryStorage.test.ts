/**
 * @file src/project/projectRecoveryStorage.test.ts
 * @description Pruebas del almacenamiento local (IndexedDB) de borradores de recuperación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  discardRecoveryDraft, listRecoveryDrafts, moveRecoveryDraft,
  readRecoveryDraft, writeRecoveryDraft, type RecoveryDraftInfo,
} from './projectRecoveryStorage';
import { MAX_PROJECT_BYTES } from './projectSchema';

const info: RecoveryDraftInfo = { id: 'session-a', name: 'modelo.kura', updatedAt: 100 };

// Drive the commit and abort events independently of individual requests.
// Browser integration exercises actual IndexedDB locking, persistence and rollback.
function database(rows: RecoveryDraftInfo[] = [info], bytes = new Uint8Array([1, 2, 3])) {
  function success<T>(value: T) {
    const request = { result: value, onsuccess: () => {} };
    queueMicrotask(() => request.onsuccess());
    return request;
  }
  const metadata = {
    getAll: vi.fn(() => success([...rows])),
    get: vi.fn((id: string) => success(rows.find(r => r.id === id))),
    put: vi.fn(), add: vi.fn(), delete: vi.fn(),
  };
  const data = { get: vi.fn(() => success(bytes)), put: vi.fn(), add: vi.fn(), delete: vi.fn() };
  const tx = {
    objectStore: vi.fn((name: string) => name === 'drafts' ? metadata : data),
    oncomplete: () => {}, onabort: () => {}, error: null as Error | null,
    abort: vi.fn(),
  };
  const db = { transaction: vi.fn(() => tx), close: vi.fn() };
  vi.stubGlobal('indexedDB', { open: () => success(db) });
  // IDB delivers a commit/abort in a later task, after request microtasks complete.
  const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  return { metadata, data, tx, db, flush };
}

afterEach(() => vi.unstubAllGlobals());

describe('local project recovery storage', () => {
  it('lists only metadata, newest first', async () => {
    const other = { ...info, id: 'session-b', updatedAt: 200 };
    const { tx, db, flush } = database([info, other]);
    const result = listRecoveryDrafts();
    await flush();
    expect(db.transaction.mock.calls[0]).toEqual([['drafts'], 'readonly', { durability: 'default' }]);
    expect(tx.objectStore).toHaveBeenCalledExactlyOnceWith('drafts');
    tx.oncomplete();
    await expect(result).resolves.toEqual([other, info]);
  });

  it('persists just the named file bytes and metadata and waits for commit', async () => {
    const { metadata, data, tx, flush, db } = database();
    const view = new Uint8Array([99, 3, 4, 88]).subarray(1, 3);
    const extra = { ...info, bytes: view, handle: { token: 'not part of a draft' } };
    const result = writeRecoveryDraft(extra);
    await flush();
    expect(metadata.put).toHaveBeenCalledExactlyOnceWith(info);
    expect(data.put).toHaveBeenCalledExactlyOnceWith(new Uint8Array([3, 4]), info.id);
    const stored = vi.mocked(data.put).mock.calls[0] as unknown as [Uint8Array, string];
    expect(stored[0].buffer.byteLength).toBe(2);
    expect(db.close).not.toHaveBeenCalled();
    tx.oncomplete();
    await expect(result).resolves.toBeUndefined();
    expect(db.close).toHaveBeenCalledOnce();
  });

  it('propagates a failed commit even after the writes were accepted', async () => {
    const { tx, db, flush } = database();
    const result = writeRecoveryDraft({ ...info, bytes: new Uint8Array([7]) });
    const expected = expect(result).rejects.toMatchObject({ name: 'QuotaExceededError' });
    await flush();
    tx.error = new DOMException('full', 'QuotaExceededError');
    tx.onabort();
    await expected;
    expect(db.close).toHaveBeenCalledOnce();
  });

  it('checks source timestamps before deleting or moving a draft', async () => {
    for (const action of [
      () => discardRecoveryDraft(info.id, info.updatedAt - 1),
      () => moveRecoveryDraft({ id: info.id, updatedAt: info.updatedAt - 1 }, 'new'),
    ]) {
      const { tx, data, metadata, flush } = database();
      const result = action();
      await flush();
      expect(metadata.delete).not.toHaveBeenCalled();
      expect(data.get).not.toHaveBeenCalled();
      expect(data.delete).not.toHaveBeenCalled();
      tx.oncomplete();
      await expect(result).resolves.toBe(false);
    }
  });

  it('claims and deletes in one readwrite transaction using insert-only destination writes', async () => {
    const { tx, db, metadata, data, flush } = database();
    const result = moveRecoveryDraft(info, 'next');
    await flush();
    expect(db.transaction.mock.calls).toEqual([[['drafts', 'projectBytes', 'draftManifests'], 'readwrite', { durability: 'strict' }]]);
    expect(metadata.add).toHaveBeenCalledExactlyOnceWith({ ...info, id: 'next' });
    expect(data.add).toHaveBeenCalledExactlyOnceWith(new Uint8Array([1, 2, 3]), 'next');
    expect(metadata.delete).toHaveBeenCalledExactlyOnceWith(info.id);
    expect(data.delete).toHaveBeenCalledExactlyOnceWith(info.id);
    tx.oncomplete();
    await expect(result).resolves.toBe(true);
  });

  it('reads a single snapshot and returns null for a missing session', async () => {
    for (const id of [info.id, 'gone']) {
      const { tx, data, flush } = database();
      const result = readRecoveryDraft(id);
      await flush();
      tx.oncomplete();
      if (id === info.id) {
        await expect(result).resolves.toEqual({ ...info, bytes: new Uint8Array([1, 2, 3]) });
      } else {
        expect(data.get).not.toHaveBeenCalled();
        await expect(result).resolves.toBeNull();
      }
    }
  });

  it('rejects paths, oversize buffers and unavailable storage', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const bytes = new Uint8Array(1);
    await expect(writeRecoveryDraft({ ...info, name: 'folder/file.kura', bytes })).rejects.toThrow('metadata');
    Object.defineProperty(bytes, 'byteLength', { value: MAX_PROJECT_BYTES + 1 });
    await expect(writeRecoveryDraft({ ...info, bytes })).rejects.toMatchObject({ code: 'too-large' });
    await expect(listRecoveryDrafts()).rejects.toThrow('unavailable');
  });
});
