/**
 * @file src/project/projectRecoveryAutosave.test.ts
 * @description Pruebas del autoguardado de recuperación de proyectos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { fakeBox } from '../test/fakeObjects';
import { captureProject, useKuraStore, type KuraStoreState } from '../store/useKuraStore';
import { cleanupRecoveryStorage, writeRecoveryDocument } from './recoveryDraftStore';
import { startProjectRecovery } from './projectRecoveryAutosave';
import { discardRecoveryDraft } from './projectRecoveryStorage';

vi.mock('./recoveryDraftStore', async (original) => ({
  ...(await original<typeof import('./recoveryDraftStore')>()), writeRecoveryDocument: vi.fn(), cleanupRecoveryStorage: vi.fn(),
}));
vi.mock('./projectRecoveryStorage', () => ({ discardRecoveryDraft: vi.fn() }));

describe('project recovery autosave', () => {
  function cleanStore() {
    // Un objeto: una escena vacía no escribe borrador (recoveryEmptyDraft.test.ts).
  const initial = { ...useKuraStore.getInitialState(), engineReady: true, objects: [fakeBox('a', 'Caja 1')] };
    return createStore<KuraStoreState>()(() => ({ ...initial, savedProject: captureProject(initial) }));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.mocked(writeRecoveryDocument).mockResolvedValue({ blocksWritten: 0, bytesWritten: 0, historyDropped: false });
    vi.mocked(cleanupRecoveryStorage).mockResolvedValue({ removedBlocks: 0, removedDrafts: 0 });
    vi.mocked(discardRecoveryDraft).mockResolvedValue(true);
  });

  afterEach(() => vi.useRealTimers());

  it('coalesces edits and writes the latest document after idle', async () => {
    const store = cleanStore();
    const status = vi.fn();
    const controller = startProjectRecovery(status, store);

    store.setState({ unitSystem: 'cm' });
    await vi.advanceTimersByTimeAsync(1000);
    store.setState({ unitSystem: 'in' });
    await vi.advanceTimersByTimeAsync(1499);
    expect(writeRecoveryDocument).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(writeRecoveryDocument).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: store.getState().projectDraftId }),
      expect.objectContaining({ unitSystem: 'in' }),
    );
    expect(status).toHaveBeenLastCalledWith('ready');
    controller.stop();
  });

  it('discards the draft it was writing when a confirmed save leaves that scene clean', async () => {
    const store = cleanStore();
    const controller = startProjectRecovery(vi.fn(), store);
    let finishWriting!: () => void;
    vi.mocked(writeRecoveryDocument).mockImplementationOnce(() => new Promise((resolve) => {
      finishWriting = () => resolve({ blocksWritten: 0, bytesWritten: 0, historyDropped: false });
    }));

    store.setState({ unitSystem: 'cm' });
    await vi.advanceTimersByTimeAsync(1500);
    store.setState({ savedProject: captureProject(store.getState()) });
    finishWriting();
    await vi.runAllTimersAsync();
    expect(writeRecoveryDocument).toHaveBeenCalledOnce();
    expect(discardRecoveryDraft).toHaveBeenCalledExactlyOnceWith(store.getState().projectDraftId);
    controller.stop();
  });

  it('preserves the prior draft when writing fails and retries after another edit', async () => {
    const store = cleanStore();
    const status = vi.fn();
    const controller = startProjectRecovery(status, store);
    vi.mocked(writeRecoveryDocument).mockRejectedValueOnce(new Error('QuotaExceededError'));

    store.setState({ unitSystem: 'cm' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(status).toHaveBeenLastCalledWith('unavailable');
    expect(discardRecoveryDraft).not.toHaveBeenCalled();
    store.setState({ unitSystem: 'in' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(writeRecoveryDocument).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith('ready');
    controller.stop();
  });

  it('removes the checkpoint after an active write when the user explicitly closes and discards', async () => {
    const store = cleanStore();
    const controller = startProjectRecovery(vi.fn(), store);
    let commit!: () => void;
    vi.mocked(writeRecoveryDocument).mockImplementationOnce(() => new Promise(resolve => { commit = () => resolve({ blocksWritten: 0, bytesWritten: 0, historyDropped: false }); }));
    store.setState({ unitSystem: 'cm' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(writeRecoveryDocument).toHaveBeenCalledOnce();

    const closing = controller.discardOnClose();
    expect(discardRecoveryDraft).not.toHaveBeenCalled();
    commit();
    await closing;
    expect(discardRecoveryDraft).toHaveBeenCalledExactlyOnceWith(store.getState().projectDraftId);
    await vi.runAllTimersAsync();
    expect(writeRecoveryDocument).toHaveBeenCalledOnce();
  });
});
