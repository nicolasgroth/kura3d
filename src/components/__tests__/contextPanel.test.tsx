/**
 * @file src/components/__tests__/contextPanel.test.tsx
 * @description Panel derecho contextual: los tres contextos (proyecto, objeto, acción) y la selección múltiple,
 * «Volver» al resumen, plegar y desplegar (recordado), abrir solo al activar una acción con opciones,
 * redimensionar con teclado por el separador y el registro de contenido de cada acción con opciones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PANEL_ACTIONS } from '../../store/actionsCatalog';
import { panelContextOf } from '../../store/panelContext';
import { RIGHT_PANEL_DEFAULT_WIDTH, RIGHT_PANEL_MAX_WIDTH, RIGHT_PANEL_MIN_WIDTH, STORAGE_RIGHT_PANEL_COLLAPSED_KEY, STORAGE_RIGHT_PANEL_WIDTH_KEY } from '../../store/rightPanelPrefs';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { panelContentOf } from '../contextPanel/panelRegistry';
import { RightInspector } from '../RightInspector';

const panel = () => document.getElementById('kura-inspector-panel')!;

function seed(selected: string[] = [], extra: Record<string, unknown> = {}) {
  localStorage.clear();
  useKuraStore.setState({
    language: 'es',
    objects: [fakeBox('a', 'Pieza A'), fakeBox('b', 'Pieza B')],
    selectedIds: selected,
    activeAction: null,
    activeTool: 'select',
    rightCollapsed: false,
    rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
    busyOperation: null,
    ...extra,
  } as never);
}

describe('panel contextual', () => {
  beforeEach(() => seed());

  it('sin selección muestra el proyecto con sus datos', () => {
    render(<RightInspector />);
    expect(panel().dataset.context).toBe('project');
    expect(screen.getByRole('heading', { name: 'Proyecto' })).toBeTruthy();
    expect(screen.getByTestId('panel-project-count').textContent).toBe('2');
    expect(screen.getByText('Cama activa')).toBeTruthy();
  });

  it('con un objeto muestra su resumen y accesos, sin opciones de acciones', () => {
    seed(['a']);
    render(<RightInspector />);
    expect(panel().dataset.context).toBe('object');
    expect((document.getElementById('kura-obj-name') as HTMLInputElement).value).toBe('Pieza A');
    expect(screen.getByRole('button', { name: 'Ahuecar…' })).toBeTruthy();
    expect(screen.queryByText('Aplicar ahuecado')).toBeNull();
  });

  it('con varios objetos muestra la selección múltiple', () => {
    seed(['a', 'b']);
    render(<RightInspector />);
    expect(panel().dataset.context).toBe('multi');
  });

  it('una acción muestra solo sus opciones y «Volver» regresa al resumen', () => {
    seed(['a']);
    render(<RightInspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Ahuecar…' }));
    expect(panel().dataset.context).toBe('action');
    expect(screen.getByRole('heading', { name: 'Ahuecar' })).toBeTruthy();
    expect(screen.getByText('Sobre Pieza A')).toBeTruthy();
    expect(document.getElementById('kura-obj-name')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(useKuraStore.getState().activeAction).toBeNull();
    expect(panel().dataset.context).toBe('object');
  });

  it('Esc dentro de las opciones vuelve al resumen', () => {
    seed(['a'], { activeAction: 'texture' });
    render(<RightInspector />);
    fireEvent.keyDown(screen.getByRole('heading', { name: 'Textura superficial' }), { key: 'Escape' });
    expect(panel().dataset.context).toBe('object');
  });

  it('una acción sin objeto vuelve al proyecto (no queda un panel vacío)', () => {
    seed([], { activeAction: 'hollow' });
    expect(panelContextOf(useKuraStore.getState())).toEqual({ kind: 'project' });
    seed(['a'], { activeAction: 'splitForBed' });
    expect(panelContextOf(useKuraStore.getState())).toEqual({ kind: 'object', id: 'a' });
  });

  it('se pliega, lo recuerda y una acción con opciones lo abre sola', () => {
    seed(['a']);
    render(<RightInspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Colapsar inspector derecho' }));
    expect(useKuraStore.getState().rightCollapsed).toBe(true);
    expect(localStorage.getItem(STORAGE_RIGHT_PANEL_COLLAPSED_KEY)).toBe('1');
    expect(screen.queryByRole('separator', { name: 'Ancho del panel' })).toBeNull();
    act(() => useKuraStore.getState().setActiveAction('group'));
    expect(useKuraStore.getState().rightCollapsed).toBe(true);
    act(() => useKuraStore.getState().setActiveAction('detect'));
    expect(useKuraStore.getState().rightCollapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_RIGHT_PANEL_COLLAPSED_KEY)).toBeNull();
  });

  it('el separador cambia el ancho con teclado, con límites, y lo recuerda', () => {
    seed(['a']);
    render(<RightInspector />);
    const sep = screen.getByRole('separator', { name: 'Ancho del panel' });
    expect(sep.getAttribute('aria-valuenow')).toBe(String(RIGHT_PANEL_DEFAULT_WIDTH));
    fireEvent.keyDown(sep, { key: 'ArrowLeft' });
    expect(useKuraStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_DEFAULT_WIDTH + 16);
    fireEvent.keyDown(sep, { key: 'ArrowRight', shiftKey: true });
    expect(useKuraStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_DEFAULT_WIDTH + 16 - 64);
    fireEvent.keyDown(sep, { key: 'End' });
    expect(sep.getAttribute('aria-valuenow')).toBe(String(RIGHT_PANEL_MAX_WIDTH));
    expect(localStorage.getItem(STORAGE_RIGHT_PANEL_WIDTH_KEY)).toBe(String(RIGHT_PANEL_MAX_WIDTH));
    fireEvent.keyDown(sep, { key: 'Home' });
    fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(useKuraStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_MIN_WIDTH);
    expect(panel().style.getPropertyValue('--kura-right-w')).toBe(`${RIGHT_PANEL_MIN_WIDTH}px`);
  });

  it('cada acción con opciones tiene su contenido registrado', () => {
    for (const id of PANEL_ACTIONS) expect(panelContentOf(id), id).toBeTruthy();
  });
});
