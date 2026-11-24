/**
 * @file src/components/__tests__/Assistants.test.tsx
 * @description Panel «Asistentes»: lista de recetas incorporadas, formulario generado por tipo de parámetro, reglas en
 * vivo (campos que se ocultan, avisos y errores junto al campo), variantes, crear con `runRecipe` simulado (el motor real
 * y el deshacer se prueban en `store/__tests__/assistantsRun.test.ts`), error tipado, indicador de progreso y teclado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { issue } from '../../core/recipes/errors';
import { t } from '../../i18n';
import { closeAssistants, openAssistants, useAssistantsPanel } from '../../store/assistantsPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { AssistantsPanel } from '../assistants/AssistantsPanel';
import { RecipeForm } from '../assistants/RecipeForm';
import { toAssistantRecipe } from '../assistants/recipeFormModel';

const CAJA = 'kura.caja-tapa';

const store = () => useKuraStore.getState();

/** Cubo de 20 mm con malla real (ocho vértices, de 0 a 20 en cada eje interno). */
function cube(id: string, name: string) {
  const v = [0, 20];
  const positions = new Float32Array(v.flatMap((x) => v.flatMap((y) => v.flatMap((z) => [x, y, z]))));
  return { ...fakeBox(id, name, 20), mesh: { positions, indices: new Uint32Array([0, 1, 2]) } };
}

beforeEach(() => {
  closeAssistants();
});

const field = (id: string) => document.querySelector<HTMLElement>(`[data-field="${id}"]`) as HTMLElement;
const control = (id: string) => field(id).querySelector('input, select, textarea, button') as HTMLInputElement;
const createButton = () => screen.getByRole('button', { name: new RegExp(`^${t('es', 'asis.create')}$`) }) as HTMLButtonElement;

function openForm(recipeId: string) {
  render(<AssistantsPanel />);
  act(() => openAssistants(recipeId));
}

describe('Asistentes: lista', () => {
  it('muestra las recetas incorporadas con nombre, descripción y cantidad de variantes', () => {
    render(<AssistantsPanel />);
    act(() => openAssistants());
    const list = screen.getByRole('list', { name: t('es', 'asis.listLabel') });
    const items = within(list).getAllByRole('button');
    expect(items).toHaveLength(3);
    const caja = within(list).getByRole('button', { name: /Caja con tapa/ });
    expect(caja.textContent).toContain('Caja de medidas interiores');
    expect(caja.textContent).not.toMatch(/variante/);
    const placa = items.find((b) => b.getAttribute('data-recipe') === 'kura.placa-enchufe') as HTMLElement;
    expect(placa.textContent).toContain(t('es', 'asis.variants', { count: 4 }));
  });

  it('los textos de la receta siguen el idioma activo y la interfaz también', () => {
    useKuraStore.setState({ language: 'en' });
    render(<AssistantsPanel />);
    act(() => openAssistants());
    expect(screen.getByRole('button', { name: /Box with lid/ })).toBeTruthy();
    expect(screen.getByText(t('en', 'asis.listIntro'))).toBeTruthy();
  });

  it('elegir una receta abre su formulario con el foco en el primer campo y Escape vuelve a la lista', async () => {
    const user = userEvent.setup();
    render(<AssistantsPanel />);
    act(() => openAssistants());
    await user.click(screen.getByRole('button', { name: /Caja con tapa/ }));
    await waitFor(() => expect(document.activeElement).toBe(control('w')));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('list', { name: t('es', 'asis.listLabel') })).toBeTruthy();
    expect(useAssistantsPanel.getState().open).toBe(true);
    expect(useAssistantsPanel.getState().recipeId).toBeNull();
  });
});

describe('Asistentes: formulario generado', () => {
  it('un control por parámetro según su tipo, agrupados por página, con etiqueta asociada y valores por defecto', () => {
    openForm(CAJA);
    expect(field('w').getAttribute('data-type')).toBe('number');
    expect((screen.getByLabelText('Ancho interior') as HTMLInputElement).getAttribute('role')).toBe('spinbutton');
    expect((screen.getByLabelText('Ancho interior') as HTMLInputElement).value).toBe('80');
    expect(control('fix').tagName).toBe('SELECT');
    expect((screen.getByLabelText('Cierre de la tapa') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Tornillos');
    expect((screen.getByLabelText('Ranuras de ventilación') as HTMLInputElement).type).toBe('checkbox');
    // Grupos con el orden de la receta: medidas, forma, tapa.
    const titles = Array.from(document.querySelectorAll('.kura-asis-group-title')).map((h) => h.textContent);
    expect(titles).toEqual(['Medidas', 'Forma', 'Tapa']);
    // Rango y unidad visibles como ayuda del campo.
    expect(field('w').textContent).toContain('10 – 400 mm');
  });

  it('texto y archivo opcional del llavero; entero con unidad de la placa', () => {
    openForm('kura.llavero');
    const text = control('text') as HTMLInputElement;
    expect(text.type).toBe('text');
    expect(text.value).toBe('Kura');
    expect(text.maxLength).toBe(20);
    expect(field('logo').textContent).toContain(t('es', 'asis.optional'));
    expect(field('logo').textContent).toContain(t('es', 'asis.file.none'));
    expect(field('logo').textContent).toContain(t('es', 'asis.file.formats', { types: 'SVG' }));
    act(() => closeAssistants());
    openForm('kura.placa-enchufe');
    expect(field('modules').getAttribute('data-type')).toBe('integer');
  });

  it('selector de variante: rellena las medidas de la receta y marca las no verificadas', async () => {
    const user = userEvent.setup();
    openForm('kura.placa-enchufe');
    const select = screen.getByLabelText(t('es', 'asis.variant')) as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels[0]).toBe(t('es', 'asis.variant.none'));
    expect(labels.slice(1).every((l) => l?.includes('sin verificar'))).toBe(true);
    expect((control('mw') as HTMLInputElement).value).toBe('45');
    await user.selectOptions(select, 'it');
    expect((control('mw') as HTMLInputElement).value).toBe('22,5');
    // Volver a «Medidas por defecto» restituye los valores de la receta.
    await user.selectOptions(select, '');
    expect((control('mw') as HTMLInputElement).value).toBe('45');
  });

  it('reglas en vivo: un parámetro se oculta, otro aparece, un aviso sale junto a su campo y un error bloquea', async () => {
    const user = userEvent.setup();
    openForm(CAJA);
    expect(field('screw')).toBeTruthy();
    expect(field('ventw')).toBeFalsy();
    await user.selectOptions(control('fix'), '1');
    expect(field('screw')).toBeFalsy();
    await user.click(control('vents'));
    expect(field('ventw')).toBeTruthy();
    // Aviso (no bloquea) junto al campo «Pared».
    const wall = control('wall');
    await user.clear(wall);
    await user.type(wall, '1.4');
    await user.tab();
    const warning = within(field('wall')).getByText(/Pared bajo 1,6 mm/);
    expect(warning.closest('.kura-asis-note')?.className).toContain('is-warning');
    expect(within(field('wall')).getByText(`${t('es', 'asis.level.warning')}:`)).toBeTruthy();
    expect(wall.getAttribute('aria-describedby')).toContain(warning.closest('p')!.id);
    expect(createButton().disabled).toBe(false);
    // Error de rango: mensaje con el nombre del campo, aria-invalid y «Crear» deshabilitado.
    const width = control('w');
    await user.clear(width);
    await user.type(width, '5');
    await user.tab();
    await waitFor(() => expect(width.getAttribute('aria-invalid')).toBe('true'));
    expect(within(field('w')).getByText(/Ancho interior: 5 está fuera del rango 10 – 400/)).toBeTruthy();
    expect(width.getAttribute('aria-describedby')).toBeTruthy();
    expect(createButton().disabled).toBe(true);
    expect(createButton().title).toBe(t('es', 'asis.createBlocked'));
  });

  it('una regla de error con campo asociado se muestra en ese campo', async () => {
    const user = userEvent.setup();
    openForm('kura.llavero');
    await user.selectOptions(control('mode'), '1');
    const depth = control('depth');
    await user.clear(depth);
    await user.type(depth, '2.5');
    await user.tab();
    const note = within(field('depth')).getByText(/\w/, { selector: '.kura-asis-note span' });
    expect(note.closest('.kura-asis-note')?.className).toContain('is-error');
    expect(createButton().disabled).toBe(true);
  });

  it('parámetro de objeto de la escena y archivo: elegir el objeto entrega su caja en ejes del usuario', async () => {
    const user = userEvent.setup();
    const box = cube('obj-a', 'Pieza A');
    useKuraStore.setState({ objects: [box] });
    const recipe = toAssistantRecipe({
      format: 'kura.recipe/1', id: 'test.objeto', version: '1.0.0', title: 'Prueba', author: 'T', license: 'MIT',
      params: [
        { id: 'target', type: 'object', label: 'Objeto base' },
        { id: 'logo', type: 'file', accept: ['svg'], maxBytes: 1000, optional: true, label: 'Logo' },
        { id: 'big', type: 'text', maxLength: 10, default: 'a', multiline: true, label: 'Nota' },
      ],
      steps: [{ id: 'b', op: 'create_primitive', args: { type: 'box', params: { width: '=p.target.size.x', depth: 10, height: 10 } } }],
      outputs: [{ ref: '@b', name: 'Salida' }],
      strings: { es: {}, en: {} },
    });
    expect(recipe).not.toBeNull();
    const run = vi.fn().mockResolvedValue(null);
    useKuraStore.setState({ runRecipe: run } as never);
    render(<RecipeForm entry={recipe!} onBack={() => undefined} onCreated={() => undefined} />);
    // Sin elegir objeto: error de campo requerido y no se puede crear.
    expect(createButton().disabled).toBe(true);
    expect(control('big').tagName).toBe('TEXTAREA');
    await user.selectOptions(control('target'), box.id);
    expect(createButton().disabled).toBe(false);
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'logo.svg', { type: 'image/svg+xml' });
    await user.upload(screen.getByTestId('asis-file-logo'), file);
    await waitFor(() => expect(field('logo').textContent).toContain('logo.svg'));
    await user.click(createButton());
    await waitFor(() => expect(run).toHaveBeenCalled());
    const request = run.mock.calls[0][0];
    expect(request.answers.target.objectId).toBe(box.id);
    expect(request.answers.target.box.max[2] - request.answers.target.box.min[2]).toBeCloseTo(20, 3);
    expect(request.answers.logo).toMatchObject({ kind: 'svg', name: 'logo.svg' });
    expect(request.files.logo).toContain('<svg');
  });
});

describe('Asistentes: crear', () => {
  it('mientras corre: indicador role=status y campos deshabilitados; al terminar con error vuelve el foco', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    const run = vi.fn(() => new Promise((resolve) => (release = resolve)));
    useKuraStore.setState({ runRecipe: run } as never);
    openForm(CAJA);
    await user.click(createButton());
    const status = await screen.findByRole('status');
    await waitFor(() => expect(status.textContent).toContain('Creando «Caja con tapa»'));
    expect((control('w') as HTMLInputElement).disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(document.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    await act(async () => release({ ok: false, errors: [issue('run.engine', 'steps[0].args', { detail: 'x' })], messages: [], params: [] }));
    await waitFor(() => expect((control('w') as HTMLInputElement).disabled).toBe(false));
    expect(status.textContent).toBe('');
    await waitFor(() => expect(document.activeElement).toBe(createButton()));
  });

  it('un error tipado de la receta se muestra en lenguaje claro y no toca la escena', async () => {
    const user = userEvent.setup();
    const kept = fakeBox('keep', 'Previa');
    useKuraStore.setState({ objects: [kept] });
    const before = store().objects;
    const pastBefore = store().past.length;
    const run = vi.fn().mockResolvedValue({
      ok: false,
      errors: [issue('run.triangles', 'steps[4].args', { detail: '9' })],
      messages: [],
      params: [],
    });
    useKuraStore.setState({ runRecipe: run } as never);
    openForm(CAJA);
    await user.click(createButton());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(t('es', 'asis.problems'));
    expect(alert.textContent).toContain(t('es', 'recipe.error.run.triangles', { path: 'steps[4].args', detail: '9' }));
    expect(store().objects).toBe(before);
    expect(store().objects[0].id).toBe(kept.id);
    expect(store().past.length).toBe(pastBefore);
    expect(useAssistantsPanel.getState().open).toBe(true);
  });

  it('si el motor no responde (null) no cambia la escena y no agrega un segundo aviso', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ runRecipe: vi.fn().mockResolvedValue(null) } as never);
    openForm(CAJA);
    await user.click(createButton());
    await waitFor(() => expect(createButton().disabled).toBe(false));
    expect(store().toasts).toHaveLength(0);
    expect(store().objects).toHaveLength(0);
    expect(useAssistantsPanel.getState().open).toBe(true);
  });
});

describe('Asistentes: teclado', () => {
  it('Enter en un campo de texto crea con las respuestas actuales', async () => {
    const user = userEvent.setup();
    const run = vi.fn().mockResolvedValue(null);
    useKuraStore.setState({ runRecipe: run } as never);
    openForm('kura.llavero');
    const text = control('text');
    await user.clear(text);
    await user.type(text, 'Hola{Enter}');
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(run.mock.calls[0][0].recipe).toMatchObject({ id: 'kura.llavero' });
    expect(run.mock.calls[0][0].answers).toEqual({ text: 'Hola' });
  });

  it('Enter en un campo numérico confirma el valor y crea', async () => {
    const user = userEvent.setup();
    const run = vi.fn().mockResolvedValue(null);
    useKuraStore.setState({ runRecipe: run } as never);
    openForm(CAJA);
    const width = control('w');
    await user.clear(width);
    await user.type(width, '90{Enter}');
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(run.mock.calls[0][0].answers).toEqual({ w: 90 });
  });

  it('con un error de campo, Enter no crea', async () => {
    const user = userEvent.setup();
    const run = vi.fn().mockResolvedValue(null);
    useKuraStore.setState({ runRecipe: run } as never);
    openForm('kura.llavero');
    const text = control('text');
    await user.clear(text);
    await user.keyboard('{Enter}');
    await new Promise((r) => setTimeout(r, 30));
    expect(run).not.toHaveBeenCalled();
    expect(text.getAttribute('aria-invalid')).toBe('true');
  });

  it('la lista se recorre con Tab y se abre con Enter; el botón Volver y la X cierran con nombre accesible', async () => {
    const user = userEvent.setup();
    render(<AssistantsPanel />);
    act(() => openAssistants());
    const first = screen.getAllByRole('button').find((b) => b.getAttribute('data-recipe') === CAJA) as HTMLElement;
    first.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: t('es', 'asis.back') })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('es', 'asis.back') }));
    expect(screen.getByRole('list')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('es', 'common.close') }));
    expect(useAssistantsPanel.getState().open).toBe(false);
  });
});
