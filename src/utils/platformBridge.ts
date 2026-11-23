/**
 * @file src/utils/platformBridge.ts
 * @description Abstracción dual Nativo (Tauri v2) / Web para apertura y guardado de archivos locales.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MODEL_IO_LIMITS } from '../engine/operationLimits';
import { MAX_PROJECT_BYTES } from '../project/projectSchema';
import { LOG_TAG } from '../brand';

/** Filtro de extensión compatible con diálogos nativos y web. */
export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

/** Resultado normalizado al abrir un archivo local. */
export interface OpenedLocalFile {
  name: string;
  buffer: ArrayBuffer;
}

/** Tope de lectura de archivos locales elegidos por el usuario (mismo límite que el arrastre). */
export const MAX_LOCAL_FILE_BYTES = MAX_PROJECT_BYTES;

/** Tope de lectura de modelos (STL/3MF/OBJ/PLY): lo que la app puede exportar y reabrir. */
export const MAX_MODEL_FILE_BYTES = MODEL_IO_LIMITS.maxFileBytes;

/**
 * ArrayBuffer con exactamente los bytes de `bytes`, sin copiar cuando la vista ya cubre su buffer
 * entero (lo normal en `readFile` de Tauri). Solo copia si la vista es un tramo de un buffer mayor.
 */
export function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer) return bytes.buffer;
  return bytes.slice().buffer as ArrayBuffer;
}

/** Extensiones (sin punto, en minúsculas) aceptadas por un conjunto de filtros de diálogo. */
export function filterExtensions(filters: FileDialogFilter[]): string[] {
  return filters.flatMap((filter) => filter.extensions.map((ext) => ext.toLowerCase()));
}

/**
 * Comprueba que una ruta devuelta por el diálogo nativo termine en una extensión permitida.
 * Una lista vacía no restringe (selector de imágenes sin filtro explícito).
 */
export function hasAllowedExtension(path: string, extensions: string[]): boolean {
  if (extensions.length === 0) return true;
  const name = path.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 && extensions.includes(name.slice(dot + 1).toLowerCase());
}

/**
 * Detecta en tiempo de ejecución si Kura3D está corriendo dentro del contenedor nativo Tauri v2.
 */
export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const win = window as unknown as Record<string, unknown>;
  return Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
}

/** Carga los plugins nativos de diálogo y sistema de archivos; null si no están disponibles. */
async function loadTauriFilePlugins() {
  try {
    const [dialogMod, fsMod] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    return { dialogMod, fsMod };
  } catch (err) {
    console.warn(`${LOG_TAG} Plugins nativos no disponibles; se usa la ruta web:`, err);
    return null;
  }
}

/** Error al escribir en disco desde el contenedor nativo (no se oculta tras una descarga web). */
export class FileSaveError extends Error {
  constructor(readonly fileName: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'FileSaveError';
  }
}

/**
 * Guarda un buffer binario (STL, 3MF, etc.) o de texto UTF-8 (OBJ) en disco.
 * En Tauri abre el diálogo nativo del sistema operativo; en Web dispara una descarga Blob instantánea.
 * Devuelve false si el usuario cancela. Si la escritura nativa falla lanza `FileSaveError`
 * (no recurre a la descarga web, que ocultaría el fallo).
 */
export async function saveBinaryFile(
  defaultName: string,
  data: Uint8Array,
  filters: FileDialogFilter[],
): Promise<boolean> {
  return (await saveFileWithDialog(defaultName, data, filters)) !== null;
}

/**
 * Igual que `saveBinaryFile`, pero devuelve la ruta elegida en Tauri (o el nombre en Web),
 * o null si el usuario canceló.
 */
export async function saveFileWithDialog(
  defaultName: string,
  data: Uint8Array,
  filters: FileDialogFilter[],
): Promise<string | null> {
  if (isTauriRuntime()) {
    const plugins = await loadTauriFilePlugins();
    if (plugins) {
      let targetPath: string | null;
      try {
        targetPath = await plugins.dialogMod.save({ defaultPath: defaultName, filters });
      } catch (err) {
        throw new FileSaveError(defaultName, err);
      }
      if (!targetPath) return null;
      if (!hasAllowedExtension(targetPath, filterExtensions(filters))) {
        console.warn(`${LOG_TAG} Destino rechazado: extensión no permitida.`);
        return null;
      }
      try {
        await plugins.fsMod.writeFile(targetPath, data);
      } catch (err) {
        throw new FileSaveError(targetPath.split(/[\\/]/).pop() || defaultName, err);
      }
      return targetPath;
    }
  }
  return downloadInBrowser(defaultName, data) ? defaultName : null;
}

/** Archivo de un conjunto a guardar (p. ej. OBJ + MTL). */
export interface SaveSetEntry {
  name: string;
  data: Uint8Array;
  filters: FileDialogFilter[];
}

/**
 * Guarda un archivo principal y sus acompañantes (MTL de un OBJ). En Tauri pide un destino para
 * cada uno, proponiendo la carpeta del principal; en Web descarga todos. Devuelve false si se
 * canceló el principal.
 */
export async function saveFileSet(entries: SaveSetEntry[]): Promise<boolean> {
  const [primary, ...companions] = entries;
  if (!primary) return false;
  const primaryPath = await saveFileWithDialog(primary.name, primary.data, primary.filters);
  if (primaryPath === null) return false;
  const folder = primaryPath.includes('/') || primaryPath.includes('\\')
    ? primaryPath.slice(0, Math.max(primaryPath.lastIndexOf('/'), primaryPath.lastIndexOf('\\')) + 1)
    : '';
  for (const companion of companions) {
    await saveFileWithDialog(`${folder}${companion.name}`, companion.data, companion.filters);
  }
  return true;
}

/** Descarga un archivo vía Blob; false si no hay DOM (Node / Vitest). */
function downloadInBrowser(defaultName: string, data: Uint8Array): boolean {
  // Guardia para entornos headless (Node / Vitest) sin DOM disponible
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return false;
  }

  // Ruta Web estándar: Blob + enlace temporal sin fugas de memoria.
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const blob = new Blob([copy.buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = defaultName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } finally {
    // Liberar ObjectURL tras iniciar la descarga en el navegador.
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

/**
 * Archivo elegido por el usuario, leído bajo demanda (permite reportar fallos por archivo). En la web
 * `read` entrega el propio `File` (se lee dentro del Worker); en escritorio, el ArrayBuffer del disco.
 */
export interface LocalFileHandle {
  name: string;
  /** Tamaño en bytes, conocido antes de leer. */
  size?: number;
  read: () => Promise<ArrayBuffer | Blob>;
}

/** Error de lectura de un archivo local concreto (tamaño excesivo o no es un archivo normal). */
export class LocalFileError extends Error {
  constructor(
    readonly fileName: string,
    readonly reason: 'too-large' | 'not-file' | 'unreadable',
    /** En `too-large`: tamaño del archivo y máximo. */
    readonly size?: { bytes: number; maxBytes: number },
  ) {
    super(reason);
    this.name = 'LocalFileError';
  }
}

/**
 * Abre un selector de varios archivos (Web o Tauri v2). Cada archivo se lee al llamar a `read()`
 * y falla por separado con `LocalFileError`, para que un lote pueda importarse parcialmente.
 */
export async function openLocalFiles(accept: string, maxBytes: number = MAX_LOCAL_FILE_BYTES): Promise<LocalFileHandle[]> {
  const extensions = accept
    .split(',')
    .map((ext) => ext.trim().replace(/^\./, '').toLowerCase())
    .filter((ext) => ext.length > 0 && !ext.includes('*') && !ext.includes('/'));

  if (isTauriRuntime()) {
    const plugins = await loadTauriFilePlugins();
    if (plugins) {
      const selected = await plugins.dialogMod.open({
        multiple: true,
        directory: false,
        filters: extensions.length > 0 ? [{ name: 'Archivos soportados', extensions }] : undefined,
      });
      const paths = (selected === null ? [] : Array.isArray(selected) ? selected : [selected])
        .filter((path) => hasAllowedExtension(path, extensions));
      // Tamaños antes de leer: el lote aplica su tope total sin cargar nada en memoria.
      const sizes = await Promise.all(paths.map((path) => plugins.fsMod.stat(path).then((info) => info.size, () => undefined)));
      return paths.map((path, index) => {
        const name = path.split(/[\\/]/).pop() || 'model';
        return {
          name,
          size: sizes[index],
          async read() {
            const info = await plugins.fsMod.stat(path);
            if (!info.isFile) throw new LocalFileError(name, 'not-file');
            if (info.size > maxBytes) throw new LocalFileError(name, 'too-large', { bytes: info.size, maxBytes });
            // Sin copia: el buffer de `readFile` se transfiere tal cual al Worker.
            return exactArrayBuffer(await plugins.fsMod.readFile(path));
          },
        };
      });
    }
  }

  if (typeof document === 'undefined') return [];
  return new Promise<LocalFileHandle[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = true;
    input.style.display = 'none';
    let settled = false;
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files.map((file) => ({
        name: file.name,
        size: file.size,
        // El `File` mismo: se lee dentro del Worker, nunca entero en el hilo principal.
        async read() {
          if (file.size > maxBytes) throw new LocalFileError(file.name, 'too-large', { bytes: file.size, maxBytes });
          return file;
        },
      })));
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])), { once: true });
    input.addEventListener('cancel', () => finish([]), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Abre un selector de archivo local en Web o Tauri v2 y retorna su nombre + ArrayBuffer.
 */
export async function openLocalFile(accept: string): Promise<OpenedLocalFile | null> {
  if (isTauriRuntime()) {
    try {
      const dialogMod = await import('@tauri-apps/plugin-dialog');
      const fsMod = await import('@tauri-apps/plugin-fs');

      const extensions = accept
        .split(',')
        .map((ext) => ext.trim().replace(/^\./, '').toLowerCase())
        .filter((ext) => ext.length > 0 && !ext.includes('*') && !ext.includes('/'));

      const filters: FileDialogFilter[] =
        extensions.length > 0
          ? [{ name: 'Archivos soportados', extensions }]
          : accept.includes('image')
            ? [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
            : [];

      const selected = await dialogMod.open({
        multiple: false,
        directory: false,
        filters: filters.length > 0 ? filters : undefined,
      });

      if (!selected || Array.isArray(selected)) {
        return null;
      }
      const allowed = filters.length > 0 ? filterExtensions(filters) : [];
      if (!hasAllowedExtension(selected, allowed)) {
        console.warn(`${LOG_TAG} Archivo rechazado: extensión no permitida.`);
        return null;
      }
      const info = await fsMod.stat(selected);
      if (!info.isFile || info.size > MAX_LOCAL_FILE_BYTES) {
        console.warn(`${LOG_TAG} Archivo rechazado: no es un archivo normal o supera el tamaño máximo.`);
        return null;
      }

      const buffer = exactArrayBuffer(await fsMod.readFile(selected));
      const segments = selected.split(/[\\/]/);
      const name = segments[segments.length - 1] || 'model';

      return {
        name,
        buffer,
      };
    } catch (err) {
      console.warn(`${LOG_TAG} Fallback a selector web tras error Tauri:`, err);
    }
  }

  // Ruta Web estándar usando <input type="file"> efímero y manejando cancelación limpia.
  return new Promise<OpenedLocalFile | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    let settled = false;
    const cleanup = () => {
      input.remove();
    };

    input.addEventListener(
      'change',
      async () => {
        if (settled) return;
        settled = true;
        const file = input.files?.[0];
        cleanup();
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const buffer = await file.arrayBuffer();
          resolve({ name: file.name, buffer });
        } catch {
          resolve(null);
        }
      },
      { once: true },
    );

    input.addEventListener(
      'cancel',
      () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(null);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}
