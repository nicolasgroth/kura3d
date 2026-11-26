/**
 * @file src/components/__tests__/HistorySettings.test.tsx
 * @description Control "Historial de deshacer" de Ajustes: línea de uso, presupuesto de memoria,
 * máximo de pasos con límites, vaciado con confirmación propia y tooltips de Deshacer/Rehacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { ConfirmDialogHost } from '../ConfirmDialogHost';
import { HistorySettings } from '../settings/HistorySettings';
import { TopBar } from '../TopBar';

function seedHistory(steps: number): void {
  const snap = { objects: [fakeBox('a', 'Cubo')], selectedIds: [] as string[] };
  useKuraStore.setState({ past: Array.from({ length: steps }, () => snap), future: [] } as never);
}

describe('HistorySettings', () => {
  it('muestra el uso actual con pasos y MB del presupuesto', () => {
    useKuraStore.setState({ historyLimits: { budgetMb: 256, maxSteps: 500 } } as never);
    seedHistory(37);
    render(<HistorySettings idPrefix="h" />);
    const usage = screen.getByTestId('history-usage').textContent ?? '';
    expect(usage).toMatch(/^37 pasos · [\d.,]+ MB de 256 MB$/);
  });

  it('cambiar presupuesto y máximo de pasos actualiza el store y acota el rango', async () => {
    const user = userEvent.setup();
    render(<HistorySettings idPrefix="h" />);
    await user.selectOptions(screen.getByLabelText(t('es', 'settings.history.budget')), '512');
    expect(useKuraStore.getState().historyLimits.budgetMb).toBe(512);
    const steps = screen.getByLabelText(t('es', 'settings.history.maxSteps'));
    await user.clear(steps);
    await user.type(steps, '5000');
    await user.tab();
    expect(useKuraStore.getState().historyLimits.maxSteps).toBe(2000);
    expect((steps as HTMLInputElement).value).toBe('2000');
    await user.clear(steps);
    await user.type(steps, '10');
    await user.tab();
    expect(useKuraStore.getState().historyLimits.maxSteps).toBe(50);
  });

  it('Vaciar historial pide confirmación y Cancelar no borra nada', async () => {
    const user = userEvent.setup();
    seedHistory(5);
    render(
      <>
        <HistorySettings idPrefix="h" />
        <ConfirmDialogHost />
      </>,
    );
    await user.click(screen.getByRole('button', { name: t('es', 'settings.history.clear') }));
    expect(await screen.findByText(t('es', 'settings.history.clearTitle'))).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t('es', 'dialog.cancel') }));
    await waitFor(() => expect(screen.queryByText(t('es', 'settings.history.clearTitle'))).toBeNull());
    expect(useKuraStore.getState().past).toHaveLength(5);
  });

  it('confirmar vacía el historial y deshabilita el botón', async () => {
    const user = userEvent.setup();
    seedHistory(5);
    render(
      <>
        <HistorySettings idPrefix="h" />
        <ConfirmDialogHost />
      </>,
    );
    await user.click(screen.getByRole('button', { name: t('es', 'settings.history.clear') }));
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'));
    const confirm = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === t('es', 'settings.history.clear'));
    await act(async () => confirm!.click());
    await waitFor(() => expect(useKuraStore.getState().past).toHaveLength(0));
    expect((screen.getByRole('button', { name: t('es', 'settings.history.clear') }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('TopBar: pasos disponibles en deshacer y rehacer', () => {
  it('el tooltip suma la cantidad de pasos', () => {
    seedHistory(37);
    useKuraStore.setState({ future: [{ objects: [], selectedIds: [] }] } as never);
    render(<TopBar />);
    expect(screen.getByLabelText(t('es', 'topbar.undo')).getAttribute('title')).toBe('Deshacer (Ctrl+Z) · 37 pasos');
    expect(screen.getByLabelText(t('es', 'topbar.redo')).getAttribute('title')).toBe('Rehacer (Ctrl+Y) · 1 paso');
  });

  it('sin pasos conserva el texto original', () => {
    render(<TopBar />);
    expect(screen.getByLabelText(t('es', 'topbar.undo')).getAttribute('title')).toBe(t('es', 'topbar.undoTip'));
  });
});
