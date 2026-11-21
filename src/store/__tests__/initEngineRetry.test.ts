/**
 * @file src/store/__tests__/initEngineRetry.test.ts
 * @description Prueba que `initEngine` reintenta la carga del motor tras un fallo en vez de reutilizar
 * para siempre la promesa resuelta del primer intento.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';

const initMock = vi.hoisted(() => vi.fn());

vi.mock('../../engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../engine')>();
  return { ...actual, initManifoldEngine: initMock };
});

const { useKuraStore } = await import('../useKuraStore');

describe('initEngine', () => {
  it('comparte el intento concurrente, reintenta tras un fallo y queda listo', async () => {
    initMock.mockRejectedValueOnce(new Error('wasm no disponible')).mockResolvedValue(undefined);
    useKuraStore.setState({ engineReady: false, engineError: null, toasts: [] });

    // Dos llamadas simultáneas comparten un único intento fallido.
    await Promise.all([useKuraStore.getState().initEngine(), useKuraStore.getState().initEngine()]);
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(useKuraStore.getState().engineReady).toBe(false);
    expect(useKuraStore.getState().engineError).toBe('wasm no disponible');

    // La siguiente llamada vuelve a intentar en vez de devolver la promesa del fallo.
    await useKuraStore.getState().initEngine();
    expect(initMock).toHaveBeenCalledTimes(2);
    expect(useKuraStore.getState().engineReady).toBe(true);
    expect(useKuraStore.getState().engineError).toBeNull();
  });
});
