/**
 * @file src/components/__tests__/ProjectFileActionsRecents.test.tsx
 * @description Proyectos recientes en escritorio (panel Proyecto): la lista muestra nombre, carpeta abreviada y fecha, abre con
 * un clic (por id, nunca por ruta), marca los archivos que ya no existen, permite quitarlos y el ajuste
 * «Recordar proyectos recientes» desactiva y borra el registro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { NativeRecentList } from '../../project/nativeRecents';

const native = vi.hoisted(() => ({
  list: { enabled: true, items: [] } as NativeRecentList,
}));

vi.mock('../../utils/platformBridge', async (original) => ({
  ...(await original<typeof import('../../utils/platformBridge')>()),
  isTauriRuntime: () => true,
}));

vi.mock('../../project/nativeRecents', async (original) => ({
  ...(await original<typeof import('../../project/nativeRecents')>()),
  listNativeRecents: vi.fn(async () => native.list),
  removeNativeRecent: vi.fn(async (id: string) => {
    native.list = { ...native.list, items: native.list.items.filter((i) => i.id !== id) };
    return native.list;
  }),
  clearNativeRecents: vi.fn(async () => {
    native.list = { ...native.list, items: [] };
    return native.list;
  }),
  setNativeRecentsEnabled: vi.fn(async (enabled: boolean) => {
    native.list = { enabled, items: enabled ? native.list.items : [] };
    return native.list;
  }),
  openNativeRecent: vi.fn(async () => null),
}));

import * as nativeRecents from '../../project/nativeRecents';
import { RecentProjectsSettings } from '../settings/RecentProjectsSettings';
import { ProjectFileActions } from '../contextPanel/ProjectFileActions';

const ITEMS: NativeRecentList['items'] = [
  { id: 'id-1', name: 'Estatua.kura', folder: 'C:\\Users\\ana\\Documentos\\Modelos', openedAt: 1_700_000_000_000, exists: true },
  { id: 'id-2', name: 'Perdido.kura', folder: '/home/ana/viejo', openedAt: 1_600_000_000_000, exists: false },
];

describe('Proyectos recientes en escritorio', () => {
  beforeEach(() => {
    native.list = { enabled: true, items: ITEMS.map((i) => ({ ...i })) };
    vi.clearAllMocks();
  });

  it('muestra nombre, carpeta abreviada y marca los que ya no existen', async () => {
    render(<ProjectFileActions />);
    const open = await screen.findByRole('button', { name: /^Estatua\.kura/ });
    expect(open.textContent).toContain('…/Documentos/Modelos');
    const lost = screen.getByRole('button', { name: /^Perdido\.kura/ });
    expect(lost).toHaveProperty('disabled', true);
    expect(lost.textContent).toContain(t('es', 'project.recent.missingTag'));
  });

  it('abre con un clic pasando solo el id y el nombre, sin rutas', async () => {
    const openProject = vi.fn(async (loader?: () => Promise<unknown>) => {
      await loader?.();
      return true;
    });
    useKuraStore.setState({ openProject } as never);
    const user = userEvent.setup();
    render(<ProjectFileActions />);
    await user.click(await screen.findByRole('button', { name: /^Estatua\.kura/ }));
    await waitFor(() => expect(nativeRecents.openNativeRecent).toHaveBeenCalledWith('id-1', 'Estatua.kura'));
    expect(openProject).toHaveBeenCalledTimes(1);
  });

  it('permite quitar una entrada de la lista', async () => {
    const user = userEvent.setup();
    render(<ProjectFileActions />);
    await user.click(await screen.findByRole('button', { name: t('es', 'project.recent.removeOne', { name: 'Perdido.kura' }) }));
    expect(nativeRecents.removeNativeRecent).toHaveBeenCalledWith('id-2');
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Perdido\.kura/ })).toBeNull());
  });

  it('el ajuste Recordar proyectos recientes está activado y al desactivarlo borra el registro', async () => {
    const user = userEvent.setup();
    render(<RecentProjectsSettings idPrefix="t" />);
    const box = await screen.findByRole('checkbox', { name: t('es', 'settings.recent.remember') });
    await waitFor(() => expect(box).toHaveProperty('checked', true));
    await user.click(box);
    expect(nativeRecents.setNativeRecentsEnabled).toHaveBeenCalledWith(false);
    await waitFor(() => expect(box).toHaveProperty('checked', false));
    expect(native.list.items).toHaveLength(0);
  });

  it('Olvidar recientes vacía la lista', async () => {
    const user = userEvent.setup();
    render(<RecentProjectsSettings idPrefix="t" />);
    const forget = await screen.findByRole('button', { name: t('es', 'settings.recent.forget') });
    await waitFor(() => expect(forget).toHaveProperty('disabled', false));
    await user.click(forget);
    expect(nativeRecents.clearNativeRecents).toHaveBeenCalled();
  });
});
