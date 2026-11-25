/**
 * @file src/components/__tests__/AssistantsPreviewEdit.test.tsx
 * @description Interfaz de la vista previa y de «Editar con el asistente»: interruptor con nombre accesible y estado que se
 * anuncia (`aria-live="polite"`), aviso «pausada» con botón «Actualizar», ficha del inspector que reabre el formulario con
 * las respuestas guardadas, confirmación antes de regenerar un juego modificado, y la explicación (con salida) cuando la
 * receta ya no existe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { clearAssistantPreview, setAssistantPreviewEnabled, useAssistantPreview } from '../../store/assistantPreview';
import { closeAssistants, useAssistantsPanel } from '../../store/assistantsPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { settleDecision, useDecisionStore } from '../../utils/confirmDialog';
import { AssistantOriginSection } from '../assistants/AssistantOriginSection';
import { AssistantPreviewBar } from '../assistants/AssistantPreviewBar';
import { AssistantsPanel } from '../assistants/AssistantsPanel';
import { openAssistantEdit } from '../assistants/editActions';

const CAJA = 'kura.caja-tapa';
const store = () => useKuraStore.getState();
const control = (id: string) => document.querySelector<HTMLElement>(`[data-field="${id}"]`)?.querySelector('input, select, textarea') as HTMLInputElement;

const piece = (id: string, patch: Record<string, unknown> = {}) => ({
  ...fakeBox(id, 'Caja', 20),
  metadata: { recipe: { id: CAJA, version: '1.0.0', hash: 'a'.repeat(64), answers: { w: 77 }, output: 'box', run: 'run1', name: 'Caja', ...patch } },
});

const okResult = (added: Array<{ id: string; name: string }>) => ({ ok: true, change: { added }, checks: [], messages: [], params: [] });

beforeEach(() => {
  closeAssistants();
  clearAssistantPreview();
  setAssistantPreviewEnabled(false);
  useKuraStore.setState({ objects: [], selectedIds: [], toasts: [] } as never);
  settleDecision('cancel');
});

describe('barra «Vista previa»', () => {
  it('interruptor con nombre accesible, activado por defecto; apagarlo se recuerda y no deja texto', async () => {
    const user = userEvent.setup();
    setAssistantPreviewEnabled(true);
    render(<AssistantPreviewBar />);
    const toggle = screen.getByRole('checkbox', { name: t('es', 'asis.preview.label') }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    expect(toggle.closest('label')?.getAttribute('title')).toBe(t('es', 'asis.preview.tip'));
    await user.click(toggle);
    expect(useAssistantPreview.getState().enabled).toBe(false);
    expect(toggle.checked).toBe(false);
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('');
  });

  it('el estado se anuncia en una región cortés y «pausada» trae su botón con texto (no solo color)', () => {
    setAssistantPreviewEnabled(true);
    render(<AssistantPreviewBar />);
    const live = document.querySelector('[aria-live="polite"]') as HTMLElement;
    act(() => useAssistantPreview.setState({ status: 'computing' }));
    expect(live.textContent).toBe(t('es', 'asis.preview.computing'));
    expect(screen.queryByRole('button', { name: t('es', 'asis.preview.refresh') })).toBeNull();
    act(() => useAssistantPreview.setState({ status: 'heavy' }));
    expect(live.textContent).toBe(t('es', 'asis.preview.heavy'));
    const refresh = screen.getByRole('button', { name: t('es', 'asis.preview.refresh') });
    expect(refresh.getAttribute('title')).toBe(t('es', 'asis.preview.refreshTip'));
    act(() => useAssistantPreview.setState({ status: 'failed' }));
    expect(live.textContent).toBe(t('es', 'asis.preview.failed'));
  });

  it('en el formulario: el fantasma se calcula solo y el estado pasa a «actualizada»', async () => {
    setAssistantPreviewEnabled(true);
    // Sin motor Manifold en jsdom: la tarea de solo calcular devuelve dos piezas con malla.
    const solid = (id: string, x: number) => {
      const v = [0, 20];
      const positions = new Float32Array(v.flatMap((a) => v.flatMap((b) => v.flatMap((c) => [a + x, b, c]))));
      return { ...fakeBox(id, id, 20), mesh: { positions, indices: new Uint32Array([0, 1, 2]) } };
    };
    const startRecipePreview = vi.fn(() => ({ id: 1, inWorker: false, cancel: vi.fn(), promise: Promise.resolve(okResult([solid('p1', 0), solid('p2', 30)])) }));
    useKuraStore.setState({ startRecipePreview, initEngine: vi.fn().mockResolvedValue(undefined) } as never);
    render(<AssistantsPanel />);
    act(() => useAssistantsPanel.setState({ open: true, recipeId: CAJA, edit: null }));
    await waitFor(() => expect(useAssistantPreview.getState().status).toBe('ready'), { timeout: 5000 });
    expect(startRecipePreview).toHaveBeenCalledTimes(1);
    expect(store().operationPreview.key).toBe('assistant');
    expect(store().operationPreview.ghosts.length).toBe(2);
    expect(store().objects).toHaveLength(0);
  });
});

describe('Editar con el asistente', () => {
  it('la ficha del inspector reabre el formulario con las respuestas guardadas y «Actualizar»', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ objects: [piece('a')] } as never);
    render(
      <>
        <AssistantOriginSection primary={store().objects[0]} />
        <AssistantsPanel />
      </>,
    );
    const button = screen.getByRole('button', { name: t('es', 'asis.edit.action') });
    expect(button.getAttribute('title')).toBe(t('es', 'asis.edit.tip'));
    await user.click(button);
    expect(useAssistantsPanel.getState()).toMatchObject({ open: true, recipeId: CAJA });
    await waitFor(() => expect(control('w').value).toBe('77'));
    expect(screen.getByRole('button', { name: t('es', 'asis.edit.update') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(`^${t('es', 'asis.create')}$`) })).toBeNull();
  });

  it('un juego modificado pide confirmación; Cancelar no cambia nada y «Regenerar» actualiza', async () => {
    const user = userEvent.setup();
    const update = vi.fn().mockResolvedValue(okResult([{ id: 'n1', name: 'Caja' }]));
    // Sin huella guardada no hay forma de saber si se tocó: se avisa.
    useKuraStore.setState({ objects: [piece('a')], updateRecipeRun: update } as never);
    render(<AssistantsPanel />);
    act(() => void openAssistantEdit('a'));
    await user.click(await screen.findByRole('button', { name: t('es', 'asis.edit.update') }));
    await waitFor(() => expect(useDecisionStore.getState().request?.title).toBe(t('es', 'asis.edit.confirmTitle')));
    expect(useDecisionStore.getState().request?.message).toBe(t('es', 'asis.edit.confirmMessage'));
    act(() => settleDecision('cancel'));
    await waitFor(() => expect((screen.getByRole('button', { name: t('es', 'asis.edit.update') }) as HTMLButtonElement).disabled).toBe(false));
    expect(update).not.toHaveBeenCalled();
    expect(useAssistantsPanel.getState().open).toBe(true);

    await user.click(screen.getByRole('button', { name: t('es', 'asis.edit.update') }));
    await waitFor(() => expect(useDecisionStore.getState().request).not.toBeNull());
    act(() => settleDecision('regenerate'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const [req, ids] = update.mock.calls[0];
    expect(ids).toEqual(['a']);
    expect(req.answers).toMatchObject({ w: 77 });
    await waitFor(() => expect(useAssistantsPanel.getState().open).toBe(false));
    expect(store().toasts.some((x) => x.text === t('es', 'asis.updated', { names: 'Caja' }))).toBe(true);
  });

  it('una receta que ya no existe se explica y ofrece crear una nueva desde la lista', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ objects: [piece('a', { id: 'otro.perdida' })] } as never);
    render(<AssistantsPanel />);
    act(() => void openAssistantEdit('a'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('otro.perdida');
    await user.click(screen.getByRole('button', { name: t('es', 'asis.edit.createNew') }));
    expect(useAssistantsPanel.getState()).toMatchObject({ recipeId: null, edit: null });
    expect(await screen.findByRole('list', { name: t('es', 'asis.listLabel') })).toBeTruthy();
  });

  it('una versión incompatible explica y abre la receta vacía para crear una nueva', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ objects: [piece('a', { version: '9.1.0' })] } as never);
    render(<AssistantsPanel />);
    act(() => void openAssistantEdit('a'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('9.1.0');
    await user.click(screen.getByRole('button', { name: t('es', 'asis.edit.createNew') }));
    expect(useAssistantsPanel.getState()).toMatchObject({ recipeId: CAJA, edit: null });
    await waitFor(() => expect(control('w').value).not.toBe('77'));
  });
});
