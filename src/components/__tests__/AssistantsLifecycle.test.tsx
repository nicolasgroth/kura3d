/**
 * @file src/components/__tests__/AssistantsLifecycle.test.tsx
 * @description Asistentes: creación exitosa (el panel se cierra y avisa), un solo aviso ante fallo, mensajes por tipo de
 * chequeo y resultado vacío, respuesta de un campo de objeto que sigue al objeto, validación del tipo real y del tamaño
 * de un archivo, foco al volver a la lista, y exclusión mutua con el panel de Texto 3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { closeAssistants, openAssistants, useAssistantsPanel } from '../../store/assistantsPanel';
import { setText3DPanelOpen, startPanelExclusion, useText3DPanel } from '../../store/insertCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { AssistantsPanel } from '../assistants/AssistantsPanel';
import { RecipeForm } from '../assistants/RecipeForm';
import { toAssistantRecipe } from '../assistants/recipeFormModel';
import { DEFAULT_FILE_MAX_BYTES, sniffFileKind } from '../assistants/fileKind';

const CAJA = 'kura.caja-tapa';
const store = () => useKuraStore.getState();
const field = (id: string) => document.querySelector<HTMLElement>(`[data-field="${id}"]`) as HTMLElement;
const control = (id: string) => field(id).querySelector('input, select, textarea, button') as HTMLInputElement;
const createButton = () => screen.getByRole('button', { name: new RegExp(`^${t('es', 'asis.create')}$`) }) as HTMLButtonElement;

function cube(id: string, name: string, offset = 0) {
  const v = [0, 20];
  const positions = new Float32Array(v.flatMap((x) => v.flatMap((y) => v.flatMap((z) => [x + offset, y, z]))));
  return { ...fakeBox(id, name, 20), mesh: { positions, indices: new Uint32Array([0, 1, 2]) } };
}

const ok = (added: Array<{ id: string; name: string }>, checks: unknown[] = []) => ({ ok: true, change: { added }, checks, messages: [], params: [] });

beforeEach(() => {
  closeAssistants();
  setText3DPanelOpen(false);
});

describe('Asistentes: crear con éxito y avisos', () => {
  it('crear bien cierra el panel y avisa qué se creó', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ runRecipe: vi.fn().mockResolvedValue(ok([{ id: 'n1', name: 'Caja' }])), requestCameraPreset: vi.fn() } as never);
    render(<AssistantsPanel />);
    act(() => openAssistants(CAJA));
    await user.click(createButton());
    await waitFor(() => expect(useAssistantsPanel.getState().open).toBe(false));
    expect(store().toasts.some((x) => x.text === t('es', 'asis.created', { names: 'Caja' }) && x.kind === 'success')).toBe(true);
    expect(store().requestCameraPreset).toHaveBeenCalledWith('fit', ['n1']);
  });

  it('con el motor ocupado hay un solo aviso (el del store), no uno más del asistente', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ busyOperation: 'otra' } as never);
    render(<AssistantsPanel />);
    act(() => openAssistants(CAJA));
    await user.click(createButton());
    await waitFor(() => expect(store().toasts.length).toBeGreaterThan(0));
    await waitFor(() => expect(createButton().disabled).toBe(false));
    expect(store().toasts).toHaveLength(1);
    expect(useAssistantsPanel.getState().open).toBe(true);
  });

  it('el aviso de cama solo sale para un chequeo de cama', async () => {
    const user = userEvent.setup();
    const fitsBed = { kind: 'fits_bed', ref: 'a', onFail: 'warn', size: [1, 1, 1], bed: [1, 1, 1] };
    useKuraStore.setState({ runRecipe: vi.fn().mockResolvedValue(ok([{ id: 'n1', name: 'Caja' }], [fitsBed])), requestCameraPreset: vi.fn() } as never);
    render(<AssistantsPanel />);
    act(() => openAssistants(CAJA));
    await user.click(createButton());
    await waitFor(() => expect(store().toasts.some((x) => x.text === t('es', 'asis.fitsBed'))).toBe(true));

    useKuraStore.setState({ toasts: [] });
    const other = { kind: 'otro', ref: 'a' };
    useKuraStore.setState({ runRecipe: vi.fn().mockResolvedValue(ok([{ id: 'n2', name: 'Caja' }], [other])) } as never);
    act(() => openAssistants(CAJA));
    await user.click(createButton());
    await waitFor(() => expect(store().toasts.some((x) => x.text === t('es', 'asis.checkOther'))).toBe(true));
    expect(store().toasts.some((x) => x.text === t('es', 'asis.fitsBed'))).toBe(false);
  });

  it('si la receta no produjo piezas lo dice, no dice «Se creó» y el panel sigue abierto', async () => {
    const user = userEvent.setup();
    const cam = vi.fn();
    useKuraStore.setState({ runRecipe: vi.fn().mockResolvedValue(ok([])), requestCameraPreset: cam } as never);
    render(<AssistantsPanel />);
    act(() => openAssistants(CAJA));
    await user.click(createButton());
    await waitFor(() => expect(store().toasts.some((x) => x.text === t('es', 'asis.empty'))).toBe(true));
    expect(store().toasts.some((x) => x.text.startsWith('Se creó'))).toBe(false);
    expect(cam).not.toHaveBeenCalled();
    expect(useAssistantsPanel.getState().open).toBe(true);
  });
});

describe('Asistentes: campo de objeto', () => {
  const recipe = () =>
    toAssistantRecipe({
      format: 'kura.recipe/1', id: 'test.objeto2', version: '1.0.0', title: 'Prueba', author: 'T', license: 'MIT',
      params: [{ id: 'target', type: 'object', label: 'Objeto base' }],
      steps: [{ id: 'b', op: 'create_primitive', args: { type: 'box', params: { width: '=p.target.size.x', depth: 10, height: 10 } } }],
      outputs: [{ ref: '@b', name: 'Salida' }],
      strings: { es: {}, en: {} },
    })!;

  it('si el objeto se mueve la respuesta guarda su caja nueva; si se borra, se limpia', async () => {
    const user = userEvent.setup();
    const box = cube('obj-a', 'Pieza A');
    useKuraStore.setState({ objects: [box] });
    const run = vi.fn().mockResolvedValue(null);
    useKuraStore.setState({ runRecipe: run } as never);
    render(<RecipeForm entry={recipe()} onBack={() => undefined} onCreated={() => undefined} />);
    await user.selectOptions(control('target'), box.id);
    act(() => useKuraStore.setState({ objects: [cube('obj-a', 'Pieza A', 100)] }));
    await waitFor(() => expect(createButton().disabled).toBe(false));
    await user.click(createButton());
    await waitFor(() => expect(run).toHaveBeenCalled());
    const first = run.mock.calls[0][0].answers.target;
    expect(first.objectId).toBe('obj-a');
    expect(Math.abs(first.box.min[0] + first.box.max[0])).toBeGreaterThan(50);

    act(() => useKuraStore.setState({ objects: [] }));
    await waitFor(() => expect(createButton().disabled).toBe(true));
  });

  it('un campo que no es de objeto no se suscribe a la escena (la lista de objetos no lo vuelve a pintar)', () => {
    const entry = toAssistantRecipe({
      format: 'kura.recipe/1', id: 'test.num', version: '1.0.0', title: 'Prueba', author: 'T', license: 'MIT',
      params: [{ id: 'w', type: 'number', default: 10, min: 1, max: 100, unit: 'mm', label: 'Ancho' }],
      steps: [{ id: 'b', op: 'create_primitive', args: { type: 'box', params: { width: '=p.w', depth: 10, height: 10 } } }],
      outputs: [{ ref: '@b', name: 'Salida' }],
      strings: { es: {}, en: {} },
    })!;
    render(<RecipeForm entry={entry} onBack={() => undefined} onCreated={() => undefined} />);
    const before = control('w');
    act(() => useKuraStore.setState({ objects: [cube('x', 'X')] }));
    expect(control('w')).toBe(before);
  });
});

describe('Asistentes: campo de archivo', () => {
  const recipe = (maxBytes?: number) =>
    toAssistantRecipe({
      format: 'kura.recipe/1', id: 'test.archivo', version: '1.0.0', title: 'Prueba', author: 'T', license: 'MIT',
      params: [{ id: 'logo', type: 'file', accept: ['svg'], ...(maxBytes ? { maxBytes } : {}), optional: true, label: 'Logo' }],
      steps: [{ id: 'b', op: 'create_primitive', args: { type: 'box', params: { width: 10, depth: 10, height: 10 } } }],
      outputs: [{ ref: '@b', name: 'Salida' }],
      strings: { es: {}, en: {} },
    })!;

  it('un PNG con extensión .svg se rechaza por su contenido real, con mensaje junto al campo', async () => {
    const user = userEvent.setup();
    render(<RecipeForm entry={recipe(5000)} onBack={() => undefined} onCreated={() => undefined} />);
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], 'logo.svg');
    await user.upload(screen.getByTestId('asis-file-logo'), png);
    await waitFor(() => expect(field('logo').textContent).toContain('SVG'));
    expect(field('logo').querySelector('[role="alert"]')?.textContent).toContain('no es de un tipo admitido');
    expect(createButton().disabled).toBe(true);
    // El archivo es opcional: «quitar» limpia el error y deja crear sin archivo.
    await user.click(within(field('logo')).getByRole('button', { name: t('es', 'asis.file.remove') }));
    expect(field('logo').querySelector('[role="alert"]')).toBeNull();
    expect(createButton().disabled).toBe(false);
  });

  it('un archivo sobre el tope no se lee y avisa junto al campo; quitarlo no es necesario para corregir', async () => {
    const user = userEvent.setup();
    render(<RecipeForm entry={recipe(100)} onBack={() => undefined} onCreated={() => undefined} />);
    const big = new File(['<svg xmlns="http://www.w3.org/2000/svg">' + ' '.repeat(500) + '</svg>'], 'grande.svg');
    await user.upload(screen.getByTestId('asis-file-logo'), big);
    await waitFor(() => expect(field('logo').querySelector('[role="alert"]')?.textContent).toContain('demasiado grande'));
    const small = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'logo.svg');
    await user.upload(screen.getByTestId('asis-file-logo'), small);
    await waitFor(() => expect(field('logo').textContent).toContain('logo.svg'));
    expect(field('logo').querySelector('[role="alert"]')).toBeNull();
    expect(createButton().disabled).toBe(false);
  });

  it('la detección por contenido y el tope por defecto', () => {
    expect(sniffFileKind(new TextEncoder().encode('<?xml version="1.0"?><SVG/>'))).toBe('svg');
    expect(sniffFileKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(sniffFileKind(new TextEncoder().encode('hola'))).toBeNull();
    expect(DEFAULT_FILE_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('Asistentes: foco y paneles', () => {
  it('«Volver a la lista» deja el foco en la tarjeta de la receta de origen', async () => {
    const user = userEvent.setup();
    render(<AssistantsPanel />);
    act(() => openAssistants(CAJA));
    await user.click(screen.getByRole('button', { name: t('es', 'panel.action.back') }));
    await waitFor(() => expect((document.activeElement as HTMLElement | null)?.getAttribute('data-recipe')).toBe(CAJA));
  });

  it('sin arrancar la exclusión, importar el módulo no enlaza los paneles; al arrancarla (una vez) sí, y se puede quitar', () => {
    act(() => openAssistants());
    act(() => setText3DPanelOpen(true));
    expect(useAssistantsPanel.getState().open).toBe(true);
    act(() => setText3DPanelOpen(false));
    closeAssistants();
    const stop = startPanelExclusion();
    expect(startPanelExclusion()).toBe(stop);
    act(() => openAssistants());
    act(() => setText3DPanelOpen(true));
    expect(useAssistantsPanel.getState().open).toBe(false);
    stop();
    setText3DPanelOpen(false);
    act(() => openAssistants());
    act(() => setText3DPanelOpen(true));
    expect(useAssistantsPanel.getState().open).toBe(true);
  });

  it('abrir Texto 3D cierra Asistentes y al revés', () => {
    const stop = startPanelExclusion();
    act(() => openAssistants());
    expect(useAssistantsPanel.getState().open).toBe(true);
    act(() => setText3DPanelOpen(true));
    expect(useAssistantsPanel.getState().open).toBe(false);
    expect(useText3DPanel.getState().open).toBe(true);
    act(() => openAssistants());
    expect(useText3DPanel.getState().open).toBe(false);
    expect(useAssistantsPanel.getState().open).toBe(true);
    stop();
  });

  it('mientras crea, el indicador visible muestra «Creando…» junto al botón', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    useKuraStore.setState({ runRecipe: vi.fn(() => new Promise((resolve) => (release = resolve))) } as never);
    render(<AssistantsPanel />);
    act(() => openAssistants(CAJA));
    await user.click(createButton());
    const status = await screen.findByRole('status');
    await waitFor(() => expect(status.textContent).toContain('Creando'));
    expect(status.querySelector('svg')).not.toBeNull();
    expect(status.parentElement).toBe(createButton().parentElement);
    await act(async () => release(null));
  });
});
