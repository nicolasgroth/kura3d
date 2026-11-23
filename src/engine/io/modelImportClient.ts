/**
 * @file src/engine/io/modelImportClient.ts
 * @description Lectura de un único modelo fuera del hilo principal (sesión de un solo archivo), con
 * respaldo en proceso en entornos sin Worker, como Node/Vitest.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ImportedModel, ModelParseOptions } from './importTypes';
import { DEFAULT_IMPORT_TIMEOUT_MS, createModelImportSession } from './modelImportSession';
import type { ModelSourceData } from './modelImportTask';

export { DEFAULT_IMPORT_TIMEOUT_MS };

/**
 * Lee un modelo fuera del hilo principal. Un ArrayBuffer se transfiere al Worker (queda inutilizable
 * en el llamador); un Blob se lee dentro del Worker. Los errores llegan como `ModelImportError` con el
 * nombre del archivo; si el Worker muere o no responde en `timeoutMs`, se termina y el error es
 * `out-of-memory`, de modo que quien espera (p. ej. `busyOperation`) siempre se libera.
 */
export async function parseModelFileAsync(
  fileName: string,
  source: ModelSourceData,
  options?: ModelParseOptions,
  timeoutMs = DEFAULT_IMPORT_TIMEOUT_MS,
): Promise<ImportedModel> {
  const session = createModelImportSession([], { timeoutMs });
  try {
    return await session.parse(fileName, source, options);
  } finally {
    session.dispose();
  }
}
