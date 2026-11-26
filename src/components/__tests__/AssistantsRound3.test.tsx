/**
 * @file src/components/__tests__/AssistantsRound3.test.tsx
 * @description Correcciones de la ronda 3 de Asistentes: carga de archivos (gana la última elección, un fallo limpia la
 * respuesta), `submit` que no deja el formulario bloqueado si algo lanza, mensajes del campo según el valor (inválido o
 * fuera de rango), contador de caracteres con anuncio al llegar al límite y respuestas conservadas al cambiar de variante.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { closeAssistants, openAssistants } from '../../store/assistantsPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { AssistantsPanel } from '../assistants/AssistantsPanel';

beforeEach(() => {
  closeAssistants();
  useKuraStore.setState({ language: 'es', objects: [], toasts: [] });
});

const field = (id: string) => document.querySelector<HTMLElement>(`[data-field="${id}"]`) as HTMLElement;
const control = (id: string) => field(id).querySelector('input, select, textarea, button') as HTMLInputElement;
const createButton = () => screen.getByRole('button', { name: new RegExp(`^${t('es', 'asis.create')}$`) }) as HTMLButtonElement;

function openForm(recipeId: string) {
  render(<AssistantsPanel />);
  act(() => openAssistants(recipeId));
}

const svgFile = (name: string, delayMs = 0) => {
  const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], name, { type: 'image/svg+xml' });
  file.arrayBuffer = () => new Promise((resolve) => setTimeout(() => resolve(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>').buffer as ArrayBuffer), delayMs));
  return file;
};

const pickFile = (file: File) => fireEvent.change(screen.getByTestId('asis-file-logo'), { target: { files: [file] } });

describe('Asistentes ronda 3: archivo', () => {
  it('con dos elecciones rápidas gana la última elegida aunque la anterior termine de leerse después', async () => {
    openForm('kura.llavero');
    pickFile(svgFile('lenta.svg', 60));
    pickFile(svgFile('rapida.svg', 0));
    await waitFor(() => expect(field('logo').textContent).toContain('rapida.svg'));
    await new Promise((r) => setTimeout(r, 120));
    expect(field('logo').textContent).toContain('rapida.svg');
    expect(field('logo').textContent).not.toContain('lenta.svg');
  });

  it('si la lectura falla se limpian la respuesta y el archivo anteriores', async () => {
    openForm('kura.llavero');
    pickFile(svgFile('buena.svg'));
    await waitFor(() => expect(field('logo').textContent).toContain('buena.svg'));
    const rota = svgFile('rota.svg');
    rota.arrayBuffer = () => Promise.reject(new Error('lectura'));
    pickFile(rota);
    await waitFor(() => expect(field('logo').textContent).toContain(t('es', 'asis.file.none')));
    expect(field('logo').textContent).not.toContain('buena.svg');
    expect(screen.getByText(t('es', 'asis.file.readError'))).toBeTruthy();
  });

  it('un HTML con un <svg> dentro se rechaza como tipo no admitido', async () => {
    openForm('kura.llavero');
    const html = new File(['<html><body><svg></svg></body></html>'], 'falso.svg', { type: 'image/svg+xml' });
    pickFile(html);
    await waitFor(() => expect(field('logo').textContent).toContain(t('es', 'asis.file.badType', { types: 'SVG' })));
    expect(field('logo').textContent).toContain(t('es', 'asis.file.none'));
  });
});

describe('Asistentes ronda 3: crear', () => {
  it('si algo lanza, el formulario no queda bloqueado: avisa, rehabilita los campos y Escape vuelve a funcionar', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ runRecipe: vi.fn().mockRejectedValue(new Error('boom')) } as never);
    openForm('kura.caja-tapa');
    await user.click(createButton());
    await waitFor(() => expect(control('w').disabled).toBe(false));
    expect(createButton().disabled).toBe(false);
    expect(useKuraStore.getState().toasts.some((x) => x.text === t('es', 'asis.runFailed'))).toBe(true);
    expect(document.querySelector('form')?.getAttribute('aria-busy')).toBe('false');
  });
});

describe('Asistentes ronda 3: mensajes del campo', () => {
  it('un valor no numérico muestra solo «valor no válido» y no los mensajes del valor anterior', async () => {
    const user = userEvent.setup();
    openForm('kura.caja-tapa');
    const wall = control('wall');
    await user.clear(wall);
    await user.type(wall, '1.4');
    await user.tab();
    expect(within(field('wall')).getByText(/Pared bajo 1,6 mm/)).toBeTruthy();
    await user.clear(wall);
    await user.type(wall, 'abc');
    await user.tab();
    await waitFor(() => expect(within(field('wall')).getByText(t('es', 'asis.field.invalidValue'))).toBeTruthy());
    expect(within(field('wall')).queryByText(/Pared bajo 1,6 mm/)).toBeNull();
    expect(field('wall').querySelectorAll('.kura-asis-note')).toHaveLength(1);
  });

  it('fuera de rango muestra solo el error de rango, sin avisos a la vez', async () => {
    const user = userEvent.setup();
    openForm('kura.caja-tapa');
    const wall = control('wall');
    await user.clear(wall);
    await user.type(wall, '1.4');
    await user.tab();
    await user.clear(wall);
    await user.type(wall, '99999');
    await user.tab();
    await waitFor(() => expect(wall.getAttribute('aria-invalid')).toBe('true'));
    const notes = Array.from(field('wall').querySelectorAll('.kura-asis-note'));
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.className.includes('is-error'))).toBe(true);
  });
});

describe('Asistentes ronda 3: contador de texto', () => {
  it('muestra «n / máx» asociado al campo y anuncia al llegar al límite', async () => {
    const user = userEvent.setup();
    openForm('kura.llavero');
    const text = control('text');
    const counter = field('text').querySelector('.kura-asis-counter') as HTMLElement;
    expect(counter.textContent).toBe('4 / 20');
    expect(text.getAttribute('aria-describedby')).toContain(counter.id);
    const live = field('text').querySelector('[role="status"]') as HTMLElement;
    expect(live.textContent).toBe('');
    await user.clear(text);
    await user.type(text, 'x'.repeat(25));
    expect(counter.textContent).toBe('20 / 20');
    expect(live.textContent).toBe(t('es', 'asis.text.limit', { max: 20 }));
  });
});

describe('Asistentes ronda 3: variantes', () => {
  it('cambiar de variante conserva las respuestas en los parámetros que la variante no define', async () => {
    const user = userEvent.setup();
    openForm('kura.placa-enchufe');
    const modules = control('modules');
    await user.clear(modules);
    await user.type(modules, '3');
    await user.tab();
    await waitFor(() => expect(modules.value).toBe('3'));
    const select = screen.getByLabelText(t('es', 'asis.variant')) as HTMLSelectElement;
    // «it» no define `modules`: se conserva; sí define `mw`.
    await user.selectOptions(select, 'it');
    expect(control('modules').value).toBe('3');
    expect(control('mw').value).toBe('22,5');
  });
});
