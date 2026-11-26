/**
 * @file src/components/viewport/__tests__/floatingBarTopInset.test.ts
 * @description El inset superior de la barra flotante se mide una vez y solo se remide al invalidarlo el observador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it, vi } from 'vitest';
import { createTopInsetCache } from '../topInsetCache';

describe('createTopInsetCache', () => {
  it('no vuelve a medir ni a buscar el HUD en cada cuadro', () => {
    const hudRect = vi.fn(() => ({ bottom: 40 }));
    const hud = { isConnected: true, getBoundingClientRect: hudRect } as unknown as Element;
    const wrap = { getBoundingClientRect: () => ({ top: 10 }) } as unknown as Element;
    const query = vi.fn(() => hud);
    let notify: () => void = () => undefined;
    const cache = createTopInsetCache(query, (cb) => {
      notify = cb;
      return { observe: () => undefined, disconnect: () => undefined };
    });
    for (let i = 0; i < 50; i += 1) expect(cache.get(wrap)).toBe(30);
    expect(query).toHaveBeenCalledTimes(1);
    expect(hudRect).toHaveBeenCalledTimes(1);
    notify();
    cache.get(wrap);
    expect(hudRect).toHaveBeenCalledTimes(2);
    cache.dispose();
  });
});
