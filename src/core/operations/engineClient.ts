/**
 * @file src/core/operations/engineClient.ts
 * @description Cliente del Worker del motor: un único Worker reutilizable (Manifold se inicializa
 * una vez), entradas copiadas y transferidas, resultados transferidos de vuelta, nombres
 * resueltos con el `ResultNaming` real, progreso por fase y cancelación en dos modos: «suave»
 * (descarta el resultado cuando llegue; el Worker sigue vivo y no se recarga Manifold) y «dura»
 * (como Manifold no se puede interrumpir, termina el Worker y reencola las demás tareas pendientes
 * en uno nuevo). Si un trabajo descartado deja ocupado al Worker más de `softCancelGraceMs`
 * mientras otro pedido espera, se escala a dura. Solo cuenta el descartado que se está ejecutando
 * (enviado antes que el pendiente más antiguo; el Worker atiende en orden de envío): uno que quedó
 * en cola detrás de un trabajo legítimo no bloquea a nadie y no provoca reiniciar el Worker. Sin `Worker` (Node, Vitest, MCP headless) ejecuta
 * la misma tarea en proceso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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

/**
 * `soft`: rechaza ya y descarta el resultado cuando llegue, sin tocar el Worker (desmontajes y
 * reemplazos de vistas previas o análisis). `hard`: además termina el Worker para liberarlo ya
 * (botón Cancelar del usuario o tope de tiempo).
 */
export type EngineCancelMode = 'soft' | 'hard';

export interface EngineJob<R> {
  id: number;
  /** true si corre en el Worker (una cancelación dura lo termina y lo recrea). */
  inWorker: boolean;
  promise: Promise<R>;
  /** Cancela la tarea; sin modo es `hard`. */
  cancel(mode?: EngineCancelMode): void;
}

export interface EngineClientOptions {
  /**
   * Cuánto puede esperar un pedido detrás de trabajos cancelados en suave antes de escalar a dura
   * (terminar el Worker y reencolar lo pendiente).
   */
  softCancelGraceMs?: number;
}

/** Espera por defecto antes de escalar una cancelación suave que bloquea al siguiente pedido. */
export const SOFT_CANCEL_GRACE_MS = 1500;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
  onProgress?: (phase: string) => void;
  ctx: OperationContext;
  known: SceneObject[];
  /** Tarea y argumentos originales (intactos: se envía una copia) para reencolar en un Worker nuevo. */
  task: EngineTaskName;
  args: unknown;
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

export function createEngineClient(
  factory: () => WorkerLike | null = defaultWorkerFactory,
  options: EngineClientOptions = {},
): EngineClient {
  const graceMs = options.softCancelGraceMs ?? SOFT_CANCEL_GRACE_MS;
  let worker: WorkerLike | null = null;
  let workerUnavailable = false;
  let nextId = 1;
  const pending = new Map<number, Pending>();
  /** Tareas canceladas en suave que el Worker todavía está calculando (su respuesta se descarta). */
  const orphans = new Set<number>();
  /** Orden de envío al Worker actual (el Worker atiende en ese orden). */
  const sentSeq = new Map<number, number>();
  let nextSeq = 0;
  let escalation: ReturnType<typeof setTimeout> | null = null;

  const disarmEscalation = () => {
    if (escalation !== null) clearTimeout(escalation);
    escalation = null;
  };

  const failAll = (err: unknown) => {
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };

  const resetWorker = () => {
    worker?.terminate();
    worker = null;
    orphans.clear();
    sentSeq.clear();
    disarmEscalation();
  };

  /**
   * Hay un huérfano que retiene al Worker: fue enviado antes que el pendiente más antiguo (así que
   * está en ejecución o delante en la cola) y alguien espera detrás. Un huérfano enviado después del
   * pendiente más antiguo todavía no empezó: no bloquea y no justifica reiniciar el Worker.
   */
  const orphanBlocking = (): boolean => {
    if (orphans.size === 0 || pending.size === 0) return false;
    let oldestPending = Infinity;
    for (const id of pending.keys()) oldestPending = Math.min(oldestPending, sentSeq.get(id) ?? Infinity);
    for (const id of orphans) if ((sentSeq.get(id) ?? Infinity) < oldestPending) return true;
    return false;
  };

  /**
   * Un pedido quedó en cola detrás de un trabajo descartado: si sigue ahí pasado el umbral, el
   * Worker se termina y lo pendiente se reencola en uno nuevo (nadie puede cancelar un huérfano).
   */
  const armEscalation = () => {
    if (escalation !== null || !orphanBlocking()) return;
    escalation = setTimeout(() => {
      escalation = null;
      if (!orphanBlocking()) return;
      resetWorker();
      requeuePending();
    }, graceMs);
  };

  /** Envía la tarea al Worker; si `postMessage` lanza (p. ej. DataCloneError) la rechaza y la limpia. */
  const post = (w: WorkerLike, id: number, p: Pending): void => {
    try {
      const payload = copyForTransfer(p.args);
      const request: EngineTaskRequest = { type: 'run', id, task: p.task, args: payload, policy: { ...p.ctx.policy } };
      w.postMessage(request, collectTransferables(payload));
      sentSeq.set(id, nextSeq++);
    } catch (err) {
      pending.delete(id);
      p.reject(err);
    }
  };

  /** Tras terminar el Worker por una cancelación, reenvía las demás tareas pendientes al Worker nuevo. */
  const requeuePending = (): void => {
    if (pending.size === 0) return;
    const w = ensureWorker();
    if (!w) {
      failAll(new Error('Engine worker unavailable'));
      return;
    }
    for (const [id, p] of [...pending]) post(w, id, p);
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
      if (!p) {
        // Cancelada: el resultado se descarta; si era un huérfano, el Worker ya quedó libre de él.
        if (data.type !== 'progress' && orphans.delete(data.id)) {
          sentSeq.delete(data.id);
          if (!orphanBlocking()) disarmEscalation();
        }
        return;
      }
      if (data.type === 'progress') {
        p.onProgress?.(data.phase);
        return;
      }
      pending.delete(data.id);
      sentSeq.delete(data.id);
      // Terminó un trabajo legítimo: si el siguiente en el Worker es un huérfano, ahora bloquea.
      armEscalation();
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
          runEngineTaskInProcess(onProgress ? { ...ctx, onProgress } : ctx, name, args).then(
            (r) => (cancelled ? undefined : resolve(r)),
            (e) => (cancelled ? undefined : reject(e)),
          );
        });
        return { id, inWorker: false, promise, cancel: () => { cancelled = true; rejectJob(new EngineCancelledError()); } };
      }
      const promise = new Promise<EngineTaskResult<typeof name>>((resolve, reject) => {
        const entry: Pending = { resolve: resolve as (v: unknown) => void, reject, onProgress, ctx, known: sceneObjectsIn(args), task: name, args };
        pending.set(id, entry);
        post(w, id, entry);
      });
      armEscalation();
      return {
        id,
        inWorker: true,
        promise,
        cancel: (mode = 'hard') => {
          const p = pending.get(id);
          if (!p) return;
          pending.delete(id);
          if (mode === 'soft' && worker) {
            // El Worker sigue con el cálculo; su respuesta se descarta al llegar.
            orphans.add(id);
            p.reject(new EngineCancelledError());
            // Si ya había pedidos en cola detrás (llegaron cuando aún no había huérfanos), el tope corre desde ahora.
            armEscalation();
            return;
          }
          // Manifold no se interrumpe: se termina el Worker; solo se rechaza esta tarea y las demás
          // pendientes se reencolan en un Worker nuevo.
          resetWorker();
          p.reject(new EngineCancelledError());
          requeuePending();
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
