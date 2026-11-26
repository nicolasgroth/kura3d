/**
 * @file src/store/__tests__/saveProgress.store.test.ts
 * @description Avance del guardado en el store: el porcentaje del Worker llega a `busyProgress` (con la fase de
 * escritura al final), no toca `busyOperation`, no pisa otra operación y se retira en éxito, error y cancelación.
 * El archivo que se escribe es exactamente el que entrega el códec.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeProjectAsync } from '../../project/projectCodecClient';
import { saveProjectFile } from '../../project/projectFiles';
import { parseSavePhase, SAVE_OPERATION, trackSaveProgress } from '../saveProgress';
import type { BusyProgress } from '../storeTypes';
import { useKuraStore } from '../useKuraStore';

vi.mock('../../project/projectCodecClient', async (importActual) => ({
  ...(await importActual<typeof import('../../project/projectCodecClient')>()),
  encodeProjectAsync: vi.fn(),
}));
vi.mock('../../project/projectFiles', async (importActual) => ({
  ...(await importActual<typeof import('../../project/projectFiles')>()),
  saveProjectFile: vi.fn(),
}));

const get = useKuraStore.getState;
const FILE = Uint8Array.from([75, 85, 82, 65, 6, 0, 0, 0]);
let baseline: ReturnType<typeof get>;
let seen: (BusyProgress | null)[];
let written: Uint8Array | undefined;

beforeAll(() => { baseline = get(); });

beforeEach(() => {
  vi.resetAllMocks();
  useKuraStore.setState({ ...baseline, engineReady: true, busyOperation: null, busyProgress: null, toasts: [] }, true);
  seen = [];
  written = undefined;
  vi.mocked(encodeProjectAsync).mockImplementation(async (_doc, onProgress) => {
    for (const [percent, phase] of [[0, 'encode'], [25, 'compress'], [60, 'compress'], [100, 'compress']] as const) {
      onProgress?.(percent, phase);
      seen.push(get().busyProgress);
    }
    return FILE;
  });
});

/** `saveProjectFile` de prueba: codifica como el real y luego termina con `finish`. */
function saveThen(finish: () => unknown) {
  vi.mocked(saveProjectFile).mockImplementation(async (_name, data) => {
    written = typeof data === 'function' ? await data() : data;
    seen.push(get().busyProgress);
    return finish() as Awaited<ReturnType<typeof saveProjectFile>>;
  });
}

describe('avance del guardado en el store', () => {
  it('éxito: porcentajes crecientes hasta 100, fase de escritura, mismo archivo y se retira', async () => {
    saveThen(() => ({ name: 'a.kura', location: 'C:/a.kura' }));
    expect(await get().saveProject()).toBe(true);
    const steps = seen.map((p) => parseSavePhase(p?.phase));
    expect(steps.map((s) => s?.percent)).toEqual([0, 25, 60, 100, 100]);
    expect(steps.at(-1)?.step).toBe('write');
    expect(seen.every((p) => p?.name === SAVE_OPERATION && !p.cancellable)).toBe(true);
    expect(new Set(seen.map((p) => p?.startedAt)).size).toBe(1);
    expect(written).toBe(FILE);
    expect(get().busyProgress).toBeNull();
    expect(get().busyOperation).toBeNull();
  });

  it('error y cancelación también retiran el avance', async () => {
    saveThen(() => { throw new Error('disco lleno'); });
    expect(await get().saveProject()).toBe(false);
    expect(seen.length).toBeGreaterThan(0);
    expect(get().busyProgress).toBeNull();
    saveThen(() => null);
    expect(await get().saveProject()).toBe(false);
    expect(get().busyProgress).toBeNull();
  });

  it('no pisa ni retira el avance de otra operación', () => {
    const other: BusyProgress = { name: 'plane_cut', phase: null, startedAt: 1, cancellable: true };
    useKuraStore.setState({ busyProgress: other });
    const tracker = trackSaveProgress(get, useKuraStore.setState);
    tracker.update(50, 'compress');
    tracker.writing();
    tracker.end();
    expect(get().busyProgress).toBe(other);
  });
});
