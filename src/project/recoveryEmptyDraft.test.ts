/**
 * @file src/project/recoveryEmptyDraft.test.ts
 * @description Un borrador sin objetos no se guarda (el borrador previo de esa escena se descarta) ni
 * se ofrece en el aviso de «Borradores locales».
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
import { offerableRecoveryDrafts } from './recoveryOffer';
import { discardRecoveryDraft, type RecoveryDraftInfo } from './projectRecoveryStorage';

vi.mock('./recoveryDraftStore', async (original) => ({
  ...(await original<typeof import('./recoveryDraftStore')>()), writeRecoveryDocument: vi.fn(), cleanupRecoveryStorage: vi.fn(),
}));
vi.mock('./projectRecoveryStorage', () => ({ discardRecoveryDraft: vi.fn() }));

function storeWith(objects: KuraStoreState['objects']) {
  const initial = { ...useKuraStore.getInitialState(), engineReady: true, objects };
  return createStore<KuraStoreState>()(() => ({ ...initial, savedProject: captureProject(initial) }));
}

describe('borrador vacío', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.mocked(writeRecoveryDocument).mockResolvedValue({ blocksWritten: 0, bytesWritten: 0, historyDropped: false });
    vi.mocked(cleanupRecoveryStorage).mockResolvedValue({ removedBlocks: 0, removedDrafts: 0 });
    vi.mocked(discardRecoveryDraft).mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  it('una escena con cambios pero sin objetos no escribe borrador y descarta el anterior', async () => {
    const store = storeWith([fakeBox('a', 'Caja 1')]);
    const controller = startProjectRecovery(vi.fn(), store);
    store.setState({ objects: [] });
    await vi.advanceTimersByTimeAsync(9000);
    expect(writeRecoveryDocument).not.toHaveBeenCalled();
    expect(discardRecoveryDraft).toHaveBeenCalledWith(store.getState().projectDraftId);
    controller.stop();
  });

  it('con objetos sí escribe', async () => {
    const store = storeWith([]);
    const controller = startProjectRecovery(vi.fn(), store);
    store.setState({ objects: [fakeBox('a', 'Caja 1')] });
    await vi.advanceTimersByTimeAsync(9000);
    expect(writeRecoveryDocument).toHaveBeenCalledOnce();
    controller.stop();
  });

  it('el aviso no ofrece borradores de 0 objetos ni el del editor activo', () => {
    const drafts = [
      { id: 'vacio', updatedAt: 3, objectCount: 0 },
      { id: 'activo', updatedAt: 2, objectCount: 2 },
      { id: 'viejo', updatedAt: 1 },
      { id: 'bueno', updatedAt: 4, objectCount: 5 },
    ] as RecoveryDraftInfo[];
    expect(offerableRecoveryDrafts(drafts, ['activo']).map((d) => d.id)).toEqual(['viejo', 'bueno']);
  });
});
