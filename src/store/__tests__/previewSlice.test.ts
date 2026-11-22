/**
 * @file src/store/__tests__/previewSlice.test.ts
 * @description Vista previa de operaciones: debounce, descarte de resultados obsoletos, estado
 * anterior conservado mientras calcula y limpieza al cerrar o cambiar la selección.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineClient } from '../../core/operations/engineClient';
import { fakeBox } from '../../test/fakeObjects';
import { setStoreEngineClient } from '../storeContext';
import { EMPTY_PREVIEW } from '../slices/previewSlice';
import { useKuraStore } from '../useKuraStore';

type Resolver = (value: unknown) => void;
let calls: Array<{ name: string; args: unknown; resolve: Resolver }>;

const fakeClient: EngineClient = {
  run: ((_ctx: unknown, name: string, args: unknown) => {
    let resolve: Resolver = () => {};
    const promise = new Promise((r) => (resolve = r));
    calls.push({ name, args, resolve });
    return { id: calls.length, inWorker: true, promise, cancel: () => undefined };
  }) as EngineClient['run'],
  dispose: () => undefined,
};

const resultWith = (id: string) => ({ change: { added: [fakeBox(id, id, 10)], removedIds: [], patches: [], warnings: [] } });
const request = (tag: string) =>
  useKuraStore.getState().requestOperationPreview({ key: 'mold', task: 'mold', args: { tag } as never });

beforeEach(() => {
  calls = [];
  vi.useFakeTimers();
  setStoreEngineClient(fakeClient);
  useKuraStore.setState({ objects: [fakeBox('a', 'A', 20), fakeBox('b', 'B', 10)], selectedIds: ['a'], operationPreview: EMPTY_PREVIEW });
});

afterEach(() => {
  useKuraStore.getState().clearOperationPreview();
  setStoreEngineClient(null);
  vi.useRealTimers();
});

describe('operationPreview', () => {
  it('agrupa peticiones seguidas con debounce y calcula una sola vez', async () => {
    request('1');
    request('2');
    request('3');
    expect(useKuraStore.getState().operationPreview.status).toBe('pending');
    await vi.advanceTimersByTimeAsync(249);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual({ tag: '3' });
    calls[0].resolve(resultWith('r3'));
    await vi.runAllTimersAsync();
    const p = useKuraStore.getState().operationPreview;
    expect(p.status).toBe('ready');
    expect(p.ghosts.map((g) => g.id)).toEqual(['r3']);
  });

  it('descarta un resultado obsoleto y conserva el anterior mientras calcula', async () => {
    request('1');
    await vi.advanceTimersByTimeAsync(250);
    calls[0].resolve(resultWith('r1'));
    await vi.runAllTimersAsync();
    request('2');
    // Mientras calcula se conserva el resultado anterior (el visor lo atenúa).
    expect(useKuraStore.getState().operationPreview.ghosts.map((g) => g.id)).toEqual(['r1']);
    await vi.advanceTimersByTimeAsync(250);
    request('3');
    await vi.advanceTimersByTimeAsync(250);
    calls[2 - 1].resolve(resultWith('r2')); // llega tarde: obsoleto
    await vi.runAllTimersAsync();
    expect(useKuraStore.getState().operationPreview.status).toBe('pending');
    calls[2].resolve(resultWith('r3'));
    await vi.runAllTimersAsync();
    expect(useKuraStore.getState().operationPreview.ghosts.map((g) => g.id)).toEqual(['r3']);
  });

  it('limpia al cerrar (descartando lo pendiente) y al cambiar la selección', async () => {
    request('1');
    await vi.advanceTimersByTimeAsync(250);
    useKuraStore.getState().clearOperationPreview('mold');
    calls[0].resolve(resultWith('r1'));
    await vi.runAllTimersAsync();
    expect(useKuraStore.getState().operationPreview).toEqual(EMPTY_PREVIEW);

    request('2');
    await vi.advanceTimersByTimeAsync(250);
    calls[1].resolve(resultWith('r2'));
    await vi.runAllTimersAsync();
    expect(useKuraStore.getState().operationPreview.ghosts).toHaveLength(1);
    useKuraStore.setState({ selectedIds: ['b'] });
    expect(useKuraStore.getState().operationPreview).toEqual(EMPTY_PREVIEW);
  });

  it('no limpia la vista previa de otro dueño', () => {
    request('1');
    useKuraStore.getState().clearOperationPreview('thread');
    expect(useKuraStore.getState().operationPreview.key).toBe('mold');
  });

  it('booleana: resta con rótulos base/herramienta e invertir intercambia los papeles', async () => {
    useKuraStore.setState({ selectedIds: ['a', 'b'] });
    useKuraStore.getState().previewBooleanOnSelection('subtract');
    let p = useKuraStore.getState().operationPreview;
    expect(p.key).toBe('boolean:subtract');
    expect(p.guides.map((g) => [g.role, g.labelKey])).toEqual([
      ['base', 'boolPreview.base'],
      ['tool', 'boolPreview.tool'],
    ]);
    expect(p.ghosts.map((g) => [g.id, g.role])).toEqual([['b', 'tool']]);
    useKuraStore.getState().swapBooleanRoles();
    expect(useKuraStore.getState().selectedIds).toEqual(['b', 'a']);
    p = useKuraStore.getState().operationPreview;
    expect(p.key).toBe('boolean:subtract');
    expect(p.ghosts.map((g) => [g.id, g.role])).toEqual([['a', 'tool']]);
    await vi.advanceTimersByTimeAsync(250);
    expect((calls.at(-1)!.args as { target: { id: string } }).target.id).toBe('b');
  });
});
