/**
 * @file src/store/modelImportNotices.ts
 * @description Avisos de importación/exportación de modelos que dependen de los límites unificados
 * (`MODEL_IO_LIMITS`): tamaño de archivo con su máximo en lenguaje claro y aviso al exportar un archivo
 * que otros programas suelen rechazar o que la propia app no podría volver a abrir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { formatQuantity } from '../i18n/numberLocale';
import * as engine from '../engine';
import { MODEL_IO_LIMITS } from '../engine/operationLimits';
import type { TranslationKey } from '../i18n';
import { ProjectCodecError } from '../project/projectSchema';
import type { LanguageCode } from '../types/kura';
import { LocalFileError } from '../utils/platformBridge';

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Tamaño legible en MB (base 1024, como el explorador de archivos), con el formato del idioma. */
export function formatMegabytes(bytes: number, language: LanguageCode): string {
  const mb = bytes / (1024 * 1024);
  const digits = mb < 10 ? 1 : 0;
  return formatQuantity(language, mb, 'MB', { maxFrac: digits, minFrac: digits });
}

/** Mensaje de archivo demasiado grande con el tamaño y el máximo. */
export function tooLargeMessage(name: string, size: { bytes: number; maxBytes: number }, tr: Translate, language: LanguageCode): string {
  return tr('importReal.tooLarge', { name, size: formatMegabytes(size.bytes, language), max: formatMegabytes(size.maxBytes, language) });
}

/** Mensaje traducido de un fallo de importación que nombra el archivo. */
export function importErrorMessage(error: unknown, fileName: string, tr: Translate, language: LanguageCode = 'es'): string {
  if (error instanceof engine.ModelImportError) {
    if (error.code === 'too-large' && error.size) return tooLargeMessage(error.fileName ?? fileName, error.size, tr, language);
    const base = tr(`importError.${error.code}` as TranslationKey, { name: error.fileName ?? fileName });
    // Sin detalle técnico donde el texto ya lo dice todo (formato no soportado, falta de memoria).
    return error.detail && error.code !== 'unsupported' && error.code !== 'out-of-memory' ? `${base.replace(/[.。।]$/, '')} (${error.detail})` : base;
  }
  if (error instanceof LocalFileError) {
    if (error.reason === 'too-large' && error.size) return tooLargeMessage(error.fileName, error.size, tr, language);
    return tr(`importError.${error.reason}` as TranslationKey, { name: error.fileName });
  }
  if (error instanceof ProjectCodecError && error.code === 'too-large') return tr('importError.too-large', { name: fileName });
  const detail = error instanceof Error ? error.message : String(error);
  return tr('importError.corrupt', { name: fileName }) + (detail ? ` (${detail})` : '');
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
    if (file.bytes > MODEL_IO_LIMITS.maxFileBytes) {
      notices.push(tr('importReal.exportTooBigToReopen', {
        name: file.name,
        size: formatMegabytes(file.bytes, language),
        max: formatMegabytes(MODEL_IO_LIMITS.maxFileBytes, language),
      }));
    } else if (file.bytes > MODEL_IO_LIMITS.exportWarnBytes) {
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
