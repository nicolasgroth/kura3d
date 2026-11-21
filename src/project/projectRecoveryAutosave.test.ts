import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { captureProject, useKuraStore, type KuraStoreState } from '../store/useKuraStore';
import { encodeProjectAsync } from './projectCodecClient';
import { startProjectRecovery } from './projectRecoveryAutosave';
import { discardRecoveryDraft, writeRecoveryDraft } from './projectRecoveryStorage';

vi.mock('./projectCodecClient', () => ({ encodeProjectAsync: vi.fn() }));
vi.mock('./projectRecoveryStorage', () => ({ discardRecoveryDraft: vi.fn(), writeRecoveryDraft: vi.fn() }));

describe('project recovery autosave', () => {
  function cleanStore() {
    const initial = { ...useKuraStore.getInitialState(), engineReady: true };
    return createStore<KuraStoreState>()(() => ({ ...initial, savedProject: captureProject(initial) }));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.mocked(encodeProjectAsync).mockResolvedValue(new Uint8Array([1, 2]));
    vi.mocked(writeRecoveryDraft).mockResolvedValue(undefined);
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
    expect(writeRecoveryDraft).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(encodeProjectAsync).toHaveBeenCalledWith(expect.objectContaining({ unitSystem: 'in' }));
    expect(writeRecoveryDraft).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      id: store.getState().projectDraftId, bytes: new Uint8Array([1, 2]),
    }));
    expect(status).toHaveBeenLastCalledWith('ready');
    controller.stop();
  });

  it('never writes an encoded draft after a confirmed save leaves that scene clean', async () => {
    const store = cleanStore();
    const controller = startProjectRecovery(vi.fn(), store);
    let finishEncoding!: (bytes: Uint8Array) => void;
    vi.mocked(encodeProjectAsync).mockImplementationOnce(() => new Promise((resolve) => {
      finishEncoding = resolve;
    }));

    store.setState({ unitSystem: 'cm' });
    await vi.advanceTimersByTimeAsync(1500);
    store.setState({ savedProject: captureProject(store.getState()) });
    finishEncoding(new Uint8Array([8]));
    await vi.runAllTimersAsync();
    expect(writeRecoveryDraft).not.toHaveBeenCalled();
    expect(discardRecoveryDraft).toHaveBeenCalledExactlyOnceWith(store.getState().projectDraftId);
    controller.stop();
  });

  it('preserves the prior draft when writing fails and retries after another edit', async () => {
    const store = cleanStore();
    const status = vi.fn();
    const controller = startProjectRecovery(status, store);
    vi.mocked(writeRecoveryDraft).mockRejectedValueOnce(new Error('QuotaExceededError'));

    store.setState({ unitSystem: 'cm' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(status).toHaveBeenLastCalledWith('unavailable');
    expect(discardRecoveryDraft).not.toHaveBeenCalled();
    store.setState({ unitSystem: 'in' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(writeRecoveryDraft).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith('ready');
    controller.stop();
  });

  it('removes the checkpoint after an active write when the user explicitly closes and discards', async () => {
    const store = cleanStore();
    const controller = startProjectRecovery(vi.fn(), store);
    let commit!: () => void;
    vi.mocked(writeRecoveryDraft).mockImplementationOnce(() => new Promise(resolve => { commit = resolve; }));
    store.setState({ unitSystem: 'cm' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(writeRecoveryDraft).toHaveBeenCalledOnce();

    const closing = controller.discardOnClose();
    expect(discardRecoveryDraft).not.toHaveBeenCalled();
    commit();
    await closing;
    expect(discardRecoveryDraft).toHaveBeenCalledExactlyOnceWith(store.getState().projectDraftId);
    await vi.runAllTimersAsync();
    expect(writeRecoveryDraft).toHaveBeenCalledOnce();
  });
});
