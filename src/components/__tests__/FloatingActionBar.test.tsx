/**
 * @file src/components/__tests__/FloatingActionBar.test.tsx
 * @description Barra flotante de acciones: botones y nombres del menú contextual, cada botón ejecuta la acción del store,
 * Bloquear con `aria-pressed`, teclado (una parada de tabulación, flechas, Inicio/Fin, Alt+.) y reglas de visibilidad.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKeyholePanel } from '../../store/keyholePanel';
import { PRINT_COLOR_PALETTE } from '../../types/kura';
import { colorName } from '../../utils/colorNames';
import { useFloatingBarPrefs } from '../../store/floatingBarState';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { FloatingActionBar } from '../viewport/FloatingActionBar';

const deleteSelection = vi.fn();
vi.mock('../scene/confirmDeleteSelection', () => ({ confirmDeleteSelection: (ids?: string[]) => deleteSelection(ids) }));

const duplicateObjects = vi.fn();
const toggleSelectionVisibility = vi.fn(() => ['a']);
const updateObjectsMeta = vi.fn();

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
    updateObjectsMeta,
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
    expect(updateObjectsMeta).toHaveBeenCalledWith(['a'], { locked: true });
    fireEvent.click(btn('delete'));
    expect(deleteSelection).toHaveBeenCalledWith(['a']);
  });

  it('el color cambia la selección entera', () => {
    useKuraStore.setState({ selectedIds: ['a', 'b'] } as never);
    const { container } = render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    fireEvent.change(container.querySelector('input[type="color"]')!, { target: { value: '#123456' } });
    expect(updateObjectsMeta).toHaveBeenCalledWith(['a', 'b'], { color: '#123456' }, true);
  });

  it('Bloquear lleva aria-pressed y pasa a Desbloquear; Ocultar pasa a Mostrar', () => {
    useKuraStore.setState({ objects: [{ ...fakeBox('a', 'Caja A'), locked: true, visible: false }, fakeBox('b', 'Caja B')] } as never);
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(btn('lock').getAttribute('aria-pressed')).toBe('true');
    expect(btn('lock').getAttribute('aria-label')).toBe(t('es', 'ux8.menu.unlock'));
    expect(btn('hide').getAttribute('aria-label')).toBe(t('es', 'ux8.menu.show'));
    fireEvent.click(btn('lock'));
    expect(updateObjectsMeta).toHaveBeenCalledWith(['a'], { locked: false });
    // Eliminar no actúa sobre un objeto bloqueado.
    expect(btn('delete').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(btn('delete'));
    expect(deleteSelection).not.toHaveBeenCalled();
    // Con todo bloqueado el color no tendría efecto: el botón lo dice.
    expect(btn('color').getAttribute('aria-disabled')).toBe('true');
  });

  it('no se vuelve a pintar por cambios de la escena que no muestra (selector estrecho)', () => {
    // El Profiler avisa cada vez que la barra (su único hijo) se vuelve a pintar.
    let renders = 0;
    render(
      <React.Profiler id="bar" onRender={() => { renders += 1; }}>
        <FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />
      </React.Profiler>,
    );
    const before = toolbar().innerHTML;
    // Mover la pieza no seleccionada crea una lista `objects` nueva: la barra no cambia.
    act(() => useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === 'b' ? { ...o, position: [9, 0, 0] } : o)) }) as never));
    expect(toolbar().innerHTML).toBe(before);
    expect(renders).toBe(1);
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

  it('Color abre la paleta del inspector; una muestra cambia el color con un solo paso de deshacer', () => {
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(screen.queryByTestId('floating-bar-palette')).toBeNull();
    fireEvent.click(btn('color'));
    const palette = screen.getByTestId('floating-bar-palette');
    expect(btn('color').getAttribute('aria-expanded')).toBe('true');
    const swatches = Array.from(palette.querySelectorAll<HTMLButtonElement>('.kura-floating-bar-swatch'));
    expect(swatches.map((b) => b.getAttribute('aria-label'))).toEqual(PRINT_COLOR_PALETTE.map((hex) => colorName('es', hex)));
    fireEvent.click(swatches[1]);
    expect(updateObjectsMeta).toHaveBeenCalledTimes(1);
    expect(updateObjectsMeta).toHaveBeenCalledWith(['a'], { color: PRINT_COLOR_PALETTE[1] }, true);
    expect(screen.queryByTestId('floating-bar-palette')).toBeNull();
    expect(document.activeElement).toBe(btn('color'));
  });

  it('la paleta deja «Otro color…» como última opción y Escape la cierra devolviendo el foco a Color', () => {
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    fireEvent.click(btn('color'));
    const options = Array.from(screen.getByTestId('floating-bar-palette').querySelectorAll('button'));
    expect(options[options.length - 1].getAttribute('aria-label')).toBe(t('es', 'floatingBar.color.custom'));
    fireEvent.keyDown(options[0], { key: 'Escape' });
    expect(screen.queryByTestId('floating-bar-palette')).toBeNull();
    expect(document.activeElement).toBe(btn('color'));
  });

  it('el atajo Alt+. queda anunciado en la barra', () => {
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(toolbar().getAttribute('aria-keyshortcuts')).toBe('Alt+Period');
    expect(toolbar().title).toContain('Alt+.');
  });

  it('con Colgar en el muro abierto la barra se oculta, igual que con Torreta o Dividir', () => {
    useKeyholePanel.setState({ open: true });
    render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    act(() => useKeyholePanel.setState({ open: false }));
    expect(screen.queryByRole('toolbar')).not.toBeNull();
  });

  it('cerrar con Escape el menú abierto desde «Más» devuelve el foco al botón «Más»', async () => {
    const rafs: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafs.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const { rerender } = render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    fireEvent.click(btn('more'));
    rerender(<FloatingActionBar contextMenuOpen onMore={() => undefined} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    rerender(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    // El visor coloca la barra en el siguiente cuadro; recién entonces recibe el foco.
    toolbar().dataset.placed = 'true';
    toolbar().dataset.busy = 'false';
    act(() => rafs.shift()?.(0));
    expect(document.activeElement).toBe(btn('more'));
    vi.unstubAllGlobals();
  });

  it('cerrar el menú de «Más» sin Escape (clic fuera) no roba el foco', () => {
    const rafs: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafs.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const { rerender } = render(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    fireEvent.click(btn('more'));
    rerender(<FloatingActionBar contextMenuOpen onMore={() => undefined} />);
    rerender(<FloatingActionBar contextMenuOpen={false} onMore={() => undefined} />);
    expect(rafs).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
