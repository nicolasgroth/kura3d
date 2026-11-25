/**
 * @file src/components/viewport/__tests__/useTopInsetCache.test.tsx
 * @description La caché del inset superior de la barra flotante se crea una vez por montaje (no en cada render) y
 * al desmontar quita su listener `resize`: re-renderizar no acumula listeners.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTopInsetCache, useTopInsetCache } from '../topInsetCache';

describe('useTopInsetCache', () => {
  afterEach(() => vi.restoreAllMocks());

  it('una caché por montaje y ningún listener resize suelto tras desmontar', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const create = vi.fn(() => createTopInsetCache(() => null, () => null));
    const { result, rerender, unmount } = renderHook(() => useTopInsetCache(create));
    for (let i = 0; i < 10; i++) rerender();
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.current.current).not.toBeNull();
    unmount();
    const resizeAdds = add.mock.calls.filter(([type]) => type === 'resize').length;
    const resizeRemoves = remove.mock.calls.filter(([type]) => type === 'resize').length;
    expect(resizeAdds).toBe(1);
    expect(resizeRemoves).toBe(resizeAdds);
    expect(result.current.current).toBeNull();
  });
});
