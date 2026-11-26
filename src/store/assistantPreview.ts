/**
 * @file src/store/assistantPreview.ts
 * @description Vista previa del asistente en el visor: mientras el formulario es válido, calcula la receta en el Worker
 * («solo calcular», sin tocar escena ni historial) y la dibuja como fantasma translúcido en el lugar donde caería, con
 * la capa de fantasmas de `operationPreview`. Espera 300 ms tras el último cambio, cancela en suave el cálculo anterior
 * (sin terminar el Worker), no recalcula si las respuestas no cambiaron, espera si el motor está ocupado y, si el cálculo
 * mismo pasa de ~1,5 s (contados desde que el motor empieza a calcular, no la cola ni su carga), queda pausado
 * («demasiado pesada») hasta que el usuario lo actualice a mano. Crear reutiliza lo ya calculado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create } from 'zustand';
import type { EngineCancelMode, EngineJob } from '../core/operations/engineClient';
import type { RecipeRunResult, RecipeRunSuccess, RecipeScrewFitCheck } from '../core/recipes/run/types';
import { recipeBed, type RecipeRunRequest } from './slices/recipesSlice';
import type { PreviewGhost } from './slices/previewSlice';
import { useKuraStore } from './useKuraStore';

/** Dueño de la vista previa en `operationPreview`. */
export const ASSISTANT_PREVIEW_KEY = 'assistant';
export const ASSISTANT_PREVIEW_DEBOUNCE_MS = 300;
export const ASSISTANT_PREVIEW_HEAVY_MS = 1500;
/** Holgura extra del primer cálculo de la sesión (arranque del motor). */
const WARMUP_MS = 4000;

/** `off`: apagada; `idle`: sin pedir; `invalid`: formulario inválido o la receta no produjo piezas. */
export type AssistantPreviewStatus = 'off' | 'idle' | 'computing' | 'ready' | 'invalid' | 'heavy' | 'failed';

interface PreviewState {
  enabled: boolean;
  status: AssistantPreviewStatus;
  /** Comprobación de enroscado del último cálculo (recetas con chequeo `screw_fit`), o null. */
  screwFit: RecipeScrewFitCheck | null;
}

export const useAssistantPreview = create<PreviewState>(() => ({ enabled: true, status: 'idle', screwFit: null }));

export interface AssistantPreviewInput {
  readonly recipeId: string;
  readonly request: RecipeRunRequest;
  /** Piezas del juego que reemplaza (reabrir): la vista previa se ancla donde irían. */
  readonly targetIds?: readonly string[];
  /** El formulario no tiene errores. */
  readonly valid: boolean;
}

let gen = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let heavyTimer: ReturnType<typeof setTimeout> | null = null;
let job: EngineJob<RecipeRunResult> | null = null;
let stopWaiting: (() => void) | null = null;
let inflight: { sig: string; promise: Promise<RecipeRunResult> } | null = null;
let cache: { sig: string; result: RecipeRunSuccess } | null = null;
let heavy = false;
let warm = false;
let lastInput: AssistantPreviewInput | null = null;

function hashText(text: string | Uint8Array): string {
  let h = 5381;
  const n = text.length;
  for (let i = 0; i < n; i++) h = (Math.imul(h, 33) ^ (typeof text === 'string' ? text.charCodeAt(i) : text[i])) | 0;
  return `${n}:${h >>> 0}`;
}

/** Identifica lo que se calcularía: receta, respuestas, variante, archivos, cama e idioma (no la escena). */
export function assistantPreviewSignature(input: Pick<AssistantPreviewInput, 'recipeId' | 'request' | 'targetIds'>): string {
  const s = useKuraStore.getState();
  const { request } = input;
  const files = Object.entries(request.files ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, data]) => [id, hashText(data)]);
  const chosen = s.objects
    .filter((o) => Object.values(request.answers && typeof request.answers === 'object' ? request.answers : {}).some((v) => (v as { objectId?: string } | null)?.objectId === o.id))
    .map((o) => [o.id, o.position, o.mesh.indices.length]);
  return JSON.stringify([input.recipeId, request.answers ?? {}, request.variant ?? null, files, recipeBed(s), request.language ?? s.language, input.targetIds ?? null, chosen]);
}

const setStatus = (status: AssistantPreviewStatus) => {
  if (useAssistantPreview.getState().status !== status) useAssistantPreview.setState({ status });
};

/** Escribe en la capa de fantasmas solo si le pertenece (o está libre). */
function paint(ghosts: PreviewGhost[], status: 'pending' | 'ready'): void {
  const { operationPreview } = useKuraStore.getState();
  if (operationPreview.key !== null && operationPreview.key !== ASSISTANT_PREVIEW_KEY) return;
  useKuraStore.setState({ operationPreview: { key: ASSISTANT_PREVIEW_KEY, status, ghosts, guides: [] } });
}

const clearGhosts = () => useKuraStore.getState().clearOperationPreview(ASSISTANT_PREVIEW_KEY);

function dim(): void {
  const { operationPreview } = useKuraStore.getState();
  if (operationPreview.key === ASSISTANT_PREVIEW_KEY && operationPreview.status !== 'pending') {
    useKuraStore.setState({ operationPreview: { ...operationPreview, status: 'pending' } });
  }
}

/** Dibuja el resultado donde caería hoy (misma colocación que crear). */
function show(result: RecipeRunSuccess, input: AssistantPreviewInput): void {
  const screwFit = result.checks.find((c): c is RecipeScrewFitCheck => c.kind === 'screw_fit') ?? null;
  if (useAssistantPreview.getState().screwFit !== screwFit) useAssistantPreview.setState({ screwFit });
  const { change } = useKuraStore.getState().placeRecipeResult(result, input.request, input.targetIds);
  paint(
    change.added.map((o) => ({ id: o.id, mesh: o.mesh, position: o.position, rotation: o.rotation, scale: o.scale, role: o.role === 'negative' ? 'tool' : 'result' })),
    'ready',
  );
}

/**
 * Detiene lo pendiente. Reemplazar o retirar la vista previa cancela en suave (el Worker termina ese cálculo y se
 * descarta): terminarlo obligaría al siguiente a pagar un arranque en frío. Solo la pausa por pesada usa `hard`.
 */
function cancelWork(mode: EngineCancelMode = 'soft'): void {
  gen++;
  if (timer !== null) clearTimeout(timer);
  if (heavyTimer !== null) clearTimeout(heavyTimer);
  timer = null;
  heavyTimer = null;
  stopWaiting?.();
  stopWaiting = null;
  const running = job;
  job = null;
  inflight = null;
  running?.cancel(mode);
}

function waitUntilIdle(token: number): Promise<void> {
  return new Promise((resolve) => {
    const idle = (s: { busyOperation: string | null; projectBusy: boolean }) => !s.busyOperation && !s.projectBusy;
    if (idle(useKuraStore.getState())) return resolve();
    const done = () => {
      unsubscribe();
      stopWaiting = null;
      resolve();
    };
    const unsubscribe = useKuraStore.subscribe((s) => {
      if (token !== gen || idle(s)) done();
    });
    stopWaiting = done;
  });
}

async function compute(input: AssistantPreviewInput, sig: string, token: number, limited: boolean): Promise<void> {
  timer = null;
  // Otra operación manda: la vista previa espera su turno sin bloquear nada.
  await waitUntilIdle(token);
  if (token !== gen) return;
  try {
    await useKuraStore.getState().initEngine();
  } catch {
    if (token === gen) {
      clearGhosts();
      setStatus('failed');
    }
    return;
  }
  if (token !== gen) return;
  // El tope corre desde que el motor empieza a calcular esta tarea: la espera en cola (miniaturas, un cálculo
  // descartado) y la carga del motor no la hacen «pesada».
  const armHeavy = (phase: string) => {
    if (!limited || phase !== 'compute' || token !== gen || heavyTimer !== null) return;
    heavyTimer = setTimeout(() => {
      if (token !== gen) return;
      // Demasiado pesada: se detiene (liberando el Worker) y espera a que el usuario la pida.
      heavy = true;
      warm = false;
      cancelWork('hard');
      dim();
      setStatus('heavy');
    }, ASSISTANT_PREVIEW_HEAVY_MS + (warm ? 0 : WARMUP_MS));
  };
  const running = useKuraStore.getState().startRecipePreview(input.request, armHeavy);
  job = running;
  inflight = { sig, promise: running.promise };
  try {
    const result = await running.promise;
    if (token !== gen) return;
    if (heavyTimer !== null) clearTimeout(heavyTimer);
    heavyTimer = null;
    job = null;
    inflight = null;
    warm = true;
    if (result.ok && result.change.added.length > 0) {
      cache = { sig, result };
      show(result, input);
      setStatus('ready');
    } else {
      clearGhosts();
      setStatus('invalid');
    }
  } catch {
    if (token !== gen) return;
    if (heavyTimer !== null) clearTimeout(heavyTimer);
    heavyTimer = null;
    job = null;
    inflight = null;
    clearGhosts();
    setStatus('failed');
  }
}

/**
 * Pide (o actualiza) la vista previa. Con el formulario inválido o la vista previa apagada, retira el fantasma; si las
 * respuestas no cambiaron desde el último cálculo, solo lo vuelve a mostrar.
 */
export function requestAssistantPreview(input: AssistantPreviewInput): void {
  lastInput = input;
  if (!useAssistantPreview.getState().enabled) {
    cancelWork();
    clearGhosts();
    setStatus('off');
    return;
  }
  if (!input.valid) {
    cancelWork();
    clearGhosts();
    setStatus('invalid');
    return;
  }
  const sig = assistantPreviewSignature(input);
  if (cache?.sig === sig) {
    cancelWork();
    show(cache.result, input);
    setStatus('ready');
    return;
  }
  if (inflight?.sig === sig) return;
  cancelWork();
  dim();
  if (heavy) {
    setStatus('heavy');
    return;
  }
  setStatus('computing');
  const token = gen;
  timer = setTimeout(() => void compute(input, sig, token, true), ASSISTANT_PREVIEW_DEBOUNCE_MS);
}

/** «Actualizar» a mano: calcula sin el tope de tiempo. */
export function refreshAssistantPreview(): void {
  const input = lastInput;
  if (!input?.valid || !useAssistantPreview.getState().enabled) return;
  cancelWork();
  setStatus('computing');
  void compute(input, assistantPreviewSignature(input), gen, false);
}

/** Interruptor «Vista previa»: se recuerda mientras la app siga abierta (solo en memoria; no es dato del proyecto). */
export function setAssistantPreviewEnabled(enabled: boolean): void {
  useAssistantPreview.setState({ enabled });
  if (enabled && lastInput) requestAssistantPreview(lastInput);
  else if (!enabled) {
    cancelWork();
    clearGhosts();
    setStatus('off');
  }
}

/** Retira la vista previa y olvida lo calculado (al salir del formulario). */
export function clearAssistantPreview(): void {
  cancelWork();
  cache = null;
  heavy = false;
  lastInput = null;
  clearGhosts();
  setStatus(useAssistantPreview.getState().enabled ? 'idle' : 'off');
}

/**
 * Lo calculado para estas respuestas, si lo hay: del caché, o esperando el cálculo en curso que coincide. Si el cálculo
 * en curso es de otras respuestas se cancela (la vista previa nunca retrasa a Crear). `undefined`: hay que calcular.
 */
export async function takeAssistantPreview(input: Pick<AssistantPreviewInput, 'recipeId' | 'request' | 'targetIds'>): Promise<RecipeRunSuccess | undefined> {
  const sig = assistantPreviewSignature(input);
  if (cache?.sig === sig) return cache.result;
  const pending = inflight;
  if (pending?.sig === sig) {
    try {
      const result = await pending.promise;
      if (result.ok && result.change.added.length > 0) return result;
    } catch {
      // Cancelada o fallida: crear calcula por su cuenta.
    }
    return undefined;
  }
  if (inflight || timer !== null) cancelWork();
  return undefined;
}

// Si la escena cambia mientras el formulario está abierto, el fantasma se recoloca (sin recalcular).
useKuraStore.subscribe((s, prev) => {
  if (s.objects === prev.objects || !cache || !lastInput || useAssistantPreview.getState().status !== 'ready') return;
  show(cache.result, lastInput);
});
