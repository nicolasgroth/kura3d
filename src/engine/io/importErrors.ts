/**
 * @file src/engine/io/importErrors.ts
 * @description Errores tipados y límites de entrada para la importación de modelos (STL, OBJ, PLY, 3MF).
 * Cada error lleva un código estable que la interfaz traduce y, cuando se conoce, el archivo que falló.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Códigos estables de fallo de importación (la interfaz los traduce como `importError.<código>`). */
export type ModelImportErrorCode =
  | 'empty'
  | 'unsupported'
  | 'too-large'
  | 'archive-too-large'
  | 'truncated'
  | 'corrupt'
  | 'missing-model'
  | 'no-geometry'
  | 'invalid-index'
  | 'non-finite'
  | 'too-many-triangles'
  | 'too-many-parts'
  | 'component-cycle'
  | 'timeout';

/** Límites de entrada aplicados por todos los lectores. */
export interface ModelImportLimits {
  /** Tamaño máximo del archivo de entrada en bytes. */
  maxFileBytes: number;
  /** Suma máxima declarada de bytes descomprimidos dentro de un paquete 3MF. */
  maxUncompressedBytes: number;
  /** Triángulos máximos resultantes por archivo (tras expandir instancias y componentes). */
  maxTriangles: number;
  /** Piezas máximas resultantes por archivo. */
  maxParts: number;
  /** Profundidad máxima de anidamiento de `<components>` 3MF. */
  maxComponentDepth: number;
  /** Nodos máximos visitados al expandir componentes 3MF (con o sin malla). */
  maxSceneNodes: number;
}

export const DEFAULT_IMPORT_LIMITS: ModelImportLimits = {
  maxFileBytes: 128 * 1024 * 1024,
  maxUncompressedBytes: 512 * 1024 * 1024,
  maxTriangles: 12_000_000,
  maxParts: 2_000,
  maxComponentDepth: 16,
  maxSceneNodes: 100_000,
};

/** Completa límites parciales con los valores por defecto. */
export function resolveLimits(partial?: Partial<ModelImportLimits>): ModelImportLimits {
  return { ...DEFAULT_IMPORT_LIMITS, ...(partial ?? {}) };
}

const DEFAULT_MESSAGES: Record<ModelImportErrorCode, string> = {
  empty: 'El archivo está vacío.',
  unsupported: 'Formato de archivo no soportado.',
  'too-large': 'El archivo supera el tamaño máximo permitido.',
  'archive-too-large': 'El contenido descomprimido del paquete supera el límite permitido.',
  truncated: 'El archivo está truncado.',
  corrupt: 'El archivo está dañado o no se puede leer.',
  'missing-model': 'El paquete 3MF no contiene un documento de modelo.',
  'no-geometry': 'El archivo no contiene geometría válida.',
  'invalid-index': 'Un triángulo referencia un vértice inexistente.',
  'non-finite': 'El archivo contiene coordenadas no numéricas (NaN o infinito).',
  'too-many-triangles': 'El modelo supera el número máximo de triángulos permitido.',
  'too-many-parts': 'El modelo supera el número máximo de piezas permitido.',
  'component-cycle': 'Los componentes 3MF forman un ciclo o anidan demasiado.',
  timeout: 'La lectura del archivo tardó demasiado y se canceló.',
};

/** Error de importación con código estable y nombre de archivo opcional. */
export class ModelImportError extends Error {
  readonly code: ModelImportErrorCode;
  fileName?: string;
  readonly detail?: string;

  constructor(code: ModelImportErrorCode, detail?: string, fileName?: string) {
    const base = DEFAULT_MESSAGES[code];
    super(detail ? `${base} (${detail})` : base);
    this.name = 'ModelImportError';
    this.code = code;
    this.detail = detail;
    this.fileName = fileName;
  }
}

/** Marca un error con el archivo que lo produjo, convirtiendo errores genéricos en `corrupt`. */
export function attachFileName(error: unknown, fileName: string): ModelImportError {
  if (error instanceof ModelImportError) {
    if (!error.fileName) error.fileName = fileName;
    return error;
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new ModelImportError('corrupt', detail, fileName);
}

/** Lanza `too-large`/`empty` según el tamaño de un buffer de entrada. */
export function checkInputSize(byteLength: number, limits: ModelImportLimits): void {
  if (byteLength === 0) throw new ModelImportError('empty');
  if (byteLength > limits.maxFileBytes) throw new ModelImportError('too-large');
}
