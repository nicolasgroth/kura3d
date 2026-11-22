/**
 * @file src/components/__tests__/SceneObjectList.test.tsx
 * @description Humo de la lista de escena: selección por clic, Ctrl+clic y teclado (flechas, Inicio, Escape).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { SceneObjectList } from '../scene/SceneObjectList';

const selected = () => useKuraStore.getState().selectedIds;

function setup() {
  useKuraStore.setState({ objects: [fakeBox('a', 'Alfa'), fakeBox('b', 'Beta'), fakeBox('c', 'Gamma')], selectedIds: [] } as never);
  render(<SceneObjectList />);
  return { list: screen.getByRole('listbox'), options: screen.getAllByRole('option') };
}

describe('SceneObjectList', () => {
  it('selecciona con clic y suma con Ctrl+clic', async () => {
    const user = userEvent.setup();
    const { options } = setup();
    await user.click(options[1]);
    expect(selected()).toEqual(['b']);
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Control>}');
    await user.click(screen.getAllByRole('option')[2]);
    await user.keyboard('{/Control}');
    expect(selected()).toEqual(['b', 'c']);
  });

  it('mueve la selección con flechas e Inicio y la limpia con Escape', async () => {
    const user = userEvent.setup();
    const { options, list } = setup();
    await user.click(options[0]);
    expect(selected()).toEqual(['a']);
    list.focus();
    await user.keyboard('{ArrowDown}');
    expect(selected()).toEqual(['b']);
    await user.keyboard('{ArrowDown}');
    expect(selected()).toEqual(['c']);
    await user.keyboard('{Home}');
    expect(selected()).toEqual(['a']);
    await user.keyboard('{Escape}');
    expect(selected()).toEqual([]);
  });
});
