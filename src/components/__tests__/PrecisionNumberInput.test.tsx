/**
 * @file src/components/__tests__/PrecisionNumberInput.test.tsx
 * @description Humo del campo numérico: expresión aritmética, valor inválido marcado y Escape revierte.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
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
