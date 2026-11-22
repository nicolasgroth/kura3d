/**
 * @file src/components/__tests__/OperationProgressBar.test.tsx
 * @description Barra de progreso del visor: no aparece en operaciones cortas, se anuncia con
 * `role="status"` con el nombre traducido, y Cancelar (botón o Escape en el visor) cancela.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationProgressBar } from '../viewport/OperationProgressBar';

const busy = (startedAt: number, cancellable = true) =>
  useKuraStore.setState({
    busyOperation: 'plane_cut',
    busyProgress: { name: 'plane_cut', phase: null, startedAt, cancellable },
  });

describe('OperationProgressBar', () => {
  it('no se muestra antes de 400 ms y luego anuncia la operación', () => {
    vi.useFakeTimers();
    try {
      busy(Date.now());
      render(<OperationProgressBar />);
      expect(screen.queryByRole('status')).toBeNull();
      act(() => vi.advanceTimersByTime(500));
      const status = screen.getByRole('status');
      expect(status.textContent).toContain(t('es', 'progress.op.plane_cut'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('Cancelar y Escape en el visor llaman a cancelBusyOperation', () => {
    const cancel = vi.fn(() => true);
    useKuraStore.setState({ cancelBusyOperation: cancel });
    busy(Date.now() - 2000);
    render(<OperationProgressBar />);
    fireEvent.click(screen.getByRole('button', { name: t('es', 'progress.cancel') }));
    expect(cancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('sin tarea cancelable no ofrece Cancelar', () => {
    busy(Date.now() - 2000, false);
    render(<OperationProgressBar />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
