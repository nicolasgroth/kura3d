/**
 * @file src/core/recipes/run/types.ts
 * @description Tipos del ejecutor de recetas: entrada (receta, respuestas, archivos, objetos de solo lectura,
 * topes y cancelación) y resultado (un `SceneChange` con solo objetos nuevos, listo para un paso de deshacer, o la
 * lista de errores tipados sin ningún cambio).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject } from '../../../types/kura';
import type { SceneChange } from '../../operations/operationTypes';
import type { RecipeIssue } from '../errors';
import type { ResolveOptions, ResolvedParam, RuleMessage } from '../resolve/types';
import type { RunLimits } from './limits';

export interface RunInput {
  /** Receta (`kura.recipe/1`) tal como llega: objeto JSON o texto. */
  readonly recipe: unknown;
  readonly answers?: unknown;
  readonly options?: ResolveOptions;
  /** Contenido de los parámetros `file` respondidos (texto o bytes), por id de parámetro. */
  readonly files?: Readonly<Record<string, string | Uint8Array>>;
  /** Objetos de la escena del usuario elegidos en parámetros `object`: se leen y se copian, nunca se modifican. */
  readonly sceneObjects?: readonly SceneObject[];
  /** Topes más bajos que los duros (nunca más altos). */
  readonly limits?: Partial<RunLimits>;
  /** Cancelación cooperativa (no viaja al Worker: allí se cancela terminando la tarea). */
  readonly signal?: AbortSignal;
  /** Reloj en ms (pruebas). */
  readonly now?: () => number;
}

/** Aviso de un chequeo de la receta (`checks`). */
export interface RecipeCheckWarning {
  readonly kind: 'fits_bed';
  readonly ref: string;
  readonly onFail: 'offer_split' | 'warn';
  /** Medidas de la salida en ejes del usuario (mm) y de la cama. */
  readonly size: readonly [number, number, number];
  readonly bed: readonly [number, number, number];
}

export interface RecipeRunStats {
  readonly steps: number;
  readonly instances: number;
  readonly objects: number;
  readonly triangles: number;
  readonly ms: number;
  /** Objetos que produjo cada paso (un paso saltado vale 0). */
  readonly produced: Readonly<Record<string, number>>;
}

export interface RecipeRunSuccess {
  readonly ok: true;
  /** Solo `added` (las salidas): se inserta como UN paso de deshacer (`commitChange`). */
  readonly change: SceneChange;
  readonly outputs: ReadonlyArray<{ readonly ref: string; readonly objectIds: readonly string[] }>;
  readonly checks: readonly RecipeCheckWarning[];
  readonly messages: readonly RuleMessage[];
  readonly params: readonly ResolvedParam[];
  readonly stats: RecipeRunStats;
}

export interface RecipeRunFailure {
  readonly ok: false;
  readonly errors: readonly RecipeIssue[];
  readonly messages: readonly RuleMessage[];
  readonly params: readonly ResolvedParam[];
}

export type RecipeRunResult = RecipeRunSuccess | RecipeRunFailure;
