/**
 * @file src/engine/io/modelImport.ts
 * @description Punto de entrada único de lectura de modelos: detecta el formato por extensión,
 * aplica límites y adjunta el nombre del archivo a cualquier error.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ModelImportError, attachFileName } from './importErrors';
import type { ImportedModel, ModelImportFormat, ModelParseOptions } from './importTypes';
import { readOBJBuffer } from './obj';
import { readPLY } from './ply';
import { readSTL } from './stl';
import { read3MF } from './threeMfImport';

/** Extensiones de modelo importables (sin punto). */
export const MODEL_IMPORT_EXTENSIONS: ModelImportFormat[] = ['stl', '3mf', 'obj', 'ply'];

/** Atributo `accept` para selectores de archivo (incluye MTL para colores de OBJ). */
export const MODEL_IMPORT_ACCEPT = '.stl,.3mf,.obj,.ply,.mtl';

/** Detecta el formato por la extensión del nombre de archivo. */
export function detectModelFormat(fileName: string): ModelImportFormat | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  return (MODEL_IMPORT_EXTENSIONS as string[]).includes(ext) ? (ext as ModelImportFormat) : null;
}

/** Lee un archivo de modelo; los errores salen como `ModelImportError` con `fileName`. */
export function parseModelFile(fileName: string, buffer: ArrayBuffer, options: ModelParseOptions = {}): ImportedModel {
  try {
    const format = detectModelFormat(fileName);
    switch (format) {
      case 'stl':
        return readSTL(buffer, fileName, options.limits);
      case 'obj':
        return readOBJBuffer(buffer, fileName, { mtlText: options.mtlText, limits: options.limits });
      case 'ply':
        return readPLY(buffer, fileName, options.limits);
      case '3mf':
        return read3MF(buffer, fileName, options.limits);
      default:
        throw new ModelImportError('unsupported', fileName.split('.').pop());
    }
  } catch (error) {
    throw attachFileName(error, fileName);
  }
}
