/**
 * @file src/components/__tests__/recoveryStatusBusy.test.tsx
 * @description El pie no afirma "Borrador local guardado" mientras una operación (p. ej. ahuecar) sigue
 * corriendo: la escena está por cambiar, así que dice que el borrador está pendiente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { RecoveryStatusNotice } from '../RecoveryStatusNotice';
import { useKuraStore } from '../../store/useKuraStore';

afterEach(() => {
  cleanup();
  useKuraStore.setState({ busyOperation: null });
});

describe('estado del borrador en el pie', () => {
  it('guardado sin operaciones; pendiente mientras corre una; guardado al terminar', () => {
    useKuraStore.setState({ language: 'es', busyOperation: null });
    render(<RecoveryStatusNotice status="ready" failure={null} />);
    expect(screen.getByRole('status').textContent).toBe('Borrador local guardado');
    act(() => useKuraStore.setState({ busyOperation: 'hollow' }));
    expect(screen.getByRole('status').textContent).toBe('Borrador pendiente: operación en curso');
    act(() => useKuraStore.setState({ busyOperation: null }));
    expect(screen.getByRole('status').textContent).toBe('Borrador local guardado');
  });
});
