/**
 * @file src/components/__tests__/magnetPresetUndoName.test.tsx
 * @description Aviso de «preajuste eliminado»: su botón Deshacer tiene nombre propio y no se confunde con el
 * «Deshacer» de la barra superior; sigue restaurando el preajuste.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { closeMagnetPanel, openMagnetPanel, useMagnetPresets } from '../../store/magnetPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { MagnetPanel } from '../magnet/MagnetPanel';
import { ToastStack } from '../ToastStack';

beforeEach(() => {
  localStorage.clear();
  useMagnetPresets.getState().reload();
  closeMagnetPanel();
  useKuraStore.setState({ objects: [fakeBox('b1', 'Caja', 20)], toasts: [], toastHistory: [], language: 'es' });
});

describe('Deshacer del preajuste eliminado', () => {
  it('tiene nombre accesible propio y restaura el preajuste', async () => {
    const user = userEvent.setup();
    render(<><MagnetPanel /><ToastStack /></>);
    act(() => void openMagnetPanel());
    await user.type(screen.getByTestId('magnet-preset-name'), 'Tapa 12');
    await user.click(screen.getByTestId('magnet-preset-save'));
    await user.click(screen.getByTestId('magnet-preset-delete'));
    expect(useMagnetPresets.getState().presets).toEqual([]);
    const undo = screen.getByRole('button', { name: t('es', 'magnet.preset.undoDelete') });
    expect(undo.textContent).toBe(t('es', 'topbar.undo'));
    expect(screen.queryByRole('button', { name: t('es', 'topbar.undo') })).toBeNull();
    await user.click(undo);
    expect(useMagnetPresets.getState().presets).toHaveLength(1);
  });
});
