/**
 * @file src/core/recipes/scan.ts
 * @description Barrido previo y lineal de una receta (o de las respuestas) antes del esquema: tamaño, profundidad,
 * cantidad de nodos, claves prohibidas (`__proto__`, `constructor`, `prototype`), caracteres de control o de
 * dirección en textos, números no finitos y valores que no son JSON. Iterativo (sin recursión) y con contador de
 * trabajo para probar que el costo crece de forma lineal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { RecipeError, joinPath } from './errors';
import { RECIPE_LIMITS } from './limits';
import { isForbiddenKey } from './names';

/**
 * Controles C0/C1 (salvo salto de línea y tabulación), DEL y marcas de dirección (U+202A–U+202E, U+2066–U+2069)
 * que permiten disfrazar un texto. Los textos de una receta se muestran como texto plano.
 */
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F‪-‮⁦-⁩]/;

export function hasUnsafeChars(text: string): boolean {
  return UNSAFE_CHARS.test(text);
}

export interface ScanOptions {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  /** Caracteres de texto (claves + valores) permitidos, sin contar `assets[*].data`. */
  readonly maxChars?: number;
}

export interface ScanStats {
  nodes: number;
  chars: number;
  /** Caracteres de `assets[*].data` (base64), que se miden aparte. */
  assetChars: number;
}

interface Frame {
  readonly value: unknown;
  readonly path: string;
  readonly depth: number;
  readonly assetData: boolean;
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Lanza `RecipeError` ante el primer problema. Devuelve el trabajo hecho (nodos visitados y caracteres). */
export function scanJson(root: unknown, options: ScanOptions = {}): ScanStats {
  const maxDepth = options.maxDepth ?? RECIPE_LIMITS.maxJsonDepth;
  const maxNodes = options.maxNodes ?? RECIPE_LIMITS.maxJsonNodes;
  const maxChars = options.maxChars ?? RECIPE_LIMITS.maxTextBytes;
  const stats: ScanStats = { nodes: 0, chars: 0, assetChars: 0 };
  const stack: Frame[] = [{ value: root, path: '', depth: 0, assetData: false }];
  while (stack.length > 0) {
    const { value, path, depth, assetData } = stack.pop() as Frame;
    stats.nodes += 1;
    if (stats.nodes > maxNodes) throw new RecipeError('format.nodes', path, { max: maxNodes });
    if (depth > maxDepth) throw new RecipeError('format.depth', path, { max: maxDepth });
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new RecipeError('format.notFinite', path);
      stats.chars += 8;
      continue;
    }
    if (typeof value === 'string') {
      if (assetData) {
        stats.assetChars += value.length;
        continue;
      }
      stats.chars += value.length;
      if (hasUnsafeChars(value)) throw new RecipeError('format.controlChar', path);
      if (stats.chars > maxChars) throw new RecipeError('format.tooLarge', path, { max: maxChars });
      continue;
    }
    if (typeof value !== 'object') throw new RecipeError('format.json', path, { detail: typeof value });
    if (Array.isArray(value)) {
      for (let k = value.length - 1; k >= 0; k--) stack.push({ value: value[k], path: joinPath(path, k), depth: depth + 1, assetData: false });
      continue;
    }
    if (!isPlainObject(value)) throw new RecipeError('format.json', path, { detail: 'object' });
    // Claves propias, incluidas las no enumerables: `JSON.parse` crea `__proto__` como propiedad propia.
    const keys = Reflect.ownKeys(value);
    const inAssets = /^assets\[\d+\]$/.test(path);
    for (let k = keys.length - 1; k >= 0; k--) {
      const key = keys[k];
      if (typeof key !== 'string') throw new RecipeError('format.json', path, { detail: 'symbol' });
      const childPath = joinPath(path, key);
      if (isForbiddenKey(key)) throw new RecipeError('format.forbiddenKey', childPath, { detail: key });
      if (hasUnsafeChars(key)) throw new RecipeError('format.controlChar', childPath);
      stats.chars += key.length;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) throw new RecipeError('format.json', childPath, { detail: 'accessor' });
      stack.push({ value: descriptor.value, path: childPath, depth: depth + 1, assetData: inAssets && key === 'data' });
    }
    if (stats.nodes + stack.length > maxNodes) throw new RecipeError('format.nodes', path, { max: maxNodes });
  }
  if (stats.chars > maxChars) throw new RecipeError('format.tooLarge', '', { max: maxChars });
  return stats;
}
