/**
 * @file src/core/operations/engineClient.ts
 * @description Cliente del Worker del motor: un único Worker reutilizable (Manifold se inicializa
 * una vez), entradas copiadas y transferidas, resultados transferidos de vuelta, nombres
 * resueltos con el `ResultNaming` real, progreso por fase y cancelación (descarta el resultado y,
 * como Manifold no se puede interrumpir, termina el Worker y lo recrea al pedir la siguiente
 * tarea). Sin `Worker` (Node, Vitest, MCP headless) ejecuta la misma tarea en proceso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../../types/kura';
import { runEngineTaskInProcess, type EngineTaskArgs, type EngineTaskName, type EngineTaskResult } from './engineTasks';
import {
  collectTransferables,
  copyForTransfer,
  deserializeError,
  resolveNames,
  type EngineTaskRequest,
  type EngineTaskResponse,
} from './engineWire';
import type { OperationContext } from './operationTypes';

/** Subconjunto de `Worker` que usa el cliente (permite simularlo en pruebas). */
export interface WorkerLike {
  postMessage(message: unknown, transfer: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

/** Rechazo de una tarea cancelada por el usuario. */
export class EngineCancelledError extends Error {
  readonly code = 'cancelled' as const;
  constructor() {
    super('Engine task cancelled');
    this.name = 'EngineCancelledError';
  }
}

export function isEngineCancelled(err: unknown): err is EngineCancelledError {
  return err instanceof EngineCancelledError;
}

export interface EngineJob<R> {
  id: number;
  /** true si corre en el Worker (cancelar libera de inmediato y recrea el Worker). */
  inWorker: boolean;
  promise: Promise<R>;
  cancel(): void;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
  onProgress?: (phase: string) => void;
  ctx: OperationContext;
  known: SceneObject[];
}

/** Objetos de escena alcanzables en los argumentos (para resolver nombres). */
function sceneObjectsIn(value: unknown, out: SceneObject[] = [], seen = new Set<object>()): SceneObject[] {
  if (!value || typeof value !== 'object' || seen.has(value) || ArrayBuffer.isView(value)) return out;
  seen.add(value);
  const rec = value as Record<string, unknown>;
  if ('id' in rec && 'mesh' in rec && 'name' in rec) {
    out.push(value as SceneObject);
    return out;
  }
  for (const child of Array.isArray(value) ? value : Object.values(rec)) sceneObjectsIn(child, out, seen);
  return out;
}

export function defaultWorkerFactory(): WorkerLike | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module', name: 'kura-engine' }) as unknown as WorkerLike;
  } catch {
    return null;
  }
}

export interface EngineClient {
  run<N extends EngineTaskName>(
    ctx: OperationContext,
    name: N,
    args: EngineTaskArgs<N>,
    onProgress?: (phase: string) => void,
  ): EngineJob<EngineTaskResult<N>>;
  /** Termina el Worker (si existe) y rechaza lo pendiente. */
  dispose(): void;
}

export function createEngineClient(factory: () => WorkerLike | null = defaultWorkerFactory): EngineClient {
  let worker: WorkerLike | null = null;
  let workerUnavailable = false;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  const failAll = (err: unknown) => {
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };

  const resetWorker = () => {
    worker?.terminate();
    worker = null;
  };

  const ensureWorker = (): WorkerLike | null => {
    if (worker || workerUnavailable) return worker;
    worker = factory();
    if (!worker) {
      workerUnavailable = true;
      return null;
    }
    worker.onmessage = ({ data }: MessageEvent<EngineTaskResponse>) => {
      const p = pending.get(data.id);
      if (!p) return; // cancelada: el resultado se descarta
      if (data.type === 'progress') {
        p.onProgress?.(data.phase);
        return;
      }
      pending.delete(data.id);
      if (data.type === 'error') {
        p.reject(deserializeError(data.error));
        return;
      }
      try {
        resolveNames(data.result, data.names, p.ctx.naming, p.known);
        p.resolve(data.result);
      } catch (err) {
        p.reject(err);
      }
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      resetWorker();
      failAll(new Error(event.message || 'Engine worker failed'));
    };
    return worker;
  };

  return {
    run(ctx, name, args, onProgress) {
      const id = nextId++;
      const w = ensureWorker();
      let cancelled = false;
      let rejectJob: (err: unknown) => void = () => {};
      if (!w) {
        // En proceso: no se puede interrumpir; cancelar libera ya y descarta el resultado.
        const promise = new Promise<EngineTaskResult<typeof name>>((resolve, reject) => {
          rejectJob = reject;
          onProgress?.('compute');
          runEngineTaskInProcess(ctx, name, args).then(
            (r) => (cancelled ? undefined : resolve(r)),
            (e) => (cancelled ? undefined : reject(e)),
          );
        });
        return { id, inWorker: false, promise, cancel: () => { cancelled = true; rejectJob(new EngineCancelledError()); } };
      }
      const promise = new Promise<EngineTaskResult<typeof name>>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress, ctx, known: sceneObjectsIn(args) });
        const payload = copyForTransfer(args);
        const request: EngineTaskRequest = { type: 'run', id, task: name, args: payload, policy: { ...ctx.policy } };
        w.postMessage(request, collectTransferables(payload));
      });
      return {
        id,
        inWorker: true,
        promise,
        cancel: () => {
          const p = pending.get(id);
          if (!p) return;
          pending.delete(id);
          // Manifold no se interrumpe: se termina el Worker y se recrea en la próxima tarea.
          resetWorker();
          p.reject(new EngineCancelledError());
          failAll(new EngineCancelledError());
        },
      };
    },
    dispose() {
      resetWorker();
      failAll(new EngineCancelledError());
    },
  };
}

let shared: EngineClient | null = null;

/** Cliente compartido de la app (Worker perezoso). */
export function getEngineClient(): EngineClient {
  shared ??= createEngineClient();
  return shared;
}
