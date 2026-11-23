/**
 * @file src/components/__tests__/uxTextoModalErrors.test.tsx
 * @description Un error con un diálogo abierto se muestra dentro del diálogo (role="alert") y este queda
 * abierto; los avisos se pintan dentro del diálogo modal (capa superior), no bajo su velo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useKuraStore } from '../../store/useKuraStore';
import { SvgImportModal } from '../dialogs/SvgImportModal';
import { NativeModal } from '../NativeModal';
import { ToastStack } from '../ToastStack';

describe('errores con un diálogo abierto', () => {
  it('el error del SVG sale dentro del diálogo y el diálogo sigue abierto', async () => {
    let closed = false;
    useKuraStore.setState({
      importSvgModel: async () => {
        useKuraStore.setState({ lastOperationError: 'El SVG no tiene contornos' });
        return null;
      },
    } as never);
    render(<SvgImportModal open onClose={() => { closed = true; }} />);
    fireEvent.click(screen.getByRole('button', { name: /Extruir SVG/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('El SVG no tiene contornos');
    expect(alert.closest('dialog')).not.toBeNull();
    expect(closed).toBe(false);
  });

  it('los avisos se pintan dentro del diálogo modal abierto', async () => {
    render(
      <>
        <NativeModal open onClose={() => undefined} title="Demo">
          <p>contenido</p>
        </NativeModal>
        <ToastStack />
      </>,
    );
    act(() => useKuraStore.getState().addToast('Algo falló', 'error'));
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toContain('Algo falló'));
  });
});
