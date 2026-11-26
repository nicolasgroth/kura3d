/**
 * @file src/store/__tests__/minWidthNotice.test.ts
 * @description El aviso de pantalla angosta sale una sola vez por sesión bajo 1024 px, también al achicar la ventana,
 * y no sale en pantallas del ancho soportado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { resetMinWidthNotice, startMinWidthNotice } from '../minWidthNotice';
import { useKuraStore } from '../useKuraStore';

function fakeMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: initial,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal('window', { matchMedia: () => query });
  return { set: (v: boolean) => { query.matches = v; listeners.forEach((fn) => fn()); }, listeners };
}

const notices = () => useKuraStore.getState().toasts.filter((x) => x.text === t('es', 'ux8.minWidth.notice'));

describe('aviso de pantalla angosta', () => {
  beforeEach(() => {
    resetMinWidthNotice();
    useKuraStore.setState({ language: 'es', toasts: [], toastHistory: [] } as never);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('bajo 1024 px avisa al abrir, una sola vez', () => {
    const media = fakeMedia(true);
    const stop = startMinWidthNotice();
    expect(notices()).toHaveLength(1);
    useKuraStore.setState({ toasts: [] } as never);
    media.set(true);
    expect(notices()).toHaveLength(0);
    stop();
    expect(media.listeners.size).toBe(0);
  });

  it('en una pantalla ancha no avisa, y sí al achicarla', () => {
    const media = fakeMedia(false);
    startMinWidthNotice();
    expect(notices()).toHaveLength(0);
    media.set(true);
    expect(notices()).toHaveLength(1);
  });
});
