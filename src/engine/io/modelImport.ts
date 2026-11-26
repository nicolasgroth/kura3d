/**
 * @file src/engine/io/modelImport.ts
 * @description Punto de entrada único de lectura de modelos: detecta el formato por extensión,
 * aplica límites, adjunta el nombre del archivo a cualquier error y corrige normales invertidas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { ModelImportError, attachFileName } from './importErrors';
import { findImportClusters } from './importClusters';
import { fixImportedOrientation } from './importOrientation';
import type { ImportedModel, ModelImportFormat, ModelParseOptions } from './importTypes';
import { readOBJBuffer } from './obj';
import { readPLY } from './ply';
import { readSTL } from './stl';
import { read3MF } from './threeMfImport';
import { unitHintOf } from './unitHint';
import { analyzeImportedModel } from './importAnalysis';

/** Extensiones de modelo importables (sin punto). */
export const MODEL_IMPORT_EXTENSIONS: ModelImportFormat[] = ['stl', '3mf', 'obj', 'ply'];

/** Atributo `accept` para selectores de archivo (incluye MTL para colores de OBJ). */
export const MODEL_IMPORT_ACCEPT = '.stl,.3mf,.obj,.ply,.mtl';

/** Detecta el formato por la extensión del nombre de archivo. */
export function detectModelFormat(fileName: string): ModelImportFormat | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  return (MODEL_IMPORT_EXTENSIONS as string[]).includes(ext) ? (ext as ModelImportFormat) : null;
}

/**
 * Lee un archivo de modelo; los errores salen como `ModelImportError` con `fileName`. Las piezas
 * con normales invertidas se reorientan y el modelo trae el aviso en `warnings`.
 */
export function parseModelFile(fileName: string, buffer: ArrayBuffer, options: ModelParseOptions = {}): ImportedModel {
  const read = readModelFile(fileName, buffer, options);
  // Una escena de Kurra Studio vuelve exacta: sin reorientar normales ni buscar conjuntos.
  if (read.kuraScene) return analyzeImportedModel({ ...read, clusters: [] });
  const model = fixImportedOrientation(read);
  // Conjuntos y diagnóstico de unidades calculados una vez, aquí (en el Worker).
  const unitHint = unitHintOf(model);
  return analyzeImportedModel({ ...model, clusters: findImportClusters(model), ...(unitHint ? { unitHint } : {}) });
}

function readModelFile(fileName: string, buffer: ArrayBuffer, options: ModelParseOptions): ImportedModel {
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
