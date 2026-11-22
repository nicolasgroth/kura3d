/**
 * @file src/store/sceneOperationGuards.ts
 * @description Guardas de las operaciones asíncronas del store: detecta si los objetos de entrada
 * cambiaron mientras se calculaba (para no escribir un resultado sobre un estado viejo) y clasifica
 * una resta booleana sin volumen por el código tipado del motor (`BOOLEAN_EMPTY_RESULT`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../engine';
import { isEngineError } from '../engine/engineErrors';
import type { TranslationKey } from '../i18n';
import type { MeshData, SceneObject, Vec3 } from '../types/kura';
import { StoreOperationError } from './commandErrors';

type Translate = (key: TranslationKey) => string;

/**
 * Lanza `StoreOperationError('stale-input')` si algún objeto de entrada ya no existe o cambió su
 * geometría o transformación (comparación por referencia, que el store reemplaza en cada edición).
 * Cambios de metadatos (nombre, color) no invalidan el cálculo.
 */
export function assertInputsCurrent(current: SceneObject[], inputs: SceneObject[], tr: Translate): void {
  const byId = new Map(current.map((o) => [o.id, o]));
  for (const input of inputs) {
    const now = byId.get(input.id);
    const unchanged =
      now !== undefined &&
      now.mesh === input.mesh &&
      now.position === input.position &&
      now.rotation === input.rotation &&
      now.scale === input.scale;
    if (!unchanged) throw new StoreOperationError('stale-input', tr('store.error.staleInput'));
  }
}

/**
 * Transformación neutra para objetos cuya malla el motor ya devolvió en espacio mundial
 * (normalizada a cama con su `position`). Conservar la rotación o escala previas las aplicaría
 * dos veces.
 */
export function worldBaked(): { rotation: Vec3; scale: Vec3 } {
  return { rotation: [0, 0, 0], scale: [1, 1, 1] };
}

/**
 * Resta `hole` de `solid`. Devuelve `null` cuando el motor informa una resta sin volumen
 * (`EngineError` con código `BOOLEAN_EMPTY_RESULT`: el hueco contiene al sólido). Cualquier otro
 * fallo del motor se propaga sin cambios.
 */
export async function subtractOrEmpty(
  solid: SceneObject,
  hole: SceneObject,
): Promise<{ mesh: MeshData; position: Vec3 } | null> {
  try {
    return await engine.runBooleanOperation(solid, hole, 'subtract');
  } catch (err) {
    if (isEngineError(err) && err.code === 'BOOLEAN_EMPTY_RESULT') return null;
    throw err;
  }
}
