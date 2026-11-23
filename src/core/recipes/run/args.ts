/**
 * @file src/core/recipes/run/args.ts
 * @description Convierte los argumentos resueltos de un paso en valores ejecutables: `$ref` → lista de objetos de
 * la escena de trabajo (las listas se aplanan), `$deferred` → valor evaluado con las cajas `s.<paso>` y el MISMO
 * presupuesto de expresiones de la resolución, `$asset` / `$file` → contenido (texto SVG) decodificado y acotado,
 * `$object` → copia del objeto de la escena del usuario (solo lectura).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../../../types/kura';
import { RecipeError, joinPath } from '../errors';
import { evaluateExpression, type ExprValue } from '../expression/evaluate';
import type { RecipeEnv } from '../resolve/env';
import type { ResolvedArg } from '../resolve/types';
import type { WorkScene } from './workScene';

/** Resultado de uno o varios pasos: siempre una lista (un paso saltado vale lista vacía). */
export class ObjectList {
  constructor(readonly objects: readonly SceneObject[]) {}
}

export type RunArg = ExprValue | ObjectList | RunArg[] | { [key: string]: RunArg };

export interface ArgSources {
  readonly scene: WorkScene;
  readonly env: RecipeEnv;
  /** Texto de un recurso embebido `$asset:id`. */
  asset(id: string, at: string): string;
  /** Texto del archivo elegido para el parámetro `file`. */
  file(paramId: string, at: string): string;
  /** Objeto de la escena del usuario elegido para el parámetro `object`. */
  object(paramId: string, at: string): SceneObject;
}

const AXIS = { x: 0, y: 1, z: 2 } as const;

/** Evalúa un `$deferred`: `s.<paso>.<min|max|size|center>.<x|y|z>` lee la caja del paso ya ejecutado. */
function evaluateDeferred(src: ArgSources, deferred: Extract<ResolvedArg, { $deferred: string }>, at: string): ExprValue {
  const compiled = src.env.exprs.get(deferred.path);
  if (!compiled) throw new RecipeError('expr.syntax', at, { detail: 'not compiled' });
  const base = src.env.env(deferred.locals);
  return evaluateExpression(compiled, {
    ...base,
    read: (path, readAt) => {
      if (path[0] !== 's') return base.read(path, readAt);
      const [, step, field, axis] = path;
      const box = src.scene.box(step, readAt);
      const k = AXIS[axis as keyof typeof AXIS];
      if (k === undefined) throw new RecipeError('ref.badPath', readAt, { detail: path.join('.') });
      if (field === 'min') return box.min[k];
      if (field === 'max') return box.max[k];
      if (field === 'size') return box.max[k] - box.min[k];
      if (field === 'center') return (box.min[k] + box.max[k]) / 2;
      throw new RecipeError('ref.badPath', readAt, { detail: path.join('.') });
    },
  }, deferred.path);
}

function isMarker(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function materialize(src: ArgSources, value: ResolvedArg, at: string): RunArg {
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) {
    const items = value.map((item, k) => materialize(src, item, joinPath(at, k)));
    // Una lista de referencias es una sola lista de objetos (`tools: ["@a", "@b"]`).
    if (items.length > 0 && items.every((item) => item instanceof ObjectList)) {
      return new ObjectList(items.flatMap((item) => (item as ObjectList).objects));
    }
    return items;
  }
  if (isMarker(value, '$ref')) return new ObjectList(src.scene.get((value as { $ref: string }).$ref, at));
  if (isMarker(value, '$deferred')) return evaluateDeferred(src, value as Extract<ResolvedArg, { $deferred: string }>, at);
  if (isMarker(value, '$asset')) return src.asset((value as { $asset: string }).$asset, at);
  if (isMarker(value, '$file')) return src.file((value as { $file: string }).$file, at);
  if (isMarker(value, '$object')) return new ObjectList([src.object((value as { $object: string }).$object, at)]);
  const out: Record<string, RunArg> = {};
  for (const [key, item] of Object.entries(value)) out[key] = materialize(src, item as ResolvedArg, joinPath(at, key));
  return out;
}

/** Argumentos para un validador del bus: sin listas de objetos (esas se pasan como ids aparte). */
export function plainArgs(args: Readonly<Record<string, RunArg>>, at: string): Record<string, unknown> {
  const strip = (value: RunArg, path: string): unknown => {
    if (value instanceof ObjectList) throw new RecipeError('run.badArgs', path, { detail: 'unexpected object reference' });
    if (Array.isArray(value)) return value.map((item, k) => strip(item, joinPath(path, k)));
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(Object.entries(value).map(([k, item]) => [k, strip(item, joinPath(path, k))]));
    }
    return value;
  };
  return strip(args as RunArg, at) as Record<string, unknown>;
}

/** Lista de objetos de un argumento (`undefined` = lista vacía). */
export function objectsOf(value: RunArg | undefined, at: string): readonly SceneObject[] {
  if (value === undefined) return [];
  if (value instanceof ObjectList) return value.objects;
  if (Array.isArray(value) && value.length === 0) return [];
  throw new RecipeError('run.badArgs', at, { detail: 'expected @step references' });
}

/** Exactamente un objeto (objetivo de una booleana, de colocar, de reflejar…). */
export function oneObject(value: RunArg | undefined, at: string): SceneObject {
  const objects = objectsOf(value, at);
  if (objects.length !== 1) throw new RecipeError('run.refArity', at, { expected: 1, count: objects.length });
  return objects[0];
}
