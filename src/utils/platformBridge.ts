/**
 * @file src/utils/platformBridge.ts
 * @description Abstracción dual Nativo (Tauri v2) / Web para apertura y guardado de archivos locales.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MAX_PROJECT_BYTES } from '../project/projectSchema';

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

/**
 * Guarda un buffer binario (STL, 3MF, etc.) o de texto UTF-8 (OBJ) en disco.
 * En Tauri abre el diálogo nativo del sistema operativo; en Web dispara una descarga Blob instantánea.
 */
export async function saveBinaryFile(
  defaultName: string,
  data: Uint8Array,
  filters: FileDialogFilter[],
): Promise<boolean> {
  if (isTauriRuntime()) {
    try {
      const dialogMod = await import('@tauri-apps/plugin-dialog');
      const fsMod = await import('@tauri-apps/plugin-fs');

      const targetPath = await dialogMod.save({
        defaultPath: defaultName,
        filters,
      });

      if (!targetPath) {
        return false;
      }
      if (!hasAllowedExtension(targetPath, filterExtensions(filters))) {
        console.warn('[Kura3D] Destino rechazado: extensión no permitida.');
        return false;
      }

      await fsMod.writeFile(targetPath, data);
      return true;
    } catch (err) {
      // Si falla el plugin nativo por permisos o entorno, recurrimos al fallback web.
      console.warn('[Kura3D] Fallback a descarga web tras error Tauri:', err);
    }
  }

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
        console.warn('[Kura3D] Archivo rechazado: extensión no permitida.');
        return null;
      }
      const info = await fsMod.stat(selected);
      if (!info.isFile || info.size > MAX_LOCAL_FILE_BYTES) {
        console.warn('[Kura3D] Archivo rechazado: no es un archivo normal o supera el tamaño máximo.');
        return null;
      }

      const bytes = await fsMod.readFile(selected);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const segments = selected.split(/[\\/]/);
      const name = segments[segments.length - 1] || 'model';

      return {
        name,
        buffer: copy.buffer,
      };
    } catch (err) {
      console.warn('[Kura3D] Fallback a selector web tras error Tauri:', err);
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
