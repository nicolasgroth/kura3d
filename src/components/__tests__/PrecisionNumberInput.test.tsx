/**
 * @file src/components/__tests__/PrecisionNumberInput.test.tsx
 * @description Humo del campo numérico: expresión aritmética, valor inválido marcado y Escape revierte.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { PrecisionNumberInput } from '../PrecisionNumberInput';

function setup() {
  const onChange = vi.fn();
  render(<PrecisionNumberInput value={10} onChange={onChange} ariaLabel="Ancho (mm)" suffix="mm" />);
  return { onChange, input: screen.getByLabelText('Ancho (mm)') as HTMLInputElement };
}

describe('PrecisionNumberInput', () => {
  it('evalúa una expresión al confirmar con Enter', async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.click(input);
    await user.clear(input);
    await user.type(input, '10+5*2{Enter}');
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toBe(20);
  });

  it('marca un valor inválido sin aplicarlo y Escape restaura el valor previo', async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.click(input);
    await user.clear(input);
    await user.type(input, '*5{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toContain(t('es', 'precision.invalidValue'));
    // Enter sale del campo; al volver se conserva el texto inválido y Escape lo descarta.
    // (Solo un número simple completo se aplica en vivo; por eso la prueba no empieza por un dígito.)
    await user.click(input);
    expect(input.value).toBe('*5');
    await user.keyboard('{Escape}');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.value).toBe('10');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('PrecisionNumberInput con grouping (campo ya formateado «500.007»)', () => {
  const mountGrouped = () => {
    const onChange = vi.fn();
    render(<PrecisionNumberInput value={500007} onChange={onChange} precision={0} grouping ariaLabel="Triángulos finales" />);
    return { onChange, input: screen.getByLabelText('Triángulos finales') as HTMLInputElement };
  };

  it('al enfocar desformatea ANTES de seleccionar: el texto completo queda seleccionado y el valor nuevo lo reemplaza', () => {
    const { onChange, input } = mountGrouped();
    expect(input.value).toBe('500.007');
    fireEvent.focus(input);
    expect(input.value).toBe('500007');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    // Lo que hace `fill()`: reemplaza la selección completa con el valor nuevo.
    fireEvent.change(input, { target: { value: '256000' } });
    expect(input.value).toBe('256000');
    expect(onChange).toHaveBeenLastCalledWith(256000);
  });

  it('un cambio directo sobre el campo formateado y sin foco acepta el valor entrante completo', () => {
    const { onChange, input } = mountGrouped();
    fireEvent.change(input, { target: { value: '256000' } });
    expect(onChange).toHaveBeenLastCalledWith(256000);
  });
});
