/**
 * @file src/components/__tests__/narrowPanelBarResize.test.tsx
 * @description Botón de tamaño de la hoja inferior móvil: tiene nombre propio («Cambiar tamaño del panel», no el del
 * inspector de escritorio), describe la altura actual y con teclado recorre plegada, media y completa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import type { SheetHeight } from '../narrow/sheetHeight';
import { NarrowPanelBar } from '../NarrowPanelBar';

function bar(height: SheetHeight, onHeightChange: (h: SheetHeight) => void) {
  return (
    <NarrowPanelBar language="es" panel="right" opTitle={null} height={height} onToggle={() => {}} onClose={() => {}} onHeightChange={onHeightChange} />
  );
}

describe('botón de tamaño de la hoja', () => {
  it('se llama «Cambiar tamaño del panel» y describe la altura actual', () => {
    render(bar('half', () => {}));
    const button = screen.getByRole('button', { name: 'Cambiar tamaño del panel' });
    expect(screen.queryByRole('button', { name: /inspector derecho/i })).toBeNull();
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(t('es', 'uxm.sheet.grip', { state: 'medio' }));
  });

  it('recorre plegada, media y completa con el teclado, sin arrastrar', () => {
    const onHeightChange = vi.fn();
    const { rerender } = render(bar('folded', onHeightChange));
    const press = () => fireEvent.click(screen.getByRole('button', { name: 'Cambiar tamaño del panel' }));
    press();
    expect(onHeightChange).toHaveBeenLastCalledWith('half');
    rerender(bar('half', onHeightChange));
    press();
    expect(onHeightChange).toHaveBeenLastCalledWith('full');
    rerender(bar('full', onHeightChange));
    press();
    expect(onHeightChange).toHaveBeenLastCalledWith('folded');
  });
});
