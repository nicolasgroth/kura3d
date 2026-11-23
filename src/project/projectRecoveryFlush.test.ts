/**
 * @file src/project/projectRecoveryFlush.test.ts
 * @description Borrador de recuperación a pedido antes de una operación pesada (importar un modelo
 * grande): se escribe al momento aunque la app esté ocupada, no se repite si ya está escrito, y el
 * registro global deja que la importación lo pida sin conocer el hook de React.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { captureProject, useKuraStore, type KuraStoreState } from '../store/useKuraStore';
import { encodeProjectAsync } from './projectCodecClient';
import { startProjectRecovery } from './projectRecoveryAutosave';
import { flushRecoveryDraft, registerRecoveryFlush } from './recoveryFlush';
import { discardRecoveryDraft, writeRecoveryDraft } from './projectRecoveryStorage';

vi.mock('./projectCodecClient', () => ({ encodeProjectAsync: vi.fn() }));
vi.mock('./projectRecoveryStorage', () => ({ discardRecoveryDraft: vi.fn(), writeRecoveryDraft: vi.fn() }));

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

afterEach(() => {
  registerRecoveryFlush(null);
  vi.useRealTimers();
});

describe('borrador de recuperación a pedido', () => {
  it('escribe al momento los cambios pendientes, aunque la app esté ocupada importando', async () => {
    const store = cleanStore();
    const controller = startProjectRecovery(vi.fn(), store);
    store.setState({ unitSystem: 'cm', busyOperation: 'import_mesh' } as Partial<KuraStoreState>);
    expect(writeRecoveryDraft).not.toHaveBeenCalled();
    await controller.flushNow();
    expect(writeRecoveryDraft).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: store.getState().projectDraftId }));
    // Ya escrito: no se repite ni al pedirlo otra vez ni al vencer el plazo normal.
    await controller.flushNow();
    store.setState({ busyOperation: null } as Partial<KuraStoreState>);
    await vi.runAllTimersAsync();
    expect(writeRecoveryDraft).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('sin cambios sin guardar no escribe nada', async () => {
    const store = cleanStore();
    const controller = startProjectRecovery(vi.fn(), store);
    await controller.flushNow();
    expect(encodeProjectAsync).not.toHaveBeenCalled();
    controller.stop();
  });

  it('el registro global lo expone a la importación; sin registro no hace nada', async () => {
    expect(await flushRecoveryDraft()).toBe(false);
    const flush = vi.fn(async () => {});
    registerRecoveryFlush(flush);
    expect(await flushRecoveryDraft()).toBe(true);
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
