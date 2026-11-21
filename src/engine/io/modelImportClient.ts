/**
 * @file src/engine/io/modelImportClient.ts
 * @description Cliente que delega la lectura de modelos al worker de importación (con respaldo
 * síncrono en entornos sin Worker, como Node/Vitest).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ModelImportError, type ModelImportErrorCode } from './importErrors';
import type { ImportedModel, ModelParseOptions } from './importTypes';

export interface ModelImportRequest {
  fileName: string;
  buffer: ArrayBuffer;
  options?: ModelParseOptions;
}

export type ModelImportResponse =
  | { ok: true; model: ImportedModel }
  | { ok: false; code: ModelImportErrorCode; detail?: string; message: string };

/**
 * Lee un modelo fuera del hilo principal. El buffer se transfiere al worker (queda inutilizable
 * en el llamador). Los errores llegan como `ModelImportError` con el nombre del archivo.
 */
export async function parseModelFileAsync(
  fileName: string,
  buffer: ArrayBuffer,
  options?: ModelParseOptions,
): Promise<ImportedModel> {
  if (typeof Worker === 'undefined') {
    return (await import('./modelImport')).parseModelFile(fileName, buffer, options);
  }
  let worker: Worker;
  try {
    worker = new Worker(new URL('./modelImport.worker.ts', import.meta.url), { type: 'module', name: 'kura-model-import' });
  } catch {
    return (await import('./modelImport')).parseModelFile(fileName, buffer, options);
  }
  try {
    return await new Promise<ImportedModel>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<ModelImportResponse>) => {
        if (data.ok) resolve(data.model);
        else reject(new ModelImportError(data.code, data.detail, fileName));
      };
      worker.onerror = (event) => {
        event.preventDefault();
        reject(new ModelImportError('corrupt', event.message || 'worker', fileName));
      };
      worker.onmessageerror = () => reject(new ModelImportError('corrupt', 'worker', fileName));
      worker.postMessage({ fileName, buffer, options } satisfies ModelImportRequest, [buffer]);
    });
  } finally {
    worker.terminate();
  }
}
