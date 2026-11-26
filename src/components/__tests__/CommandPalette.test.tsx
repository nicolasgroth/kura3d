/**
 * @file src/components/__tests__/CommandPalette.test.tsx
 * @description Humo de la paleta de comandos: el mejor resultado va primero y, con una operación en
 * curso, los comandos que crean u operan quedan deshabilitados y no se ejecutan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { CommandPalette } from '../CommandPalette';

function setup() {
  useKuraStore.setState({ commandPaletteOpen: true } as never);
  render(<CommandPalette />);
  return screen.getByRole('combobox', { name: t('es', 'cmd.inputLabel') });
}

describe('CommandPalette', () => {
  it('ordena primero la coincidencia más cercana', async () => {
    const user = userEvent.setup();
    const input = setup();
    await user.type(input, 'cubo');
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].textContent?.toLowerCase()).toContain('cubo');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
  });

  it('deshabilita crear con una operación en curso y Enter no lo ejecuta', async () => {
    useKuraStore.setState({ busyOperation: 'boolean' } as never);
    const user = userEvent.setup();
    const input = setup();
    await user.type(input, 'cubo');
    const first = screen.getAllByRole('option')[0];
    expect(first.getAttribute('aria-disabled')).toBe('true');
    await user.keyboard('{Enter}');
    expect(useKuraStore.getState().commandPaletteOpen).toBe(true);
    expect(useKuraStore.getState().objects).toHaveLength(0);
  });

  it('sin operación en curso los comandos no están deshabilitados', async () => {
    const user = userEvent.setup();
    const input = setup();
    await user.type(input, 'cubo');
    expect(screen.getAllByRole('option')[0].getAttribute('aria-disabled')).toBeNull();
  });

  it('«Simplificar…» abre el panel con su vista previa y no modifica la pieza', async () => {
    const box = fakeBox('a', 'Pieza A');
    const simplifySelectedMesh = vi.fn();
    useKuraStore.setState({ objects: [box], selectedIds: ['a'], simplifyRequest: null, simplifySelectedMesh } as never);
    const user = userEvent.setup();
    const input = setup();
    await user.type(input, 'simplificar');
    await user.keyboard('{Enter}');
    expect(useKuraStore.getState().simplifyRequest?.id).toBe('a');
    expect(simplifySelectedMesh).not.toHaveBeenCalled();
    expect(useKuraStore.getState().objects[0]).toBe(box);
  });
});
