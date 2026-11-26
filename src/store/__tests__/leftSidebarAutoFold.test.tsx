/**
 * @file src/store/__tests__/leftSidebarAutoFold.test.tsx
 * @description Con un panel de operación abierto y la ventana por debajo de 1200 px la lista de escena se pliega sola y
 * se restaura al cerrarlo; no toca la preferencia guardada; con ventana ancha no hace nada; si la persona la abre o
 * cierra a mano mientras tanto, se respeta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OperationPanel } from '../../components/OperationPanel';
import { panelClosed, panelOpened, resetAutoFoldForTests } from '../leftSidebarAutoFold';
import { useKuraStore } from '../useKuraStore';

const st = () => useKuraStore.getState();

beforeEach(() => {
  resetAutoFoldForTests();
  useKuraStore.setState({ leftSidebarMode: 'full', leftCollapsed: false, leftAutoFolded: false } as never);
});
afterEach(cleanup);

describe('plegado automático de la lista de escena', () => {
  it('a 1024 px pliega al abrir el panel y restaura al cerrarlo', () => {
    panelOpened(1024);
    expect(st().leftSidebarMode).toBe('hidden');
    expect(st().leftCollapsed).toBe(true);
    panelClosed();
    expect(st().leftSidebarMode).toBe('full');
    expect(st().leftCollapsed).toBe(false);
    expect(st().leftAutoFolded).toBe(false);
  });

  it('con 1200 px o más no hace nada', () => {
    panelOpened(1440);
    expect(st().leftSidebarMode).toBe('full');
    panelClosed();
    expect(st().leftSidebarMode).toBe('full');
  });

  it('no escribe la preferencia guardada', () => {
    localStorage.removeItem('kura3d.leftSidebar');
    const antes = JSON.stringify({ ...localStorage });
    panelOpened(1024);
    panelClosed();
    expect(JSON.stringify({ ...localStorage })).toBe(antes);
  });

  it('si la persona la abre a mano con el panel abierto, al cerrar no se vuelve a tocar', () => {
    panelOpened(1024);
    st().setLeftSidebarMode('full');
    expect(st().leftAutoFolded).toBe(false);
    panelClosed();
    expect(st().leftSidebarMode).toBe('full');
  });

  it('si ya estaba oculta por preferencia, sigue oculta', () => {
    useKuraStore.setState({ leftSidebarMode: 'hidden', leftCollapsed: true } as never);
    panelOpened(1024);
    panelClosed();
    expect(st().leftSidebarMode).toBe('hidden');
  });

  it('OperationPanel lo aplica al abrir y al cerrar (ventana de 1024 px)', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    const { rerender } = render(<OperationPanel open onClose={() => undefined} title="Panel"><input aria-label="x" /></OperationPanel>);
    expect(st().leftSidebarMode).toBe('hidden');
    act(() => rerender(<OperationPanel open={false} onClose={() => undefined} title="Panel"><input aria-label="x" /></OperationPanel>));
    expect(st().leftSidebarMode).toBe('full');
  });
});
