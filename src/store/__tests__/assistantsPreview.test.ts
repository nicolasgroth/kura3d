/**
 * @file src/store/__tests__/assistantsPreview.test.ts
 * @description Vista previa del asistente con el motor real: dibuja el fantasma sin tocar la escena ni el historial, no
 * recalcula si las respuestas no cambiaron, se retira con el formulario inválido, cancela el cálculo anterior, espera si el
 * motor está ocupado, se pausa si es demasiado pesada y crear reutiliza lo calculado dejando las piezas donde estaba el fantasma.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtinRecipe } from '../../core/recipes/builtin';
import { getEngineClient, type EngineClient, type EngineJob } from '../../core/operations/engineClient';
import {
  ASSISTANT_PREVIEW_DEBOUNCE_MS,
  clearAssistantPreview,
  refreshAssistantPreview,
  requestAssistantPreview,
  setAssistantPreviewEnabled,
  useAssistantPreview,
} from '../assistantPreview';
import { closeAssistants, runAssistant } from '../assistantsPanel';
import { setStoreEngineClient } from '../storeContext';
import { useKuraStore } from '../useKuraStore';
import { addBox, resetStore, store } from './storeTestUtils';

const CAJA = 'kura.caja-tapa';
const request = (answers: Record<string, unknown> = {}) => ({ recipe: builtinRecipe(CAJA), answers });
const input = (answers: Record<string, unknown> = {}, valid = true) => ({ recipeId: CAJA, request: request(answers), valid });
const status = () => useAssistantPreview.getState().status;
const ghosts = () => store().operationPreview.ghosts;

/** Cliente del motor que cuenta las tareas `runRecipe` y delega en el real. */
function countingClient() {
  const runs: string[] = [];
  const client: EngineClient = {
    run: (ctx, name, args, onProgress) => {
      runs.push(name);
      return getEngineClient().run(ctx, name, args, onProgress);
    },
    dispose: () => undefined,
  };
  return { client, runs };
}

/** Cliente cuyas tareas nunca terminan: sirve para ver la cancelación y el tope de tiempo. */
function hangingClient() {
  const jobs: Array<{ cancel: ReturnType<typeof vi.fn> }> = [];
  const client: EngineClient = {
    run: () => {
      const cancel = vi.fn();
      jobs.push({ cancel });
      const job: EngineJob<never> = { id: jobs.length, inWorker: true, promise: new Promise<never>(() => undefined), cancel };
      return job as never;
    },
    dispose: () => undefined,
  };
  return { client, jobs };
}

beforeEach(async () => {
  await resetStore('es');
  closeAssistants();
  setAssistantPreviewEnabled(true);
  clearAssistantPreview();
});

afterEach(() => {
  clearAssistantPreview();
  setStoreEngineClient(null);
  vi.useRealTimers();
});

describe('vista previa del asistente (motor real)', () => {
  it('dibuja el fantasma de la caja y la tapa sin tocar la escena ni el historial', async () => {
    const cube = await addBox(10);
    const before = { objects: store().objects, past: store().past.length, future: store().future.length };
    requestAssistantPreview(input({ w: 70 }));
    expect(status()).toBe('computing');
    await vi.waitFor(() => expect(status()).toBe('ready'), { timeout: 15_000 });
    expect(store().operationPreview.key).toBe('assistant');
    expect(ghosts()).toHaveLength(2);
    expect(store().objects).toBe(before.objects);
    expect(store().objects.map((o) => o.id)).toEqual([cube.id]);
    expect(store().past.length).toBe(before.past);
    expect(store().future.length).toBe(before.future);
  });

  it('no recalcula si las respuestas no cambiaron', async () => {
    const { client, runs } = countingClient();
    setStoreEngineClient(client);
    requestAssistantPreview(input({ w: 70 }));
    await vi.waitFor(() => expect(status()).toBe('ready'), { timeout: 15_000 });
    requestAssistantPreview(input({ w: 70 }));
    expect(status()).toBe('ready');
    await new Promise((r) => setTimeout(r, ASSISTANT_PREVIEW_DEBOUNCE_MS + 100));
    expect(runs.filter((n) => n === 'runRecipe')).toHaveLength(1);
  });

  it('con el formulario inválido el fantasma desaparece y no hay avisos', async () => {
    requestAssistantPreview(input({ w: 70 }));
    await vi.waitFor(() => expect(status()).toBe('ready'), { timeout: 15_000 });
    const toasts = store().toasts.length;
    requestAssistantPreview(input({ w: 70 }, false));
    expect(status()).toBe('invalid');
    expect(ghosts()).toHaveLength(0);
    expect(store().toasts.length).toBe(toasts);
  });

  it('una receta que falla (valor fuera de rango) no deja fantasma ni avisos', async () => {
    requestAssistantPreview(input({ w: 5000 }));
    await vi.waitFor(() => expect(status()).toBe('invalid'), { timeout: 15_000 });
    expect(ghosts()).toHaveLength(0);
    expect(store().toasts.filter((x) => x.kind === 'error')).toHaveLength(0);
  });

  it('varios cambios seguidos se juntan en un solo cálculo (espera de 300 ms)', async () => {
    const { client, runs } = countingClient();
    setStoreEngineClient(client);
    for (const w of [60, 65, 70, 75]) requestAssistantPreview(input({ w }));
    await vi.waitFor(() => expect(status()).toBe('ready'), { timeout: 15_000 });
    expect(runs.filter((n) => n === 'runRecipe')).toHaveLength(1);
  });

  it('apagada no calcula ni dibuja, y se recuerda en la sesión', async () => {
    const { client, runs } = countingClient();
    setStoreEngineClient(client);
    setAssistantPreviewEnabled(false);
    requestAssistantPreview(input({ w: 70 }));
    await new Promise((r) => setTimeout(r, ASSISTANT_PREVIEW_DEBOUNCE_MS + 100));
    expect(status()).toBe('off');
    expect(runs).toHaveLength(0);
    expect(ghosts()).toHaveLength(0);
    expect(useAssistantPreview.getState().enabled).toBe(false);
    setAssistantPreviewEnabled(true);
    expect(useAssistantPreview.getState().enabled).toBe(true);
  });

  it('si el motor está ocupado con otra operación espera su turno', async () => {
    const { client, runs } = countingClient();
    setStoreEngineClient(client);
    useKuraStore.setState({ busyOperation: 'otra' } as never);
    requestAssistantPreview(input({ w: 70 }));
    await new Promise((r) => setTimeout(r, ASSISTANT_PREVIEW_DEBOUNCE_MS + 150));
    expect(runs).toHaveLength(0);
    useKuraStore.setState({ busyOperation: null } as never);
    await vi.waitFor(() => expect(status()).toBe('ready'), { timeout: 15_000 });
    expect(runs).toHaveLength(1);
  });
});

describe('vista previa: cancelación y tope de tiempo', () => {
  it('un cambio mientras calcula cancela el cálculo anterior', async () => {
    const { client, jobs } = hangingClient();
    setStoreEngineClient(client);
    requestAssistantPreview(input({ w: 70 }));
    await vi.waitFor(() => expect(jobs).toHaveLength(1));
    requestAssistantPreview(input({ w: 80 }));
    expect(jobs[0].cancel).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(jobs).toHaveLength(2));
  });

  it('si pasa de ~1,5 s se pausa («demasiado pesada») y «Actualizar» la calcula sin tope', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { client, jobs } = hangingClient();
    setStoreEngineClient(client);
    requestAssistantPreview(input({ w: 70 }));
    await vi.advanceTimersByTimeAsync(ASSISTANT_PREVIEW_DEBOUNCE_MS + 10);
    expect(jobs).toHaveLength(1);
    // El primer cálculo de la sesión tiene holgura de arranque.
    await vi.advanceTimersByTimeAsync(6000);
    expect(status()).toBe('heavy');
    expect(jobs[0].cancel).toHaveBeenCalled();
    // Pausada: otro cambio no lanza nada solo.
    requestAssistantPreview(input({ w: 80 }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(jobs).toHaveLength(1);
    expect(status()).toBe('heavy');
    refreshAssistantPreview();
    await vi.advanceTimersByTimeAsync(10);
    expect(jobs).toHaveLength(2);
    expect(status()).toBe('computing');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(jobs[1].cancel).not.toHaveBeenCalled();
  });
});

describe('crear con la vista previa lista', () => {
  it('reutiliza lo calculado (sin otra tarea del motor) y las piezas quedan donde estaba el fantasma', async () => {
    await addBox(30);
    const { client, runs } = countingClient();
    setStoreEngineClient(client);
    const req = request({ w: 70 });
    requestAssistantPreview({ recipeId: CAJA, request: req, valid: true });
    await vi.waitFor(() => expect(status()).toBe('ready'), { timeout: 15_000 });
    const ghostPositions = ghosts().map((g) => g.position);
    expect(runs.filter((n) => n === 'runRecipe')).toHaveLength(1);
    const outcome = await runAssistant({ recipe: req.recipe, answers: req.answers });
    expect(outcome.status).toBe('created');
    expect(runs.filter((n) => n === 'runRecipe')).toHaveLength(1);
    const created = store().objects.filter((o) => o.metadata?.recipe);
    expect(created.map((o) => o.position)).toEqual(ghostPositions);
    expect(store().past.length).toBeGreaterThan(0);
  });

  it('con respuestas distintas a las de la vista previa, crear calcula de nuevo y cancela la anterior', async () => {
    const { client, runs } = countingClient();
    setStoreEngineClient(client);
    requestAssistantPreview(input({ w: 70 }));
    await vi.waitFor(() => expect(status()).toBe('ready'), { timeout: 15_000 });
    const outcome = await runAssistant({ recipe: builtinRecipe(CAJA), answers: { w: 90 } });
    expect(outcome.status).toBe('created');
    expect(runs.filter((n) => n === 'runRecipe')).toHaveLength(2);
    expect(store().objects.every((o) => o.metadata?.recipe?.answers.w === 90)).toBe(true);
  });
});
