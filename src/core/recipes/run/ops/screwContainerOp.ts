/**
 * @file src/core/recipes/run/ops/screwContainerOp.ts
 * @description Paso `create_screw_container` de las recetas (cuerpo o tapa del recipiente con tapa roscada) y el
 * chequeo `screw_fit` que mide que la tapa enrosque en el cuerpo. El paso lee sus argumentos con el mismo validador
 * estricto del Command Bus y del MCP (`screwContainerSchema`). Las medidas resueltas de cada objeto quedan en un
 * `WeakMap` solo durante la ejecución (no se guardan en el proyecto); el chequeo exige que cuerpo y tapa vengan de
 * pasos `create_screw_container` con las mismas medidas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { screwContainerFit, type ScrewContainerOptions } from '../../../../engine/screwContainer';
import type { LanguageCode, SceneObject } from '../../../../types/kura';
import { readVec3 } from '../../../bus/commandValidation';
import { parseScrewContainer, parseScrewContainerPart, type ScrewContainerPart } from '../../../bus/screwContainerSchema';
import { createScrewContainerPart } from '../../../operations/screwContainerOperations';
import { RecipeError, joinPath } from '../../errors';
import { plainArgs } from '../args';
import type { RecipeScrewFitCheck } from '../types';
import type { WorkScene } from '../workScene';
import { guarded, positionFromUser, type OpRunner } from './opSupport';

const PARTS = new WeakMap<SceneObject, { part: ScrewContainerPart; spec: ScrewContainerOptions }>();

export const screwContainerOp: OpRunner = async (call) => {
  const raw = plainArgs(call.args, call.at);
  const part = await guarded(call, () => parseScrewContainerPart(raw));
  const options = await guarded(call, () => parseScrewContainer(raw));
  const position = await guarded(call, () => readVec3(raw, 'position'));
  const { object, spec } = await guarded(call, () =>
    createScrewContainerPart(call.ctx, options, part, { name: call.name, position: positionFromUser(position) }));
  PARTS.set(object, { part, spec });
  return [object];
};

/** Chequeo `screw_fit` (índice `k` en `checks`) sobre los objetos de la escena de trabajo. */
export async function screwFitCheck(scene: WorkScene, refs: readonly string[], k: number, lang: LanguageCode): Promise<RecipeScrewFitCheck> {
  const at = joinPath(joinPath('checks', k), 'refs');
  const info = refs.map((ref, j) => {
    const objects = scene.get(ref, joinPath(at, j));
    const found = objects.length === 1 ? PARTS.get(objects[0]) : undefined;
    if (!found || found.part !== (j === 0 ? 'body' : 'lid')) {
      throw new RecipeError('run.badArgs', joinPath(at, j), { detail: 'screw_fit: [create_screw_container body, create_screw_container lid]' });
    }
    return found;
  });
  if (JSON.stringify(info[0].spec) !== JSON.stringify(info[1].spec)) {
    throw new RecipeError('run.badArgs', at, { detail: 'screw_fit: body and lid must share the same measurements' });
  }
  // Cuatro posiciones: la vista previa del asistente se pausa sobre 1,5 s.
  const report = await guarded({ at, lang }, () => screwContainerFit(info[0].spec, { samples: 4 }));
  return {
    kind: 'screw_fit',
    ref: refs[1],
    onFail: 'warn',
    status: report.status,
    fits: report.fits,
    minClearanceMm: report.minClearanceMm,
    maxInterferenceMm3: report.maxInterferenceMm3,
  };
}
