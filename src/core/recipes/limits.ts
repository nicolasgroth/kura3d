/**
 * @file src/core/recipes/limits.ts
 * @description Topes del formato de recetas `kura.recipe/1` (tamaños, cantidades y presupuesto de expresiones).
 * Fuente única para el esquema, el intérprete y la documentación de terceros (`docs/recetas/FORMATO.md`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

const MIB = 1024 * 1024;

export const RECIPE_FORMAT = 'kura.recipe/1';

/** Idiomas de los textos de una receta (los mismos 6 de la interfaz). `es` y `en` son obligatorios. */
export const RECIPE_LANGUAGES = ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const;
export type RecipeLanguage = (typeof RECIPE_LANGUAGES)[number];

/** Licencias que acepta una receta (misma política de dependencias del proyecto: solo permisivas). */
export const RECIPE_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0'] as const;

export const RECIPE_LIMITS = {
  /** Texto JSON de la receta sin contar los datos de los recursos embebidos. */
  maxTextBytes: 256 * 1024,
  /** Profundidad máxima del JSON (objetos/listas anidados). */
  maxJsonDepth: 24,
  /** Cantidad máxima de valores en el JSON (nodos), como freno lineal antes del esquema. */
  maxJsonNodes: 50_000,
  maxIdLength: 64,
  maxShortText: 200,
  maxTags: 16,
  maxParams: 64,
  maxOptions: 64,
  maxRules: 64,
  maxDerive: 64,
  maxPresets: 64,
  maxSteps: 128,
  maxOutputs: 16,
  maxChecks: 16,
  maxTables: 16,
  maxTableRows: 256,
  maxStringsPerLanguage: 512,
  maxArgsKeys: 32,
  maxArgsDepth: 6,
  maxListItems: 64,
  maxTextParamLength: 200,
  /** Instancias de un `pattern`: cada patrón declara `max` ≤ este valor. */
  maxPatternInstances: 256,
  /** Instancias sumadas de todos los patrones de una receta. */
  maxTotalInstances: 1024,
  maxPatternPoints: 64,
  /** Recursos embebidos (imágenes, SVG, modelos). */
  maxAssets: 16,
  maxAssetsTotalBytes: 16 * MIB,
  /** Bytes de un archivo pedido al usuario (`file`): no más que el recurso del mismo tipo. */
  maxFileParamBytes: 16 * MIB,
} as const;

/**
 * Tope por tipo de recurso embebido, en bytes ya decodificados. Igual al del importador correspondiente, recortado a
 * `maxAssetsTotalBytes` (una receta viaja dentro del `.kura` y no debe pesar como un STL de 256 MiB). El SVG usa el
 * mismo tope de `import_svg` (`SVG_MAX` en `commandSchemas.ts`).
 */
export const RECIPE_ASSET_MAX_BYTES = {
  svg: 5_000_000,
  png: 16 * MIB,
  jpg: 16 * MIB,
  stl: 16 * MIB,
  '3mf': 16 * MIB,
  obj: 16 * MIB,
} as const;
export type RecipeAssetKind = keyof typeof RECIPE_ASSET_MAX_BYTES;

/** Presupuesto del lenguaje de expresiones. Todo exceso es un error tipado. */
export const EXPRESSION_LIMITS = {
  /** Caracteres de una expresión, incluido el `=` inicial. */
  maxLength: 512,
  /** Nodos del AST de una expresión. */
  maxNodes: 256,
  /** Profundidad del AST de una expresión. */
  maxDepth: 24,
  /** Nodos evaluados en total por resolución de una receta (contador compartido que aborta). */
  maxEvaluations: 50_000,
  /** Largo de un texto resultado de una expresión. */
  maxStringLength: 200,
} as const;
