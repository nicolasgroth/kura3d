/**
 * @file src/store/measureCommands.ts
 * @description Comandos de solo lectura de medición del Command Bus: `measure_distance` (dos puntos),
 * `measure_object` (área total, volumen y caja) y `measure_capacity` (capacidad como recipiente en la
 * orientación actual, en el Worker del motor). Ejes del usuario de entrada y salida; las respuestas
 * salen de `core/operations/measureOperations`, igual que en el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { getEngineClient } from '../core/operations/engineClient';
import { capacityToUser, MEASURE_LIMITS, measureDistanceUser, measureObjectUser } from '../core/operations/measureOperations';
import { createKeyedNaming } from '../core/scene/resultNames';
import { APP_BUILD_POLICY, makeId } from '../core/scene/sceneObjects';
import type { Vec3 } from '../types/kura';
import { CommandError } from './commandErrors';
import { resolveTarget } from './commandTargets';
import { OPERATION_RANGES as OR } from '../engine/operationLimits';
import { readRange, readVec3, type RawParams } from './commandValidation';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

function requiredPoint(p: RawParams, key: string, alias: string): Vec3 {
  const v = readVec3(p, key, alias);
  if (!v) throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: key, expected: '[x, y, z] in mm (user axes)' });
  if (v.some((c) => Math.abs(c) > MEASURE_LIMITS.coordMm)) {
    throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: key, expected: `|coordinate| ≤ ${MEASURE_LIMITS.coordMm}` });
  }
  return v;
}

/** Lee los parámetros de `measure_capacity` (compartido con las pruebas de paridad). */
export function parseMeasureCapacity(p: RawParams) {
  return {
    levelHeightMm: readRange(p, OR.measure.levelMm, 'levelMm', 'levelHeightMm'),
    basinIndex: readRange(p, OR.measure.cavityIndex, 'cavityIndex'),
  };
}

const ctx = () => ({
  policy: APP_BUILD_POLICY,
  newId: () => makeId('mesh'),
  naming: createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id }),
});

export const MEASURE_HANDLERS = {
  measure_distance: (p: RawParams) => measureDistanceUser(requiredPoint(p, 'pointA', 'a'), requiredPoint(p, 'pointB', 'b')),

  measure_object: (p: RawParams, { get }: Deps) => measureObjectUser(resolveTarget(get(), p)),

  measure_capacity: async (p: RawParams, { get }: Deps) => {
    const target = resolveTarget(get(), p);
    const options = parseMeasureCapacity(p);
    const result = await getEngineClient().run(ctx(), 'capacity', {
      obj: { mesh: target.mesh, position: target.position, rotation: target.rotation, scale: target.scale },
      options,
    }).promise;
    return capacityToUser(target, result);
  },
};
