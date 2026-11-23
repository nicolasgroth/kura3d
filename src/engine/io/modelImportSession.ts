/**
 * @file src/engine/io/modelImportSession.ts
 * @description Sesión de importación de un lote: un Worker que recibe los MTL una sola vez y lee cada
 * archivo dentro de sí (Blob en la web; ArrayBuffer transferido, sin copia, en escritorio). Si el Worker
 * muere o no responde a tiempo, se termina, el archivo falla con "no hay memoria suficiente" y el
 * siguiente usa un Worker nuevo, así la app sigue usable. Sin Worker (Node/Vitest) se lee en proceso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ModelImportError } from './importErrors';
import type { ImportedModel, ModelParseOptions } from './importTypes';
import {
  MtlLibrary,
  runModelImport,
  type ModelImportWorkerMessage,
  type ModelImportWorkerReply,
  type ModelSourceData,
  type MtlSource,
} from './modelImportTask';

/** Tiempo máximo que se espera al Worker por archivo antes de terminarlo (ms). */
export const DEFAULT_IMPORT_TIMEOUT_MS = 120_000;

export interface ModelImportSession {
  /** Lee un archivo; un ArrayBuffer se transfiere (queda inutilizable en el llamador). */
  parse(fileName: string, source: ModelSourceData, options?: ModelParseOptions): Promise<ImportedModel>;
  /** Termina el Worker. */
  dispose(): void;
}

export interface ModelImportSessionOptions {
  timeoutMs?: number;
  /** Fábrica del Worker (pruebas); null = leer en proceso. */
  createWorker?: () => Worker | null;
}

function defaultWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./modelImport.worker.ts', import.meta.url), { type: 'module', name: 'kura-model-import' });
  } catch {
    return null;
  }
}

interface Pending {
  fileName: string;
  resolve: (model: ImportedModel) => void;
  reject: (error: ModelImportError) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Crea la sesión de un lote con sus MTL (se envían una vez por Worker; se decodifican allá). */
export function createModelImportSession(mtls: readonly MtlSource[] = [], options: ModelImportSessionOptions = {}): ModelImportSession {
  const timeoutMs = options.timeoutMs ?? DEFAULT_IMPORT_TIMEOUT_MS;
  const create = options.createWorker ?? defaultWorker;
  const pending = new Map<number, Pending>();
  let worker: Worker | null = null;
  let inProcess: MtlLibrary | null = null;
  let nextId = 1;
  let disposed = false;

  /** El Worker murió o no respondió: se descarta y todo lo pendiente falla por memoria. */
  function discardWorker(detail: string) {
    worker?.terminate();
    worker = null;
    for (const [id, job] of pending) {
      clearTimeout(job.timer);
      pending.delete(id);
      job.reject(new ModelImportError('out-of-memory', detail, job.fileName));
    }
  }

  function ensureWorker(): Worker | null {
    if (worker) return worker;
    const created = create();
    if (!created) return null;
    worker = created;
    created.onmessage = ({ data }: MessageEvent<ModelImportWorkerReply>) => {
      const job = pending.get(data.id);
      if (!job) return;
      clearTimeout(job.timer);
      pending.delete(data.id);
      if (data.ok) job.resolve(data.model);
      else job.reject(new ModelImportError(data.code, data.detail, job.fileName, data.size));
    };
    created.onerror = (event) => {
      event.preventDefault();
      discardWorker(event.message || 'worker');
    };
    created.onmessageerror = () => discardWorker('worker');
    // Los MTL se clonan (no se transfieren) para poder reenviarlos si hay que recrear el Worker.
    if (mtls.length > 0) created.postMessage({ kind: 'mtl', entries: [...mtls] } satisfies ModelImportWorkerMessage);
    return created;
  }

  async function parse(fileName: string, source: ModelSourceData, parseOptions?: ModelParseOptions): Promise<ImportedModel> {
    if (disposed) throw new ModelImportError('corrupt', 'session disposed', fileName);
    const target = inProcess ? null : ensureWorker();
    if (!target) {
      if (!inProcess) {
        inProcess = new MtlLibrary();
        inProcess.set(mtls);
      }
      return runModelImport(inProcess, { fileName, source, options: parseOptions });
    }
    const id = nextId++;
    return new Promise<ImportedModel>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.has(id)) discardWorker(`timeout ${timeoutMs} ms`);
      }, timeoutMs);
      pending.set(id, { fileName, resolve, reject, timer });
      const message: ModelImportWorkerMessage = { kind: 'parse', id, fileName, source, options: parseOptions };
      target.postMessage(message, source instanceof ArrayBuffer ? [source] : []);
    });
  }

  return {
    parse,
    dispose() {
      if (disposed) return;
      disposed = true;
      discardWorker('session disposed');
    },
  };
}
