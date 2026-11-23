/**
 * @file src/project/projectRecoveryFailure.test.ts
 * @description El autoguardado de recuperación conserva la causa tipada de un fallo (proyecto
 * demasiado grande, cuota del almacenamiento, almacenamiento ausente) para poder avisar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { captureProject, useKuraStore, type KuraStoreState } from '../store/useKuraStore';
import { cleanupRecoveryStorage, RecoveryQuotaError, writeRecoveryDocument } from './recoveryDraftStore';
import { classifyRecoveryFailure, startProjectRecovery } from './projectRecoveryAutosave';
import { discardRecoveryDraft } from './projectRecoveryStorage';
import { ProjectCodecError } from './projectSchema';

vi.mock('./recoveryDraftStore', async (original) => ({
  ...(await original<typeof import('./recoveryDraftStore')>()), writeRecoveryDocument: vi.fn(), cleanupRecoveryStorage: vi.fn(),
}));
vi.mock('./projectRecoveryStorage', () => ({ discardRecoveryDraft: vi.fn() }));

function cleanStore() {
  const initial = { ...useKuraStore.getInitialState(), engineReady: true };
  return createStore<KuraStoreState>()(() => ({ ...initial, savedProject: captureProject(initial) }));
}

describe('causa del fallo del autoguardado', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.mocked(writeRecoveryDocument).mockResolvedValue({ blocksWritten: 0, bytesWritten: 0, historyDropped: false });
    vi.mocked(cleanupRecoveryStorage).mockResolvedValue({ removedBlocks: 0, removedDrafts: 0 });
    vi.mocked(discardRecoveryDraft).mockResolvedValue(true);
  });

  afterEach(() => vi.useRealTimers());

  it('un documento inválido informa su causa del códec', async () => {
    const store = cleanStore();
    const status = vi.fn();
    const failure = vi.fn();
    vi.mocked(writeRecoveryDocument).mockRejectedValueOnce(new ProjectCodecError('invalid'));
    const controller = startProjectRecovery(status, store, undefined, failure);
    store.setState({ unitSystem: 'cm' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(status).toHaveBeenLastCalledWith('unavailable');
    expect(failure).toHaveBeenCalledExactlyOnceWith({ cause: 'invalid', stage: 'write' });
    controller.stop();
  });

  it('la cuota del navegador insuficiente informa quota con las cifras', async () => {
    const store = cleanStore();
    const failure = vi.fn();
    vi.mocked(writeRecoveryDocument).mockRejectedValueOnce(new RecoveryQuotaError(300e6, 120e6));
    const controller = startProjectRecovery(vi.fn(), store, undefined, failure);
    store.setState({ unitSystem: 'cm' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(failure).toHaveBeenCalledExactlyOnceWith({ cause: 'quota', stage: 'write', neededBytes: 300e6, availableBytes: 120e6 });
    controller.stop();
  });

  it('la cuota agotada al escribir informa quota', async () => {
    const store = cleanStore();
    const failure = vi.fn();
    vi.mocked(writeRecoveryDocument).mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    const controller = startProjectRecovery(vi.fn(), store, undefined, failure);
    store.setState({ unitSystem: 'cm' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(failure).toHaveBeenCalledExactlyOnceWith({ cause: 'quota', stage: 'write' });
    controller.stop();
  });

  it('clasifica cada error en una causa estable', () => {
    expect(classifyRecoveryFailure(new ProjectCodecError('invalid'), 'encode')).toEqual({ cause: 'invalid', stage: 'encode' });
    expect(classifyRecoveryFailure(new DOMException('x', 'QuotaExceededError'), 'write').cause).toBe('quota');
    expect(classifyRecoveryFailure(new Error('Local recovery storage is unavailable.'), 'write').cause).toBe('storage');
    expect(classifyRecoveryFailure(new Error('boom'), 'encode').cause).toBe('unknown');
    expect(classifyRecoveryFailure('raro', 'cleanup')).toEqual({ cause: 'storage', stage: 'cleanup' });
  });
});
