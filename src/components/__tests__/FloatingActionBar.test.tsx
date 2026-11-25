/**
 * @file src/components/__tests__/FloatingActionBar.test.tsx
 * @description Barra flotante de acciones: botones y nombres del menú contextual, cada botón ejecuta la acción del store,
 * Bloquear con `aria-pressed`, teclado (una parada de tabulación, flechas, Inicio/Fin, Alt+.) y reglas de visibilidad.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useFloatingBarPrefs } from '../../store/floatingBarState';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { FloatingActionBar } from '../viewport/FloatingActionBar';

const deleteSelection = vi.fn();
vi.mock('../scene/confirmDeleteSelection', () => ({ confirmDeleteSelection: (ids?: string[]) => deleteSelection(ids) }));

const duplicateObjects = vi.fn();
const toggleSelectionVisibility = vi.fn(() => ['a']);
const updateObjectMeta = vi.fn();

const toolbar = () => screen.getByRole('toolbar', { name: t('es', 'floatingBar.label') });
const buttons = () => Array.from(toolbar().querySelectorAll<HTMLButtonElement>('button'));
const btn = (action: string) => toolbar().querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;

beforeEach(() => {
  vi.clearAllMocks();
  useFloatingBarPrefs.setState({ enabled: true });
  useKuraStore.setState({
    language: 'es',
    objects: [fakeBox('a', 'Caja A'), fakeBox('b', 'Caja B')],
    selectedIds: ['a'],
    activeTool: 'select',
    uiDensity: 'full',
    activeDialog: null,
    surfacePick: null,
    duplicateObjects,
    toggleSelectionVisibility,
    updateObjectMeta,
  } as never);
});

describe('FloatingActionBar', () => {
  it('es una barra de herramientas con seis botones con los nombres del menú contextual', () => {
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual([
      t('es', 'inspector.field.color'),
      t('es', 'ctx.duplicate'),
      t('es', 'menu.more.hide'),
      t('es', 'ux8.menu.lock'),
      t('es', 'ctx.delete'),
      t('es', 'menu.more'),
    ]);
    buttons().forEach((b) => expect(b.title).toBeTruthy());
  });

  it('cada botón llama a la acción del store, sobre la selección', () => {
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    fireEvent.click(btn('duplicate'));
    expect(duplicateObjects).toHaveBeenCalledWith(['a']);
    fireEvent.click(btn('hide'));
    expect(toggleSelectionVisibility).toHaveBeenCalledTimes(1);
    fireEvent.click(btn('lock'));
    expect(updateObjectMeta).toHaveBeenCalledWith('a', { locked: true });
    fireEvent.click(btn('delete'));
    expect(deleteSelection).toHaveBeenCalledWith(['a']);
  });

  it('el color cambia la selección entera', () => {
    useKuraStore.setState({ selectedIds: ['a', 'b'] } as never);
    const { container } = render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    fireEvent.change(container.querySelector('input[type="color"]')!, { target: { value: '#123456' } });
    expect(updateObjectMeta).toHaveBeenCalledWith('a', { color: '#123456' });
    expect(updateObjectMeta).toHaveBeenCalledWith('b', { color: '#123456' });
  });

  it('Bloquear lleva aria-pressed y pasa a Desbloquear; Ocultar pasa a Mostrar', () => {
    useKuraStore.setState({ objects: [{ ...fakeBox('a', 'Caja A'), locked: true, visible: false }, fakeBox('b', 'Caja B')] } as never);
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(btn('lock').getAttribute('aria-pressed')).toBe('true');
    expect(btn('lock').getAttribute('aria-label')).toBe(t('es', 'ux8.menu.unlock'));
    expect(btn('hide').getAttribute('aria-label')).toBe(t('es', 'ux8.menu.show'));
    fireEvent.click(btn('lock'));
    expect(updateObjectMeta).toHaveBeenCalledWith('a', { locked: false });
    // Eliminar no actúa sobre un objeto bloqueado.
    expect(btn('delete').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(btn('delete'));
    expect(deleteSelection).not.toHaveBeenCalled();
  });

  it('«Más» abre el menú del objeto con su id y las coordenadas del botón', () => {
    const onMore = vi.fn();
    render(<FloatingActionBar contextMenuOpen={false} onMore={onMore} />);
    fireEvent.click(btn('more'));
    expect(onMore).toHaveBeenCalledWith('a', expect.any(Number), expect.any(Number));
  });

  it('una sola parada de tabulación; las flechas, Inicio y Fin recorren los botones', () => {
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(buttons().filter((b) => b.tabIndex === 0)).toHaveLength(1);
    btn('color').focus();
    fireEvent.keyDown(toolbar(), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(btn('duplicate'));
    fireEvent.keyDown(toolbar(), { key: 'End' });
    expect(document.activeElement).toBe(btn('more'));
    fireEvent.keyDown(toolbar(), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(btn('color'));
    fireEvent.keyDown(toolbar(), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(btn('more'));
    fireEvent.keyDown(toolbar(), { key: 'Home' });
    expect(document.activeElement).toBe(btn('color'));
    expect(buttons().filter((b) => b.tabIndex === 0)).toHaveLength(1);
  });

  it('no roba el foco al aparecer y Alt+. se lo pasa', () => {
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(toolbar().contains(document.activeElement)).toBe(false);
    fireEvent.keyDown(window, { key: '.', code: 'Period', altKey: true });
    expect(document.activeElement).toBe(btn('color'));
  });

  it.each([
    ['sin selección', { selectedIds: [] }],
    ['con Pintar', { activeTool: 'paint' }],
    ['con Cortar', { activeTool: 'cut' }],
    ['con Esculpir', { activeTool: 'erase' }],
    ['con Medir', { activeTool: 'measure' }],
    ['en modo Zen', { uiDensity: 'zen' }],
    ['con un panel de operación abierto', { activeDialog: 'cut' }],
    ['colocando sobre una superficie', { surfacePick: { id: 'a' } }],
  ])('no aparece %s', (_name, patch) => {
    useKuraStore.setState(patch as never);
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('no aparece con un menú contextual abierto ni con la preferencia apagada', () => {
    const { rerender } = render(<FloatingActionBar contextMenuOpen onMore={() => undefined} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(screen.queryByRole('toolbar')).not.toBeNull();
    useFloatingBarPrefs.setState({ enabled: false });
    rerender(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
