/**
 * @file src/store/modelImportBatch.ts
 * @description Lectura de un lote de modelos cuidando la memoria del hilo principal: tope total del
 * lote, tope propio de los MTL (se pasan crudos a la sesión, una vez, y se decodifican en el Worker),
 * borrador de recuperación antes del primer archivo grande y una sesión de Worker que se recrea si se
 * queda sin memoria. Devuelve los modelos leídos y los fallos ya traducidos, por archivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as engine from '../engine';
import { MODEL_IO_LIMITS } from '../engine/operationLimits';
import type { LanguageCode } from '../types/kura';
import type { ModelImportSource } from './modelIoActions';
import { formatMegabytes, importErrorMessage, type Translate } from './modelImportNotices';

export interface ModelBatchDeps {
  tr: Translate;
  language: LanguageCode;
  /** Sesión de lectura (pruebas); por defecto la del Worker de importación. */
  createSession?: (mtls: readonly engine.MtlSource[]) => engine.ModelImportSession;
  /** Asegura un borrador de recuperación antes de leer un archivo grande (si hay cambios sin guardar). */
  ensureRecoveryDraft?: () => Promise<void>;
  /** Cancelación del usuario: termina el Worker y descarta lo leído. */
  signal?: AbortSignal;
}

export interface ModelBatchResult {
  models: engine.ImportedModel[];
  failures: string[];
  /** true si el usuario canceló: no hay modelos ni fallos que informar. */
  cancelled?: boolean;
}

const isMtl = (name: string) => /\.mtl$/i.test(name);

/** Lee los MTL del lote sin decodificarlos; los que pasan su tope se informan sin leerse. */
async function readMtls(files: ModelImportSource[], deps: ModelBatchDeps, failures: string[]): Promise<engine.MtlSource[]> {
  const entries: engine.MtlSource[] = [];
  const maxBytes = MODEL_IO_LIMITS.maxMtlBytes;
  for (const file of files) {
    try {
      if (file.size !== undefined && file.size > maxBytes) throw new engine.ModelImportError('too-large', undefined, file.name, { bytes: file.size, maxBytes });
      const data = await file.read();
      const bytes = engine.sourceBytes(data);
      if (bytes > maxBytes) throw new engine.ModelImportError('too-large', undefined, file.name, { bytes, maxBytes });
      entries.push({ name: file.name, data });
    } catch (error) {
      failures.push(importErrorMessage(error, file.name, deps.tr, deps.language));
    }
  }
  return entries;
}

/** Lee un lote: un archivo a la vez, sin pasar del tope total; los fallos se nombran y el resto sigue. */
export async function readModelBatch(files: ModelImportSource[], deps: ModelBatchDeps): Promise<ModelBatchResult> {
  const failures: string[] = [];
  const models: engine.ImportedModel[] = [];
  const mtls = await readMtls(files.filter((f) => isMtl(f.name)), deps, failures);
  const overBatch: string[] = [];
  const maxBatch = MODEL_IO_LIMITS.maxBatchBytes;
  let total = mtls.reduce((acc, m) => acc + engine.sourceBytes(m.data), 0);
  let draftEnsured = false;
  const ensureDraft = async (bytes: number) => {
    if (draftEnsured || bytes <= MODEL_IO_LIMITS.recoveryBeforeBytes || !deps.ensureRecoveryDraft) return;
    draftEnsured = true;
    try {
      await deps.ensureRecoveryDraft();
    } catch {
      // El autoguardado informa sus propios fallos; la importación sigue.
    }
  };

  const session = (deps.createSession ?? ((entries) => engine.createModelImportSession(entries)))(mtls);
  // Cancelar termina el Worker al instante (lo pendiente falla y se descarta abajo).
  const onAbort = () => session.dispose();
  deps.signal?.addEventListener('abort', onAbort, { once: true });
  // Leer el archivo o esperar al Worker no deja colgada la cancelación.
  const cancellable = <T,>(work: Promise<T>): Promise<T> => {
    const signal = deps.signal;
    if (!signal) return work;
    return Promise.race([
      work,
      new Promise<never>((_, reject) => {
        if (signal.aborted) reject(new Error('import cancelled'));
        else signal.addEventListener('abort', () => reject(new Error('import cancelled')), { once: true });
      }),
    ]);
  };
  try {
    for (const file of files.filter((f) => !isMtl(f.name))) {
      if (deps.signal?.aborted) break;
      try {
        if (!engine.detectModelFormat(file.name)) throw new engine.ModelImportError('unsupported', undefined, file.name);
        if (file.size !== undefined && total + file.size > maxBatch) {
          overBatch.push(file.name);
          continue;
        }
        if (file.size !== undefined) await ensureDraft(file.size);
        const data = await cancellable(file.read());
        const bytes = Math.max(file.size ?? 0, engine.sourceBytes(data));
        if (total + bytes > maxBatch) {
          overBatch.push(file.name);
          continue;
        }
        total += bytes;
        await ensureDraft(bytes);
        models.push(await cancellable(session.parse(file.name, data)));
      } catch (error) {
        failures.push(importErrorMessage(error, file.name, deps.tr, deps.language));
      }
    }
  } finally {
    deps.signal?.removeEventListener('abort', onAbort);
    session.dispose();
  }
  if (deps.signal?.aborted) return { models: [], failures: [], cancelled: true };
  if (overBatch.length > 0) {
    failures.push(deps.tr('importReal.batchTooLarge', {
      list: overBatch.join(', '),
      max: formatMegabytes(maxBatch, deps.language),
    }));
  }
  return { models, failures };
}
