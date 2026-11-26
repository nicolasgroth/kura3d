/**
 * @file src/components/__tests__/toastUndoStale.test.tsx
 * @description El «Deshacer» de un aviso (p. ej. el de «Repartir en placas») deja de ofrecerse cuando su paso ya se
 * deshizo por otra vía o el historial avanzó, y si aun así se invoca no revierte otra cosa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { undoToastAction } from '../../store/toastActionState';
import { useKuraStore } from '../../store/useKuraStore';
import { ToastItem } from '../ToastItem';

afterEach(cleanup);

function setup() {
  const undo = vi.fn();
  useKuraStore.setState({ language: 'es', past: [{} as never], future: [], toasts: [], toastHistory: [], objects: [] } as never);
  const action = undoToastAction('Deshacer', () => useKuraStore.getState().past, undo, true);
  useKuraStore.getState().addToast('Repartidas', 'success', action);
  const toast = useKuraStore.getState().toasts[0];
  render(<ToastItem toast={toast} language="es" onDismiss={() => {}} />);
  return { undo, toast };
}

describe('aviso con «Deshacer» vigente', () => {
  it('mientras su paso es el último ofrece el botón y lo ejecuta', () => {
    const { undo } = setup();
    act(() => screen.getByRole('button', { name: /Deshacer/ }).click());
    expect(undo).toHaveBeenCalledOnce();
  });

  it('si el paso se deshizo por otra vía, el botón desaparece', () => {
    setup();
    act(() => useKuraStore.setState({ past: [] } as never));
    expect(screen.queryByRole('button', { name: /Deshacer/ })).toBeNull();
  });

  it('si el historial avanzó, el botón desaparece y runToastAction no ejecuta nada', () => {
    const { undo, toast } = setup();
    act(() => useKuraStore.setState({ past: [{} as never, {} as never] } as never));
    expect(screen.queryByRole('button', { name: /Deshacer/ })).toBeNull();
    useKuraStore.getState().runToastAction(toast.id, toast.action!);
    expect(undo).not.toHaveBeenCalled();
  });
});
