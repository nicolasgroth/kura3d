/**
 * @file src/components/__tests__/ProjectInfoSection.test.tsx
 * @description Sección «Datos del proyecto» del panel Proyecto: etiquetas asociadas a cada campo, escritura en el
 * store (descripción, notas con contador, autor), marca de cambios sin guardar, texto con HTML mostrado como texto,
 * datos de solo lectura (creado, modificado, tiempo de trabajo) en formato humano, campos deshabilitados mientras se
 * guarda y textos en los 6 idiomas; en recientes (web) se ven la descripción y la fecha, nunca las notas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { PROJECT_INFO_LIMITS } from '../../project/projectInfo';
import { captureProject, isProjectDirty, useKuraStore } from '../../store/useKuraStore';
import { RECENT_INFO_KEY } from '../../utils/recentProjectInfo';
import { RECENT_PROJECTS_KEY } from '../../utils/recentProjects';
import { ProjectFileActions } from '../contextPanel/ProjectFileActions';
import { ProjectInfoSection } from '../contextPanel/ProjectInfoSection';

const CREATED = '2026-11-20T10:00:00Z';

describe('Datos del proyecto (panel)', () => {
  beforeEach(() => {
    useKuraStore.setState({
      language: 'es', projectInfo: { createdAt: CREATED }, projectWorkSeconds: 0, projectBusy: false,
      objects: [], past: [], future: [], projectRenamed: false, projectRecovered: false,
    } as never);
    // Lo guardado coincide con el estado de partida: el proyecto empieza limpio.
    useKuraStore.setState({ savedProject: captureProject(useKuraStore.getState()) });
  });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('cada campo tiene su etiqueta asociada y un tooltip', () => {
    render(<ProjectInfoSection />);
    const description = screen.getByLabelText(t('es', 'projectInfo.description'));
    const notes = screen.getByLabelText(t('es', 'projectInfo.notes'));
    const author = screen.getByLabelText(t('es', 'projectInfo.author'));
    expect(description.tagName).toBe('INPUT');
    expect(notes.tagName).toBe('TEXTAREA');
    expect(author.tagName).toBe('INPUT');
    for (const field of [description, notes, author]) expect(field.getAttribute('title')).toBeTruthy();
    expect(screen.getByRole('region', { name: t('es', 'projectInfo.title') })).toBeTruthy();
    expect(description.getAttribute('maxlength')).toBe(String(PROJECT_INFO_LIMITS.description));
    expect(notes.getAttribute('maxlength')).toBe(String(PROJECT_INFO_LIMITS.notes));
    expect(author.getAttribute('autocomplete')).toBe('off');
  });

  it('escribir actualiza el store, el contador y marca cambios sin guardar (sin tocar el historial)', async () => {
    const user = userEvent.setup();
    render(<ProjectInfoSection />);
    expect(isProjectDirty(useKuraStore.getState())).toBe(false);
    await user.type(screen.getByLabelText(t('es', 'projectInfo.description')), 'Soporte de pared');
    await user.type(screen.getByLabelText(t('es', 'projectInfo.notes')), 'uno{Enter}dos');
    await user.type(screen.getByLabelText(t('es', 'projectInfo.author')), 'Ana');
    expect(useKuraStore.getState().projectInfo).toMatchObject({ description: 'Soporte de pared', notes: 'uno\ndos', author: 'Ana' });
    expect(isProjectDirty(useKuraStore.getState())).toBe(true);
    expect(useKuraStore.getState().past).toEqual([]);
    expect(screen.getByTestId('project-info-notes-count').textContent).toBe(t('es', 'projectInfo.notesCount', { count: 7, max: PROJECT_INFO_LIMITS.notes }));
    // El contador se asocia al área de notas para lectores de pantalla.
    expect(screen.getByLabelText(t('es', 'projectInfo.notes')).getAttribute('aria-describedby')).toBe(screen.getByTestId('project-info-notes-count').id);
  });

  it('el HTML se escribe y se muestra como texto, nunca como marcado', () => {
    useKuraStore.setState({ projectInfo: { createdAt: CREATED, notes: '<img src=x onerror=alert(1)><b>x</b>', description: '<script>1</script>' } } as never);
    const { container } = render(<ProjectInfoSection />);
    expect((screen.getByLabelText(t('es', 'projectInfo.notes')) as HTMLTextAreaElement).value).toBe('<img src=x onerror=alert(1)><b>x</b>');
    expect(container.querySelector('img, script, b')).toBeNull();
  });

  it('muestra creado, modificado y tiempo de trabajo en formato humano', () => {
    const recent = new Date(Date.now() - 3 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    useKuraStore.setState({ projectInfo: { createdAt: CREATED, modifiedAt: recent }, projectWorkSeconds: 2 * 3600 + 15 * 60 + 40 } as never);
    render(<ProjectInfoSection />);
    expect(screen.getByTestId('project-info-created').textContent).toContain(' · ');
    expect(screen.getByTestId('project-info-modified').textContent).toMatch(/hace 3 días · /);
    expect(screen.getByTestId('project-info-work').textContent).toBe('2 h 15 min');
  });

  it('sin guardar todavía y sin fecha de creación lo dice, no inventa', () => {
    useKuraStore.setState({ projectInfo: {}, projectWorkSeconds: 20 } as never);
    render(<ProjectInfoSection />);
    expect(screen.getByTestId('project-info-created').textContent).toBe(t('es', 'projectInfo.noDate'));
    expect(screen.getByTestId('project-info-modified').textContent).toBe(t('es', 'projectInfo.notSavedYet'));
    expect(screen.getByTestId('project-info-work').textContent).toBe(t('es', 'projectInfo.work.under'));
  });

  it('se deshabilita mientras se guarda', () => {
    useKuraStore.setState({ projectBusy: true } as never);
    render(<ProjectInfoSection />);
    for (const label of ['description', 'notes', 'author'] as const) {
      expect(screen.getByLabelText(t('es', `projectInfo.${label}`))).toHaveProperty('disabled', true);
    }
  });

  it('los textos existen en los 6 idiomas', () => {
    for (const language of ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const) {
      useKuraStore.setState({ language } as never);
      const { unmount } = render(<ProjectInfoSection />);
      expect(screen.getByLabelText(t(language, 'projectInfo.notes'))).toBeTruthy();
      expect(t(language, 'projectInfo.title')).not.toBe('projectInfo.title');
      unmount();
    }
  });

  it('en recientes (web) se ven descripción y fecha de modificación, pero no las notas', () => {
    const modifiedAt = new Date(Date.now() - 2 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify([{ name: 'Caja.kura', openedAt: Date.now() }]));
    localStorage.setItem(RECENT_INFO_KEY, JSON.stringify([['Caja.kura', { description: 'Caja con tapa', modifiedAt, notes: 'SECRETO' }]]));
    render(<ProjectFileActions />);
    const group = screen.getByRole('group', { name: t('es', 'project.recent.title') });
    expect(within(group).getByTestId('recent-description').textContent).toBe('Caja con tapa');
    expect(within(group).getByTestId('recent-modified').textContent).toContain('hace 2 horas');
    expect(group.textContent).not.toContain('SECRETO');
  });
});
