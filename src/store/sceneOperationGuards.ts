/**
 * @file src/store/sceneOperationGuards.ts
 * @description Guardas de las operaciones asíncronas del store: detecta si los objetos de entrada
 * cambiaron mientras se calculaba (para no escribir un resultado sobre un estado viejo) y clasifica
 * una resta booleana sin volumen por geometría, sin depender del texto del error del motor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../engine';
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

/** Tolerancia relativa para decidir que el hueco contiene por completo al sólido. */
const CONTAINMENT_TOLERANCE = 1e-3;

function worldVolume(obj: SceneObject): number {
  const [sx, sy, sz] = obj.scale;
  return Math.abs(obj.stats.volumeMm3 * sx * sy * sz);
}

/**
 * Resta `hole` de `solid`. Devuelve `null` cuando el resultado no tiene volumen porque el hueco
 * contiene al sólido; esa condición se verifica intersecando ambos y comparando volúmenes. Cualquier
 * otro fallo del motor se propaga sin cambios.
 */
export async function subtractOrEmpty(
  solid: SceneObject,
  hole: SceneObject,
): Promise<{ mesh: MeshData; position: Vec3 } | null> {
  try {
    return await engine.runBooleanOperation(solid, hole, 'subtract');
  } catch (subtractError) {
    let insideVolume: number;
    try {
      const inside = await engine.runBooleanOperation(solid, hole, 'intersect');
      insideVolume = engine.computeMeshStats(inside.mesh).volumeMm3;
    } catch {
      throw subtractError;
    }
    const solidVolume = worldVolume(solid);
    if (solidVolume > 0 && insideVolume >= solidVolume * (1 - CONTAINMENT_TOLERANCE)) return null;
    throw subtractError;
  }
}
