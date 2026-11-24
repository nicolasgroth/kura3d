/**
 * @file src/components/__tests__/ProjectFileActions.test.tsx
 * @description Panel Proyecto: el botón «Proyecto» de la barra ya no abre un menú (muestra el panel y quita la
 * selección); las acciones de archivo son botones con atajo accesible que ejecutan la acción del store; el nombre
 * se edita en línea (Enter confirma, Esc cancela, vacío no se acepta) y marca cambios sin guardar; cama y
 * unidades se editan ahí mismo con su lápiz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { isProjectDirty, useKuraStore } from '../../store/useKuraStore';
import { ProjectFileActions } from '../contextPanel/ProjectFileActions';
import { ProjectSummary } from '../contextPanel/ProjectSummary';
import { ProjectButton } from '../ProjectButton';

describe('Panel Proyecto', () => {
  beforeEach(() => {
    useKuraStore.setState({ projectName: 'Tapa.kura', projectRenamed: false, projectRecovered: false, savedProject: null, objects: [], busyOperation: null, projectBusy: false } as never);
  });

  it('el botón Proyecto no es un menú: muestra el panel sin quitar la selección y lo abre si estaba plegado', async () => {
    useKuraStore.setState({ selectedIds: ['a'], rightCollapsed: true, activeAction: 'hollow' } as never);
    const user = userEvent.setup();
    render(<ProjectButton />);
    const button = screen.getByRole('button', { name: new RegExp(t('es', 'fileProject.menu')) });
    expect(button.getAttribute('aria-haspopup')).toBeNull();
    await user.click(button);
    const s = useKuraStore.getState();
    expect(s.selectedIds).toEqual(['a']);
    expect(s.projectPanelPin).not.toBeNull();
    expect(s.rightCollapsed).toBe(false);
  });

  it('acciones de archivo con atajo accesible; Guardar ejecuta la acción del store', async () => {
    const saveProject = vi.fn(async () => true);
    useKuraStore.setState({ saveProject } as never);
    const user = userEvent.setup();
    render(<ProjectFileActions />);
    const save = screen.getByRole('button', { name: t('es', 'fileProject.save') });
    const saveAs = screen.getByRole('button', { name: t('es', 'fileProject.saveAs') });
    expect(save.getAttribute('aria-keyshortcuts')).toMatch(/^(Control|Meta)\+S$/);
    expect(saveAs.getAttribute('aria-keyshortcuts')).toMatch(/^(Control|Meta)\+Shift\+S$/);
    expect(screen.getByRole('button', { name: t('es', 'fileProject.new') }).getAttribute('aria-keyshortcuts')).toMatch(/\+N$/);
    expect(screen.getByRole('button', { name: t('es', 'fileProject.open') }).getAttribute('aria-keyshortcuts')).toMatch(/\+O$/);
    await user.click(save);
    expect(saveProject).toHaveBeenCalledTimes(1);
    await user.click(saveAs);
    expect(saveProject).toHaveBeenLastCalledWith(true);
  });

  it('quedan deshabilitadas mientras corre una operación', () => {
    useKuraStore.setState({ busyOperation: 'boolean' } as never);
    render(<ProjectFileActions />);
    expect(screen.getByRole('button', { name: t('es', 'fileProject.save') })).toHaveProperty('disabled', true);
  });

  it('nombre en línea: Enter confirma y marca cambios; Esc cancela; vacío no se acepta', async () => {
    const user = userEvent.setup();
    render(<ProjectSummary />);
    await user.click(screen.getByRole('button', { name: t('es', 'r3a.name.edit') }));
    const field = screen.getByRole('textbox', { name: t('es', 'r3a.name.field') });
    expect((field as HTMLInputElement).value).toBe('Tapa');
    await user.clear(field);
    expect(screen.getByRole('alert').textContent).toBe(t('es', 'r3a.name.empty'));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: t('es', 'r3a.name.field') })).toBeTruthy();
    expect(useKuraStore.getState().projectName).toBe('Tapa.kura');
    await user.type(field, 'Soporte{Enter}');
    expect(useKuraStore.getState().projectName).toBe('Soporte.kura');
    expect(isProjectDirty(useKuraStore.getState())).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: t('es', 'r3a.name.edit') })));

    // F2 con el foco en el lápiz también edita; Esc cancela sin cambiar el nombre.
    await user.keyboard('{F2}');
    await user.type(screen.getByRole('textbox', { name: t('es', 'r3a.name.field') }), 'Otro');
    await user.keyboard('{Escape}');
    expect(useKuraStore.getState().projectName).toBe('Soporte.kura');
    expect(screen.queryByRole('textbox', { name: t('es', 'r3a.name.field') })).toBeNull();
  });

  it('cama y unidades se editan ahí mismo con su lápiz; Esc pliega y devuelve el foco', async () => {
    const user = userEvent.setup();
    render(<ProjectSummary />);
    const units = screen.getByRole('button', { name: t('es', 'r3a.units.edit') });
    expect(units.getAttribute('aria-expanded')).toBe('false');
    await user.click(units);
    expect(units.getAttribute('aria-expanded')).toBe('true');
    const select = screen.getByRole('combobox', { name: t('es', 'dialog.settings.unitLabel') });
    await waitFor(() => expect(document.activeElement).toBe(select));
    await user.selectOptions(select, 'cm');
    expect(useKuraStore.getState().unitSystem).toBe('cm');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(units));
    expect(units.getAttribute('aria-expanded')).toBe('false');

    await user.click(screen.getByRole('button', { name: t('es', 'r3a.bed.edit') }));
    expect(screen.getByTestId('fit-bed-select')).toBeTruthy();
  });
});
