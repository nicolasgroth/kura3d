/**
 * @file src/project/projectCodecClient.ts
 * @description Cliente del Worker del códec de proyectos: un único Worker compartido (se crea la primera vez o al
 * precalentarlo y se reutiliza, así guardar no paga el arranque del módulo cada vez), peticiones con id y, al
 * guardar, el avance que informa el Worker (preparar y comprimir, en porcentaje).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { EncodeProgress } from './projectCodec';
import { MAX_PROJECT_BYTES, ProjectCodecError, type ProjectDocument } from './projectSchema';

export type ProjectCodecRequest = { id: number } & (
  | { operation: 'encode'; document: ProjectDocument }
  | { operation: 'decode'; bytes: Uint8Array }
);

export type ProjectCodecResponse<T = Uint8Array | ProjectDocument> = { id: number } & (
  | { ok: true; value: T }
  | { ok: false; message: string; code?: ProjectCodecError['code'] }
  | { progress: { percent: number; phase: Parameters<EncodeProgress>[1] } }
);

interface Pending {
  resolve: (value: never) => void;
  reject: (error: Error) => void;
  onProgress?: EncodeProgress;
}
interface SharedWorker { worker: Worker; pending: Map<number, Pending> }

let shared: SharedWorker | null = null;
let nextId = 1;

function discard(target: SharedWorker, error: Error) {
  if (shared === target) shared = null;
  target.worker.terminate();
  for (const pending of target.pending.values()) pending.reject(error);
  target.pending.clear();
}

function codecWorker(): SharedWorker {
  if (shared) return shared;
  const worker = new Worker(new URL('./projectCodec.worker.ts', import.meta.url), { type: 'module', name: 'kura-project-codec' });
  const target: SharedWorker = { worker, pending: new Map() };
  worker.onmessage = ({ data }: MessageEvent<ProjectCodecResponse>) => {
    if (data.id === 0 && 'ok' in data && !data.ok) {
      discard(target, new Error(data.message));
      return;
    }
    const pending = target.pending.get(data.id);
    if (!pending) return; // Respuesta de un Worker ya descartado o de una petición ya rechazada.
    if ('progress' in data) {
      pending.onProgress?.(data.progress.percent, data.progress.phase);
      return;
    }
    target.pending.delete(data.id);
    if (data.ok) pending.resolve(data.value as never);
    else pending.reject(data.code ? new ProjectCodecError(data.code) : new Error(data.message));
  };
  worker.onerror = (event) => {
    event.preventDefault();
    discard(target, new Error(event.message || 'The project worker failed.'));
  };
  worker.onmessageerror = () => discard(target, new Error('Unable to read the project worker response.'));
  shared = target;
  return target;
}

function runWorker<T>(request: ProjectCodecRequest, transfer: Transferable[] = [], onProgress?: EncodeProgress): Promise<T> {
  const target = codecWorker();
  return new Promise<T>((resolve, reject) => {
    target.pending.set(request.id, { resolve: resolve as (value: never) => void, reject, onProgress });
    try {
      target.worker.postMessage(request, transfer);
    } catch (error) {
      target.pending.delete(request.id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/** Crea el Worker del códec por adelantado (sin efecto donde no hay Workers). */
export function prewarmProjectCodec(): void {
  if (typeof Worker !== 'undefined') codecWorker();
}

/** Cierra el Worker compartido (pruebas); lo pendiente se rechaza. */
export function resetProjectCodecWorker(): void {
  if (shared) discard(shared, new Error('The project worker was closed.'));
}

export async function encodeProjectAsync(document: ProjectDocument, onProgress?: EncodeProgress): Promise<Uint8Array> {
  if (typeof Worker === 'undefined') return (await import('./projectCodec')).encodeProjectCompressed(document, onProgress);
  // Structured clone snapshots the scene and history. Their geometry remains owned by the editor.
  return runWorker<Uint8Array>({ id: nextId++, operation: 'encode', document }, [], onProgress);
}

/** Consumes the supplied file buffer, including any sibling views on it. */
export async function decodeProjectAsync(bytes: Uint8Array): Promise<ProjectDocument> {
  if (bytes.byteLength > MAX_PROJECT_BYTES) throw new ProjectCodecError('too-large');
  if (typeof Worker === 'undefined') return (await import('./projectCodec')).decodeProject(bytes);
  const owned = bytes.buffer instanceof ArrayBuffer ? bytes : new Uint8Array(bytes);
  return runWorker<ProjectDocument>({ id: nextId++, operation: 'decode', bytes: owned }, [owned.buffer as ArrayBuffer]);
}
