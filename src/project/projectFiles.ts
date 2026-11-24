/**
 * @file src/project/projectFiles.ts
 * @description Guardado y apertura de archivos de proyecto .kura en navegador (File System Access,
 * descarga) y escritorio (Tauri).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isTauriRuntime, saveBinaryFile } from '../utils/platformBridge';
import { MAX_PROJECT_BYTES, ProjectCodecError } from './projectSchema';

interface SavedProjectFile {
  name: string;
  /** Opaque authorization for this file, valid in the current desktop session. */
  location?: string;
  /** A download can be blocked or canceled after the browser accepts the request. */
  viaDownload?: true;
}

export interface OpenedProjectFile extends SavedProjectFile {
  bytes: Uint8Array;
}

const EXTENSION = '.kura';
const FILTERS = [{ name: 'Kura3D', extensions: ['kura'] }];
const NATIVE_TOO_LARGE = 'kura-project-too-large';
const webLocations = new Map<string, FileSystemFileHandle>();

type SavePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
  excludeAcceptAllOption: boolean;
}) => Promise<FileSystemFileHandle>;
type ProjectBytes = Uint8Array | (() => Promise<Uint8Array>);

function checkSize(size: number): void {
  if (size > MAX_PROJECT_BYTES) throw new ProjectCodecError('too-large');
}

async function readSaveBytes(data: ProjectBytes): Promise<Uint8Array> {
  const bytes = typeof data === 'function' ? await data() : data;
  checkSize(bytes.byteLength);
  return bytes;
}

/** Nombre de archivo `.kura` válido (sin caracteres prohibidos ni puntos finales, con la extensión). */
export function normalizeFileName(defaultName: string): string {
  const name = defaultName.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/[. ]+$/, '');
  if (!name) return `Proyecto${EXTENSION}`;
  return name.toLowerCase().endsWith(EXTENSION) ? name : `${name}${EXTENSION}`;
}

const NATIVE_SAVE_NOT_CONFIRMED = 'kura-save-not-confirmed';

/** El usuario canceló la confirmación nativa de guardar un proyecto abierto desde Recientes: no es un fallo. */
export class SaveNotConfirmedError extends Error {
  constructor() {
    super(NATIVE_SAVE_NOT_CONFIRMED);
    this.name = 'SaveNotConfirmedError';
  }
}

export async function invokeProject<T>(command: string, payload?: Uint8Array | Record<string, unknown>): Promise<T> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, payload);
  } catch (error) {
    if (error === NATIVE_TOO_LARGE) throw new ProjectCodecError('too-large');
    if (error === NATIVE_SAVE_NOT_CONFIRMED) throw new SaveNotConfirmedError();
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

// Match the native IPC envelope while keeping the document bytes binary.
function encodeSavePayload(name: string, bytes: Uint8Array, location?: string): Uint8Array {
  const metadata = new TextEncoder().encode(JSON.stringify({ name, location }));
  const payload = new Uint8Array(4 + metadata.byteLength + bytes.byteLength);
  new DataView(payload.buffer).setUint32(0, metadata.byteLength, true);
  payload.set(metadata, 4);
  payload.set(bytes, 4 + metadata.byteLength);
  return payload;
}

export function decodeOpenPayload(response: ArrayBuffer | number[]): OpenedProjectFile | null {
  // Some desktop WebViews represent a raw IPC response as an array.
  const payload = response instanceof ArrayBuffer ? new Uint8Array(response) : Uint8Array.from(response);
  if (!payload.byteLength) return null;
  if (payload.byteLength < 4) throw new Error('Respuesta de apertura inválida.');
  const metadataLength = new DataView(payload.buffer).getUint32(0, true);
  const bytesOffset = 4 + metadataLength;
  if (bytesOffset > payload.byteLength) throw new Error('Respuesta de apertura incompleta.');
  const { name, location } = JSON.parse(new TextDecoder().decode(payload.subarray(4, bytesOffset)));
  if (typeof name !== 'string' || typeof location !== 'string') {
    throw new Error('Respuesta de apertura inválida.');
  }
  const bytes = payload.subarray(bytesOffset);
  checkSize(bytes.byteLength);
  return { name, location, bytes };
}

function pickWebProjectFile(): Promise<File | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = EXTENSION;
    input.hidden = true;
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.appendChild(input);
    try {
      input.click();
    } catch (error) {
      input.remove();
      reject(error);
    }
  });
}

export async function openProjectFile(): Promise<OpenedProjectFile | null> {
  if (isTauriRuntime()) {
    return decodeOpenPayload(await invokeProject<ArrayBuffer | number[]>('open_kura_project'));
  }

  const file = await pickWebProjectFile();
  if (!file) return null;
  checkSize(file.size);
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

export async function saveProjectFile(
  defaultName: string,
  data: ProjectBytes,
  location?: string,
): Promise<SavedProjectFile | null> {
  const name = normalizeFileName(defaultName);
  if (isTauriRuntime()) {
    const bytes = await readSaveBytes(data);
    return invokeProject('save_kura_project', encodeSavePayload(name, bytes, location));
  }

  const previousHandle = location ? webLocations.get(location) : undefined;
  const picker = typeof window === 'undefined'
    ? undefined
    : (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  let handle = previousHandle;
  if (!handle && picker) {
    try {
      // The picker needs the original click/key gesture, before encoding the project.
      handle = await picker.call(window, {
        suggestedName: name,
        types: [{ description: 'Kura3D', accept: { 'application/octet-stream': [EXTENSION] } }],
        excludeAcceptAllOption: true,
      });
    } catch (error) {
      if (!(error instanceof DOMException)) throw error;
      if (error.name === 'AbortError') return null;
      if (error.name !== 'SecurityError') throw error;
    }
  }

  const bytes = await readSaveBytes(data);
  if (handle) {
    const writable = await handle.createWritable();
    try {
      await writable.write(new Uint8Array(bytes));
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => {});
      throw error;
    }
    const webLocation = previousHandle && location ? location : `web:${crypto.randomUUID()}`;
    webLocations.set(webLocation, handle);
    return { name: handle.name, location: webLocation };
  }

  if (!(await saveBinaryFile(name, bytes, FILTERS))) {
    throw new Error('No se pudo iniciar la descarga del proyecto.');
  }
  return { name, viaDownload: true };
}
