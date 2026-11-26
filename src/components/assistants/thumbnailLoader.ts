/**
 * @file src/components/assistants/thumbnailLoader.ts
 * @description Miniaturas de la galería de Asistentes: calcula, una receta a la vez y con sus valores por defecto,
 * la geometría con la tarea de «solo calcular» del motor (la misma de la vista previa: no toca escena ni historial) y
 * la convierte con `buildThumbnail`. El resultado queda en un caché de módulo (una receta se calcula una vez por
 * sesión, no por idioma ni por apertura). Si el motor falla, la receta no produce piezas o el cálculo pasa del tope,
 * la tarjeta muestra un icono de su categoría en lugar de la miniatura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { buildThumbnail, type ThumbPart, type Thumbnail } from '../../core/recipes/thumbnail';
import { useKuraStore } from '../../store/useKuraStore';
import type { AssistantRecipe } from './recipeFormModel';

export type ThumbState = Thumbnail | 'none';

/** Tope por receta: una que tarda más se queda con el icono (no se reintenta en la sesión). */
export const THUMB_TIMEOUT_MS = 8000;

const cache = new Map<string, ThumbState>();
const listeners = new Set<() => void>();
let running: Promise<void> | null = null;
let queue: AssistantRecipe[] = [];
let cancelCurrent: (() => void) | null = null;

export function getThumbnail(id: string): ThumbState | undefined {
  return cache.get(id);
}

export function subscribeThumbnails(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const emit = () => listeners.forEach((l) => l());

async function compute(entry: AssistantRecipe): Promise<ThumbState> {
  const store = useKuraStore.getState();
  try {
    await store.initEngine();
    const job = store.startRecipePreview({ recipe: entry.raw, answers: {} });
    const timer = setTimeout(() => job.cancel(), THUMB_TIMEOUT_MS);
    cancelCurrent = () => job.cancel();
    try {
      const result = await job.promise;
      if (!result.ok) return 'none';
      const parts: ThumbPart[] = result.change.added
        .filter((o) => o.role !== 'negative' && o.mesh.indices.length > 0)
        .map((o) => ({ positions: o.mesh.positions, indices: o.mesh.indices, offset: o.position }));
      return buildThumbnail(parts) ?? 'none';
    } finally {
      clearTimeout(timer);
      cancelCurrent = null;
    }
  } catch {
    return 'none';
  }
}

async function drain(): Promise<void> {
  while (queue.length > 0) {
    const entry = queue.shift()!;
    if (cache.has(entry.id)) continue;
    const epochAtStart = epoch;
    const state = await compute(entry);
    // Una cancelación por salir de la galería no es un fallo de la receta: se reintentará al volver.
    if (state === 'none' && epoch !== epochAtStart) continue;
    cache.set(entry.id, state);
    emit();
  }
}

/** Sube con cada cancelación para distinguirla de un fallo de la receta. */
let epoch = 0;

/** Pide las miniaturas que falten, de una en una. Seguro llamarla varias veces. */
export function requestThumbnails(entries: readonly AssistantRecipe[]): void {
  const known = new Set(queue.map((e) => e.id));
  for (const entry of entries) if (!cache.has(entry.id) && !known.has(entry.id)) queue.push(entry);
  if (running || queue.length === 0) return;
  running = drain().finally(() => {
    running = null;
  });
}

/** Detiene el cálculo en curso y vacía la cola (al salir de la galería); lo ya calculado se conserva. */
export function cancelThumbnails(): void {
  epoch++;
  queue = [];
  cancelCurrent?.();
}

/** Solo pruebas. */
export function resetThumbnailsForTest(): void {
  cache.clear();
  queue = [];
  epoch = 0;
}
