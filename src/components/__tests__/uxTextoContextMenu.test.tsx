/**
 * @file src/components/__tests__/uxTextoContextMenu.test.tsx
 * @description Menú contextual: el del fondo se abre aunque los controles de órbita ya hayan llamado a
 * `preventDefault` (causa de que nunca apareciera), las filas del árbol de Escena lo piden con clic derecho
 * y con Mayús+F10, y al agregar una pieza queda agrupada con su objeto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useContextMenuRequest } from '../../store/contextMenuRequest';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { SceneObjectList } from '../scene/SceneObjectList';
import { markContextMenuHandled } from '../viewport/contextMenu/handledEvents';
import { useObjectContextMenu } from '../viewport/useObjectContextMenu';

function Harness() {
  const ref = useRef<HTMLElement | null>(null);
  const { contextMenu, handleBackgroundContextMenu, handleBackgroundPointerDown } = useObjectContextMenu(ref);
  return (
    <main ref={ref} onPointerDownCapture={handleBackgroundPointerDown} onContextMenu={handleBackgroundContextMenu}>
      <canvas data-testid="canvas" />
      <output data-testid="state">{contextMenu ? (contextMenu.objectId ?? 'background') : 'none'}</output>
    </main>
  );
}

describe('menú contextual del visor', () => {
  it('el menú del fondo se abre aunque OrbitControls ya haya llamado a preventDefault', () => {
    render(<Harness />);
    const canvas = screen.getByTestId('canvas');
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    fireEvent.pointerDown(canvas, { button: 2, clientX: 10, clientY: 10 });
    fireEvent.contextMenu(canvas, { clientX: 10, clientY: 10 });
    expect(screen.getByTestId('state').textContent).toBe('background');
  });

  it('un objeto que ya atendió el evento impide el menú del fondo', () => {
    render(<Harness />);
    const canvas = screen.getByTestId('canvas');
    canvas.addEventListener('contextmenu', (e) => markContextMenuHandled(e));
    fireEvent.contextMenu(canvas, { clientX: 10, clientY: 10 });
    expect(screen.getByTestId('state').textContent).toBe('none');
  });
});

describe('menú contextual en el árbol de Escena', () => {
  function setup() {
    useKuraStore.setState({ objects: [fakeBox('a', 'Pieza A'), fakeBox('b', 'Pieza B')], selectedIds: [] } as never);
    render(<SceneObjectList />);
  }

  it('el clic derecho en una fila selecciona el objeto y pide su menú', () => {
    setup();
    fireEvent.contextMenu(screen.getByText('Pieza B'), { clientX: 40, clientY: 90 });
    expect(useKuraStore.getState().selectedIds).toEqual(['b']);
    const req = useContextMenuRequest.getState().request;
    expect(req?.objectId).toBe('b');
    expect(req?.x).toBe(40);
  });

  it('Mayús+F10 y la tecla Menú abren el menú de la fila activa', () => {
    setup();
    const tree = screen.getByRole('tree');
    act(() => tree.focus());
    fireEvent.keyDown(tree, { key: 'F10', shiftKey: true });
    expect(useContextMenuRequest.getState().request?.objectId).toBe('a');
    act(() => useContextMenuRequest.getState().clear());
    fireEvent.keyDown(tree, { key: 'ContextMenu' });
    expect(useContextMenuRequest.getState().request?.objectId).toBe('a');
  });
});
