/**
 * @file src/components/__tests__/ProjectMenu.test.tsx
 * @description Humo del menú Proyecto: apertura y navegación con teclado, Escape devuelve el foco
 * y cada acción declara su atajo accesible.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { ProjectMenu } from '../ProjectMenu';

const trigger = () => screen.getByRole('button', { name: new RegExp(t('es', 'fileProject.menu')) });

describe('ProjectMenu', () => {
  it('abre con flecha abajo, recorre con teclado y Escape devuelve el foco al botón', async () => {
    const user = userEvent.setup();
    render(<ProjectMenu />);
    trigger().focus();
    await user.keyboard('{ArrowDown}');
    expect(trigger()).toHaveProperty('ariaExpanded', 'true');
    const items = screen.getAllByRole('menuitem', { hidden: true });
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(items[items.length - 1]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(trigger());
    expect(trigger()).toHaveProperty('ariaExpanded', 'false');
  });

  it('declara atajos con modificador y Guardar ejecuta la acción del store', async () => {
    const saveProject = vi.fn(async () => true);
    useKuraStore.setState({ saveProject } as never);
    const user = userEvent.setup();
    render(<ProjectMenu />);
    const save = screen.getByRole('menuitem', { name: t('es', 'fileProject.save'), hidden: true });
    const saveAs = screen.getByRole('menuitem', { name: t('es', 'fileProject.saveAs'), hidden: true });
    expect(save.getAttribute('aria-keyshortcuts')).toMatch(/^(Control|Meta)\+S$/);
    expect(saveAs.getAttribute('aria-keyshortcuts')).toMatch(/^(Control|Meta)\+Shift\+S$/);
    expect(screen.getByRole('menuitem', { name: t('es', 'fileProject.new'), hidden: true }).getAttribute('aria-keyshortcuts')).toMatch(/\+N$/);
    await user.click(save);
    expect(saveProject).toHaveBeenCalledTimes(1);
  });

  it('queda deshabilitado mientras corre una operación', () => {
    useKuraStore.setState({ busyOperation: 'boolean' } as never);
    render(<ProjectMenu />);
    expect(trigger()).toHaveProperty('disabled', true);
  });
});
