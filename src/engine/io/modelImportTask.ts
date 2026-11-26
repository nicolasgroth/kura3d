/**
 * @file src/engine/io/modelImportTask.ts
 * @description Tarea de importación que corre dentro del Worker (o en proceso sin Worker): lee el Blob
 * del archivo allí mismo, decodifica los MTL recibidos una sola vez y elige el del OBJ por `mtllib`.
 * Define también el protocolo de mensajes entre la sesión y el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { MODEL_IO_LIMITS } from '../operationLimits';
import { ModelImportError, attachFileName, checkInputSize, resolveLimits, type ImportSizeInfo, type ModelImportErrorCode } from './importErrors';
import type { ImportedModel, ModelParseOptions } from './importTypes';
import { parseModelFile } from './modelImport';
import { objMaterialLibraries } from './obj';

/** Contenido de un archivo: un Blob (web, se lee en el Worker) o un ArrayBuffer (escritorio, se transfiere). */
export type ModelSourceData = ArrayBuffer | Blob;

/** Archivo `.mtl` del lote, sin decodificar. */
export interface MtlSource {
  name: string;
  data: ModelSourceData;
}

export type ModelImportWorkerMessage =
  | { kind: 'mtl'; entries: MtlSource[] }
  | { kind: 'parse'; id: number; fileName: string; source: ModelSourceData; options?: ModelParseOptions };

export type ModelImportWorkerReply =
  | { id: number; ok: true; model: ImportedModel }
  | { id: number; ok: false; code: ModelImportErrorCode; detail?: string; size?: ImportSizeInfo; message: string };

/** Bytes del contenido sin leerlo. */
export function sourceBytes(data: ModelSourceData): number {
  return data instanceof ArrayBuffer ? data.byteLength : data.size;
}

/** Cabecera del OBJ donde se buscan las líneas `mtllib` (vista, sin copiar). */
const OBJ_HEAD_BYTES = 1 << 16;

/** MTL del lote: se guardan crudos y se decodifican la primera vez que un OBJ los pide. */
export class MtlLibrary {
  private entries = new Map<string, ModelSourceData>();
  private decoded = new Map<string, Promise<string>>();

  set(entries: readonly MtlSource[]): void {
    this.entries = new Map();
    this.decoded = new Map();
    for (const entry of entries) {
      // Defensa en profundidad: el llamador ya rechaza los MTL sobre el tope con un mensaje.
      if (sourceBytes(entry.data) > MODEL_IO_LIMITS.maxMtlBytes) continue;
      this.entries.set(entry.name.toLowerCase(), entry.data);
    }
  }

  private text(key: string): Promise<string> | undefined {
    const data = this.entries.get(key);
    if (!data) return undefined;
    let text = this.decoded.get(key);
    if (!text) {
      text = data instanceof ArrayBuffer ? Promise.resolve(new TextDecoder('utf-8').decode(data)) : data.text();
      this.decoded.set(key, text);
    }
    return text;
  }

  /** Texto MTL del OBJ: por `mtllib` o, si el lote trae uno solo, ese. */
  async textFor(objBuffer: ArrayBuffer): Promise<string | undefined> {
    if (this.entries.size === 0) return undefined;
    const head = new TextDecoder('utf-8').decode(new Uint8Array(objBuffer, 0, Math.min(objBuffer.byteLength, OBJ_HEAD_BYTES)));
    for (const lib of objMaterialLibraries(head)) {
      const found = this.text(lib.split(/[\\/]/).pop()!.toLowerCase());
      if (found) return found;
    }
    return this.entries.size === 1 ? this.text([...this.entries.keys()][0]) : undefined;
  }
}

/** Lee el archivo (el Blob se lee aquí, nunca en el hilo principal) y lo interpreta. */
export async function runModelImport(
  library: MtlLibrary,
  request: { fileName: string; source: ModelSourceData; options?: ModelParseOptions },
): Promise<ImportedModel> {
  const { fileName, source, options } = request;
  try {
    // El tope se comprueba antes de reservar el contenido.
    checkInputSize(sourceBytes(source), resolveLimits(options?.limits));
    const buffer = source instanceof ArrayBuffer ? source : await source.arrayBuffer();
    const mtlText = options?.mtlText ?? (/\.obj$/i.test(fileName) ? await library.textFor(buffer) : undefined);
    return parseModelFile(fileName, buffer, { ...options, mtlText });
  } catch (error) {
    throw attachFileName(error, fileName);
  }
}

/** Respuesta de error serializable (el Worker no puede enviar la clase). */
export function errorReply(id: number, error: unknown, fileName: string): ModelImportWorkerReply {
  const typed = error instanceof ModelImportError ? error : attachFileName(error, fileName);
  return { id, ok: false, code: typed.code, detail: typed.detail, size: typed.size, message: typed.message };
}
