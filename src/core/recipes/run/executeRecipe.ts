/**
 * @file src/core/recipes/run/executeRecipe.ts
 * @description Ejecutor de recetas: corre los pasos resueltos sobre una escena de trabajo aislada con las
 * operaciones puras del motor (tabla `RECIPE_OP_TABLE`), aplica los topes duros y la cancelación cooperativa, y
 * entrega solo las salidas (con rol, nombre, color y `metadata.recipe`) como un `SceneChange` de objetos nuevos.
 * Es función pura respecto de la escena del usuario: ante cualquier error devuelve `ok: false` y ningún cambio.
 * Corre igual en el Worker del motor (tarea `runRecipe`), en el MCP sin interfaz y en pruebas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { EngineWarning } from '../../../engine/engineErrors';
import { DEFAULT_PRINTER_PROFILES, type LanguageCode, type PrinterProfile, type SceneObject } from '../../../types/kura';
import { change, type OperationContext } from '../../operations/operationTypes';
import { RecipeError, joinPath, type RecipeIssue } from '../errors';
import { prepareRecipe, type PreparedRecipe } from '../resolve/resolveRecipe';
import type { ResolveOptions } from '../resolve/types';
import { materialize, type ArgSources, type RunArg } from './args';
import { effectiveRunLimits } from './limits';
import { opSpec } from './opTable';
import { derivedCopy, guarded } from './ops/opSupport';
import { provenanceFor, recipeHash, storedAnswers } from './provenance';
import { assetSvgText, fileSvgText } from './resources';
import { stepInputFailure } from './stepFailure';
import type { RecipeCheckWarning, RecipeRunResult, RunInput } from './types';
import { WorkScene } from './workScene';

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Cama para `align_objects` y `fits_bed`: la de la resolución o el primer perfil. */
function profileFor(options: ResolveOptions | undefined): PrinterProfile {
  const base = DEFAULT_PRINTER_PROFILES[0];
  const bed = options?.bed;
  return bed ? { ...base, bedWidthMm: bed.w, bedDepthMm: bed.d, maxHeightMm: bed.h } : { ...base };
}

function failure(prepared: PreparedRecipe, errors: readonly RecipeIssue[]): RecipeRunResult {
  return { ok: false, errors, messages: prepared.result.messages, params: prepared.result.params };
}

/** Valida y resuelve la receta, y la ejecuta. Nunca lanza por datos de la receta ni de las respuestas. */
export async function runRecipe(ctx: OperationContext, input: RunInput): Promise<RecipeRunResult> {
  return executeRecipe(ctx, prepareRecipe(input.recipe, input.answers ?? {}, input.options), input);
}

export async function executeRecipe(ctx: OperationContext, prepared: PreparedRecipe, input: Omit<RunInput, 'recipe'>): Promise<RecipeRunResult> {
  const { result, env, recipe: validated } = prepared;
  if (!result.ok) return failure(prepared, result.errors);
  if (!env || !validated) return failure(prepared, [new RecipeError('run.notReady', '').issue]);
  const recipe = validated.recipe;
  const lang: LanguageCode = input.options?.language ?? 'es';
  const scene = new WorkScene(effectiveRunLimits(input.limits), input.now ?? defaultNow, input.signal);
  const warnings: EngineWarning[] = [];
  const profile = profileFor(input.options);
  const sources: ArgSources = {
    scene,
    env,
    asset: (id, at) => assetSvgText(recipe, id, at),
    file: (id, at) => fileSvgText(recipe, result.params, input.files, id, at),
    object: (id, at) => {
      const answer = result.params.find((p) => p.id === id)?.value as { objectId?: string } | null | undefined;
      const obj = input.sceneObjects?.find((o) => o.id === answer?.objectId);
      if (!obj) throw new RecipeError('param.required', at, { detail: id });
      // Copia: el objeto del usuario nunca entra a una operación (que podría consumirlo).
      return derivedCopy(ctx, obj, { role: 'solid', locked: false, groupRef: undefined });
    },
  };
  let instances = 0;
  let current = -1;
  try {
    for (let k = 0; k < result.steps.length; k++) {
      current = k;
      const step = result.steps[k];
      const base = joinPath('steps', k);
      scene.checkTime(base);
      if (step.skipped) {
        scene.record(step.id, []);
        continue;
      }
      const spec = opSpec(step.op);
      if (!spec) throw new RecipeError('run.unknownOp', joinPath(base, 'op'), { detail: String(step.op).slice(0, 64) });
      const produced: SceneObject[] = [];
      for (let i = 0; i < step.instances.length; i++) {
        const at = joinPath(base, 'args');
        const unknown = Object.keys(step.instances[i].args).find((key) => !spec.args.includes(key));
        if (unknown !== undefined) throw new RecipeError('run.badArgs', joinPath(at, unknown), { detail: `${step.op}: ${spec.args.join(', ')}` });
        const args = materialize(sources, step.instances[i].args as never, at) as Record<string, RunArg>;
        scene.checkTime(at);
        const name = step.instances.length > 1 ? `${step.id} ${i + 1}` : step.id;
        const objects = await guarded({ at, lang }, () => spec.run({ ctx, args, at, name, lang, profile, warnings }));
        for (const obj of objects) scene.charge(obj, at);
        produced.push(...objects);
        instances += 1;
        scene.checkTime(at);
      }
      scene.record(step.id, produced);
    }
    return await finish(ctx, prepared, input, scene, warnings, profile, instances);
  } catch (error) {
    // Un rechazo del motor en un paso con `onError` va junto al campo del usuario, no como error técnico.
    const input = current >= 0 ? stepInputFailure(recipe, result.steps[current].id, current, error, lang) : null;
    if (input) return { ok: false, errors: [input.issue], messages: [...result.messages, input.message], params: result.params };
    if (error instanceof RecipeError) return failure(prepared, [error.issue]);
    throw error;
  }
}

async function finish(
  ctx: OperationContext,
  prepared: PreparedRecipe,
  input: Omit<RunInput, 'recipe'>,
  scene: WorkScene,
  warnings: EngineWarning[],
  profile: PrinterProfile,
  instances: number,
): Promise<RecipeRunResult> {
  const { result } = prepared;
  const recipe = prepared.recipe!.recipe;
  const hash = await recipeHash(recipe);
  const stored = storedAnswers(input.answers);
  const added: SceneObject[] = [];
  const outputs: { ref: string; objectIds: string[] }[] = [];
  result.outputs.forEach((output, k) => {
    const at = joinPath(joinPath('outputs', k), 'ref');
    const objects = scene.get(output.ref, at);
    if (objects.length === 0) throw new RecipeError('run.emptyOutput', at, { detail: output.ref });
    // Un nombre calculado vacío (llavero sin texto) cae en el id del paso.
    const base = output.name.trim() || output.ref;
    const ids: string[] = [];
    objects.forEach((obj, i) => {
      const final = derivedCopy(ctx, obj, {
        name: objects.length > 1 ? `${base} ${i + 1}` : base,
        color: output.color ?? obj.color,
        role: output.role ?? 'solid',
        metadata: { recipe: provenanceFor(recipe, hash, stored, output.ref, input.options?.variant) },
      });
      scene.charge(final, at);
      added.push(final);
      ids.push(final.id);
    });
    outputs.push({ ref: output.ref, objectIds: ids });
  });
  const checks: RecipeCheckWarning[] = [];
  const bed: [number, number, number] = [profile.bedWidthMm, profile.bedDepthMm, profile.maxHeightMm];
  // Sin cama en las opciones no hay contra qué medir: el chequeo se omite (la interfaz y el MCP siempre la pasan).
  for (const check of input.options?.bed ? result.checks : []) {
    for (const ref of check.refs) {
      const box = scene.box(ref, 'checks');
      const size: [number, number, number] = [0, 1, 2].map((k) => box.max[k] - box.min[k]) as [number, number, number];
      if (size.some((v, k) => v > bed[k] + 1e-6)) checks.push({ kind: 'fits_bed', ref, onFail: check.onFail, size, bed });
    }
  }
  return {
    ok: true,
    change: change({ added, warnings }),
    outputs,
    checks,
    messages: result.messages,
    params: result.params,
    stats: {
      steps: result.steps.length, instances, objects: scene.objects, triangles: scene.triangles, ms: Math.round(scene.elapsed()),
      produced: Object.fromEntries(result.steps.map((s) => [s.id, scene.get(s.id, 'steps').length])),
    },
  };
}
