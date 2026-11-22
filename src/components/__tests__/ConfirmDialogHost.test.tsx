/**
 * @file src/components/__tests__/ConfirmDialogHost.test.tsx
 * @description Humo del diálogo de cambios sin guardar: Guardar, Descartar y Cancelar, con foco
 * inicial en la acción segura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { guardUnsavedChanges } from '../../utils/unsavedGuard';
import { ConfirmDialogHost } from '../ConfirmDialogHost';

function startGuard() {
  useKuraStore.setState({ objects: [fakeBox('a', 'Cubo 1')], savedProject: null, projectRecovered: false } as never);
  const proceed = vi.fn();
  let result!: Promise<boolean>;
  act(() => {
    result = guardUnsavedChanges(proceed);
  });
  return { proceed, result };
}

const button = (key: 'unsaved.save' | 'unsaved.discard' | 'unsaved.cancel') =>
  screen.getByRole('button', { name: t('es', key) });

describe('ConfirmDialogHost con cambios sin guardar', () => {
  it('muestra las tres acciones con texto y enfoca Cancelar', async () => {
    render(<ConfirmDialogHost />);
    startGuard();
    expect(await screen.findByText(t('es', 'unsaved.title'))).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(button('unsaved.cancel')));
    expect(button('unsaved.save')).toBeTruthy();
    expect(button('unsaved.discard')).toBeTruthy();
  });

  it('Descartar continúa sin guardar', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHost />);
    const { proceed, result } = startGuard();
    await user.click(await screen.findByRole('button', { name: t('es', 'unsaved.discard') }));
    await expect(result).resolves.toBe(true);
    expect(proceed).toHaveBeenCalledTimes(1);
  });

  it('Cancelar no continúa', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHost />);
    const { proceed, result } = startGuard();
    await user.click(await screen.findByRole('button', { name: t('es', 'unsaved.cancel') }));
    await expect(result).resolves.toBe(false);
    expect(proceed).not.toHaveBeenCalled();
  });

  it('Guardar guarda y luego continúa', async () => {
    const saveProject = vi.fn(async () => {
      useKuraStore.setState({ objects: [] } as never);
      return true;
    });
    useKuraStore.setState({ saveProject } as never);
    const user = userEvent.setup();
    render(<ConfirmDialogHost />);
    const { proceed, result } = startGuard();
    await user.click(await screen.findByRole('button', { name: t('es', 'unsaved.save') }));
    await expect(result).resolves.toBe(true);
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(proceed).toHaveBeenCalledTimes(1);
  });
});
