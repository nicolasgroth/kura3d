/**
 * @file src/core/recipes/resolve/types.ts
 * @description Tipos de entrada y salida de `resolveRecipe`: respuestas del usuario, contexto (cama), parámetros
 * efectivos, mensajes de reglas y pasos con argumentos evaluados. Las marcas `$ref`, `$asset`, `$file`, `$object` y
 * `$deferred` nunca chocan con un argumento real (sus nombres no pueden empezar con `$`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ObjectRole } from '../../../types/kura';
import type { RecipeIssue } from '../errors';
import type { ExprValue } from '../expression/evaluate';
import type { RecipeLanguage } from '../limits';
import type { PatternLocals } from './pattern';

export type Vec3 = readonly [number, number, number];

/** Respuesta a un parámetro `object`: el objeto elegido y su caja envolvente (ejes del usuario, mm). */
export interface ObjectAnswer {
  readonly objectId: string;
  readonly box: { readonly min: Vec3; readonly max: Vec3 };
}

/** Respuesta a un parámetro `file`: tipo y tamaño. El contenido lo entrega el ejecutor, no la resolución. */
export interface FileAnswer {
  readonly kind: 'svg' | 'png' | 'jpg';
  readonly bytes: number;
  readonly name?: string;
}

export type AnswerValue = number | boolean | string | ObjectAnswer | FileAnswer;
export type Answers = Readonly<Record<string, AnswerValue>>;

export interface ResolveOptions {
  /** Id de un `preset` que rellena respuestas (las respuestas explícitas mandan). */
  readonly variant?: string;
  /** Cama activa en mm. Sin ella, `bed.*` queda diferido en los pasos y es error en el resto. */
  readonly bed?: { readonly w: number; readonly d: number; readonly h: number };
  readonly language?: RecipeLanguage;
}

/** Valor de un argumento ya resuelto. */
export type ResolvedArg =
  | number
  | boolean
  | string
  | ResolvedArg[]
  | { readonly $ref: string }
  | { readonly $asset: string }
  | { readonly $file: string }
  | { readonly $object: string }
  | { readonly $deferred: string; readonly path: string; readonly locals?: PatternLocals }
  | { [key: string]: ResolvedArg };

export interface ResolvedParam {
  readonly id: string;
  readonly type: string;
  /** Valor efectivo; `null` si un `file`/`object` opcional no se eligió. */
  readonly value: ExprValue | ObjectAnswer | FileAnswer | null;
  readonly visible: boolean;
  readonly enabled: boolean;
  /** De dónde salió el valor. */
  readonly source: 'answer' | 'variant' | 'default' | 'none';
  readonly min?: number;
  readonly max?: number;
}

export interface RuleMessage {
  readonly level: 'error' | 'warning' | 'info';
  readonly path: string;
  readonly text: string;
  readonly focus?: string;
  readonly params: Readonly<Record<string, ExprValue>>;
}

export interface ResolvedInstance {
  readonly locals?: PatternLocals;
  readonly args: Readonly<Record<string, ResolvedArg>>;
}

export interface ResolvedStep {
  readonly id: string;
  readonly op: string;
  readonly skipped: boolean;
  readonly pattern?: { readonly kind: string; readonly count: number };
  readonly instances: readonly ResolvedInstance[];
}

export interface ResolvedOutput {
  readonly ref: string;
  readonly name: string;
  readonly color?: string;
  readonly role?: ObjectRole;
}

export interface ResolveResult {
  /** `true` si no hay errores (de formato, de parámetros ni reglas `error`): los pasos están listos. */
  readonly ok: boolean;
  readonly errors: readonly RecipeIssue[];
  readonly messages: readonly RuleMessage[];
  readonly params: readonly ResolvedParam[];
  readonly derived: Readonly<Record<string, ExprValue>>;
  readonly steps: readonly ResolvedStep[];
  readonly outputs: readonly ResolvedOutput[];
  readonly checks: readonly { readonly kind: 'fits_bed' | 'screw_fit'; readonly refs: readonly string[]; readonly onFail: 'offer_split' | 'warn' }[];
  /** Trabajo hecho (nodos barridos + nodos compilados + evaluados): crece linealmente con la receta. */
  readonly work: number;
}
