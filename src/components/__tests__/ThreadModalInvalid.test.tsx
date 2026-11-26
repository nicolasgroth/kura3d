/**
 * @file src/components/__tests__/ThreadModalInvalid.test.tsx
 * @description Diálogo de roscas: un texto no numérico o fuera de rango en el diámetro se marca en el campo
 * y "Crear" queda deshabilitado con el motivo; no se crea una M8 con el valor anterior en silencio. Al
 * corregir el valor vuelve a habilitarse.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { ThreadModal } from '../dialogs/ThreadModal';

vi.mock('../preview/PreviewButton', () => ({ PreviewButton: () => null }));

const create = vi.fn();
const createButton = () => screen.getByRole('button', { name: new RegExp(t('es', 'dialog.thread.execute')), hidden: true });

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue(null);
  useKuraStore.setState({ language: 'es', createThreadObject: create } as never);
});

describe('ThreadModal con valores inválidos', () => {
  it('texto no numérico: error visible en el campo y no crea', async () => {
    const user = userEvent.setup();
    render(<ThreadModal open onClose={() => undefined} />);
    const diam = screen.getByLabelText(t('es', 'dialog.thread.diameter')) as HTMLInputElement;
    await user.click(diam);
    await user.clear(diam);
    await user.type(diam, 'abc{Enter}');
    expect(diam.getAttribute('aria-invalid')).toBe('true');
    expect(createButton()).toHaveProperty('disabled', true);
    expect(screen.getAllByRole('alert').map((a) => a.textContent).join(' ')).toContain(t('es', 'dialog.thread.invalidFields'));
    await user.click(createButton());
    expect(create).not.toHaveBeenCalled();
  });

  it('fuera de rango: no se acota en silencio, se avisa el rango permitido y no crea', async () => {
    const user = userEvent.setup();
    render(<ThreadModal open onClose={() => undefined} />);
    const diam = screen.getByLabelText(t('es', 'dialog.thread.diameter')) as HTMLInputElement;
    await user.click(diam);
    await user.clear(diam);
    await user.type(diam, '100{Enter}');
    expect(diam.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(diam.getAttribute('aria-describedby')!)?.textContent).toContain('3');
    expect(createButton()).toHaveProperty('disabled', true);
    expect(create).not.toHaveBeenCalled();
    // Corregido, vuelve a poder crear.
    await user.click(diam);
    await user.clear(diam);
    await user.type(diam, '10{Enter}');
    expect(createButton()).toHaveProperty('disabled', false);
  });
});
