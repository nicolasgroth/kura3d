/**
 * @file src/core/recipes/run/ops/opSupport.ts
 * @description Apoyo común de las operaciones de receta: contrato `OpCall` → objetos nuevos, traducción de los
 * errores del bus y del motor a errores de receta, conversión de ejes del usuario (Z arriba, giros en grados) y
 * copias derivadas con id nuevo. Ninguna operación modifica un objeto existente: siempre devuelve copias.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { isEngineError, type EngineWarning } from '../../../../engine/engineErrors';
import { t, type TranslationKey } from '../../../../i18n';
import { CommandError } from '../../../bus/commandErrors';
import type { LanguageCode, PrinterProfile, SceneObject, Vec3 } from '../../../../types/kura';
import { statsFor, type OperationContext, type SceneChange } from '../../../operations/operationTypes';
import { fromUserRotation, fromUserScale, fromUserVector } from '../../../scene/displayAxes';
import { copySceneObject } from '../../../scene/sceneObjects';
import { RecipeError } from '../../errors';
import type { RunArg } from '../args';

export interface OpCall {
  readonly ctx: OperationContext;
  readonly args: Readonly<Record<string, RunArg>>;
  /** Ruta de los argumentos de la instancia (`steps[3].args`). */
  readonly at: string;
  /** Nombre de los objetos intermedios (id del paso). */
  readonly name: string;
  readonly lang: LanguageCode;
  /** Cama para `align_objects` (perfil activo o la cama de la resolución). */
  readonly profile: PrinterProfile;
  /** Avisos del motor que se juntan en el `SceneChange` final. */
  readonly warnings: EngineWarning[];
}

export type OpRunner = (call: OpCall) => Promise<readonly SceneObject[]>;

/**
 * Corre un validador del bus o una operación del motor y traduce sus errores: `CommandError` → `run.badArgs`,
 * `EngineError` → `run.engine` (código del motor en `detail`). Los `RecipeError` pasan tal cual.
 */
export async function guarded<T>(call: Pick<OpCall, 'at' | 'lang'>, fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof RecipeError) throw error;
    if (error instanceof CommandError) {
      throw new RecipeError('run.badArgs', call.at, { detail: t(call.lang, error.key, error.params), bus: error.code });
    }
    if (isEngineError(error)) {
      // Los valores del motor (`chars`…) viajan también, para que `onError.message` de la receta los nombre.
      const extra = Object.fromEntries(Object.entries(error.params ?? {}).filter(([k, v]) => !['path', 'detail', 'engine'].includes(k) && (typeof v === 'string' || typeof v === 'number')));
      throw new RecipeError('run.engine', call.at, { ...extra, detail: t(call.lang, `engineError.${error.code}` as TranslationKey, error.params), engine: error.code });
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new RecipeError('run.engine', call.at, { detail: message.slice(0, 200) });
  }
}

const DEG = Math.PI / 180;

/** Posición del usuario (mm) → interna; sin valor, el origen. */
export const positionFromUser = (v: Vec3 | undefined): Vec3 => fromUserVector(v ?? [0, 0, 0]);
/** Giro del usuario en GRADOS (Euler XYZ, como las funciones trigonométricas de las expresiones) → interno. */
export const rotationFromUserDeg = (v: Vec3 | undefined): Vec3 | undefined =>
  v ? fromUserRotation([v[0] * DEG, v[1] * DEG, v[2] * DEG]) : undefined;
export const scaleFromUserAxes = (v: Vec3 | undefined): Vec3 | undefined => (v ? fromUserScale(v) : undefined);

/** Copia con id nuevo, cambios aplicados y estadísticas recalculadas según la política del adaptador. */
export function derivedCopy(ctx: OperationContext, obj: SceneObject, patch: Partial<SceneObject> = {}): SceneObject {
  const next = copySceneObject(obj, { ...patch, id: ctx.newId() });
  return { ...next, stats: statsFor(ctx, next) };
}

/** Aplica los parches de un `SceneChange` de un objeto como copia nueva (la original queda intacta). */
export function patchedCopy(ctx: OperationContext, obj: SceneObject, change: SceneChange, warnings: EngineWarning[]): SceneObject {
  warnings.push(...change.warnings);
  const patch = change.patches.filter((p) => p.id === obj.id).reduce<Partial<SceneObject>>((acc, p) => ({ ...acc, ...p.patch }), {});
  return derivedCopy(ctx, obj, patch);
}

/** Vista mínima de escena para los validadores del bus (solo los objetos del paso, sin selección). */
export const viewOf = (objects: readonly SceneObject[]) => ({ objects: [...objects], selectedIds: [] as string[] });
