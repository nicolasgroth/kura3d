/**
 * @file src/components/__tests__/PaintPalette.test.tsx
 * @description Paleta de pintura en pantalla: elegir, editar con clic derecho y con Mayús+F10, quitar, agregar,
 * paletas predefinidas, colores del proyecto, volver a la original, persistencia y «N más» con muchas muestras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, STORAGE_PAINT_PALETTE_KEY, usePaintPalette } from '../../store/paintPalette';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { PaintPalette } from '../paint/PaintPalette';

const swatches = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-swatch]'));

beforeEach(() => {
  localStorage.clear();
  usePaintPalette.setState({ preset: DEFAULT_PALETTE.preset, colors: [...DEFAULT_PALETTE.colors] });
  useKuraStore.setState({ language: 'es', objects: [], selectedIds: [], paintColor: '#38bdf8' } as never);
});

describe('PaintPalette', () => {
  it('cada muestra tiene nombre de color y la elegida queda pulsada', () => {
    render(<PaintPalette />);
    expect(swatches()).toHaveLength(8);
    const red = swatches()[4];
    expect(red.getAttribute('aria-label')).toBeTruthy();
    fireEvent.click(red);
    expect(useKuraStore.getState().paintColor).toBe('#ef4444');
    expect(red.getAttribute('aria-pressed')).toBe('true');
  });

  it('clic derecho abre la edición; cambia el color y se guarda', () => {
    render(<PaintPalette />);
    fireEvent.contextMenu(swatches()[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(dialog.querySelector('input[type="color"]')!, { target: { value: '#123456' } });
    expect(usePaintPalette.getState().colors[0]).toBe('#123456');
    expect(JSON.parse(localStorage.getItem(STORAGE_PAINT_PALETTE_KEY)!).colors[0]).toBe('#123456');
  });

  it('Mayús+F10 abre la edición con el teclado, Esc la cierra y quitar funciona', () => {
    render(<PaintPalette />);
    fireEvent.keyDown(swatches()[1], { key: 'F10', shiftKey: true });
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(swatches()[1], { key: 'ContextMenu' });
    fireEvent.click(screen.getByRole('button', { name: /Quitar de la paleta/ }));
    expect(swatches()).toHaveLength(7);
  });

  it('agrega el color actual, elige una paleta y vuelve a la original', () => {
    useKuraStore.setState({ paintColor: '#010203' } as never);
    render(<PaintPalette />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar el color actual a la paleta' }));
    expect(swatches()).toHaveLength(9);
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de la paleta' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Paleta' }), { target: { value: 'pastel' } });
    expect(usePaintPalette.getState().preset).toBe('pastel');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la paleta original' }));
    expect(usePaintPalette.getState().colors).toEqual(DEFAULT_PALETTE.colors);
    expect(localStorage.getItem(STORAGE_PAINT_PALETTE_KEY)).toBeNull();
  });

  it('suma los colores del proyecto a la paleta sin perder los anteriores', () => {
    useKuraStore.setState({ objects: [{ ...fakeBox('a', 'A'), color: '#abcdef' }] } as never);
    render(<PaintPalette />);
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de la paleta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar los colores del proyecto' }));
    expect(usePaintPalette.getState().colors).toEqual([...DEFAULT_PALETTE.colors, '#abcdef']);
  });

  it('con muchas muestras dibuja las primeras 24 y el resto bajo «N más»', () => {
    const many = Array.from({ length: 100 }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`);
    usePaintPalette.setState({ preset: 'custom', colors: many });
    render(<PaintPalette />);
    expect(swatches()).toHaveLength(24);
    fireEvent.click(screen.getByRole('button', { name: '76 más' }));
    expect(swatches()).toHaveLength(100);
  });
});
