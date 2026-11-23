/**
 * @file src/store/modelImportNotices.ts
 * @description Avisos de importación/exportación de modelos que dependen de los límites unificados
 * (`MODEL_IO_LIMITS`): tamaño de archivo con su máximo en lenguaje claro y aviso al exportar un archivo
 * que otros programas suelen rechazar o que la propia app no podría volver a abrir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MODEL_IO_LIMITS } from '../engine/operationLimits';
import type { TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Tamaño legible en MB (base 1024, como el explorador de archivos), con el formato del idioma. */
export function formatMegabytes(bytes: number, language: LanguageCode): string {
  const mb = bytes / (1024 * 1024);
  const digits = mb < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(mb)} MB`;
}

/** Mensaje de archivo demasiado grande con el tamaño y el máximo. */
export function tooLargeMessage(name: string, size: { bytes: number; maxBytes: number }, tr: Translate, language: LanguageCode): string {
  return tr('importReal.tooLarge', { name, size: formatMegabytes(size.bytes, language), max: formatMegabytes(size.maxBytes, language) });
}

/**
 * Avisos tras exportar: archivo sobre el tamaño que varios laminadores y sitios rechazan, y escena con
 * más triángulos de los que la app puede volver a importar.
 */
export function exportNotices(
  files: ReadonlyArray<{ name: string; bytes: number }>,
  triangles: number,
  tr: Translate,
  language: LanguageCode,
): string[] {
  const notices: string[] = [];
  const fmt = new Intl.NumberFormat(language);
  for (const file of files) {
    if (file.bytes > MODEL_IO_LIMITS.exportWarnBytes) {
      notices.push(tr('importReal.exportLarge', {
        name: file.name,
        size: formatMegabytes(file.bytes, language),
        limit: formatMegabytes(MODEL_IO_LIMITS.exportWarnBytes, language),
      }));
    }
  }
  if (triangles > MODEL_IO_LIMITS.maxTriangles) {
    notices.push(tr('importReal.exportTooManyTriangles', {
      name: files[0]?.name ?? '',
      tris: fmt.format(triangles),
      max: fmt.format(MODEL_IO_LIMITS.maxTriangles),
    }));
  }
  return notices;
}
