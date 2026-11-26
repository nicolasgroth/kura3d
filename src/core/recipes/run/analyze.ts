/**
 * @file src/core/recipes/run/analyze.ts
 * @description Análisis de una receta sin ejecutar geometría (`dryRun`): valida, resuelve y devuelve los
 * parámetros efectivos, las reglas, los pasos con el comando del bus que los ejecuta y una estimación de cuántos
 * objetos va a crear, para que la interfaz o un agente decidan antes de aplicar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t, type TranslationKey } from '../../../i18n';
import type { LanguageCode } from '../../../types/kura';
import type { RecipeIssue } from '../errors';
import { resolveRecipe } from '../resolve/resolveRecipe';
import type { ResolveOptions } from '../resolve/types';
import { RECIPE_RUN_LIMITS } from './limits';
import { opSpec } from './opTable';

/** Problema con su mensaje en el idioma pedido (para respuestas del bus y del MCP). */
export function localizeIssues(issues: readonly RecipeIssue[], lang: LanguageCode) {
  return issues.map((i) => ({ code: i.code, path: i.path, message: t(lang, i.key as TranslationKey, i.params) }));
}

export function analyzeRecipe(recipe: unknown, answers: unknown, options: ResolveOptions = {}) {
  const lang = options.language ?? 'es';
  const result = resolveRecipe(recipe, answers ?? {}, options);
  const steps = result.steps.map((s) => ({
    id: s.id,
    op: s.op,
    command: opSpec(s.op)?.command ?? null,
    skipped: s.skipped,
    instances: s.instances.length,
    ...(s.pattern ? { pattern: s.pattern.kind } : {}),
  }));
  const created = steps.filter((s) => !s.skipped).reduce((sum, s) => sum + s.instances, 0);
  return {
    ok: result.ok,
    errors: localizeIssues(result.errors, lang),
    messages: result.messages.map((m) => ({ level: m.level, path: m.path, text: m.text, ...(m.focus ? { focus: m.focus } : {}) })),
    params: result.params.map((p) => ({
      id: p.id, type: p.type, value: p.value, source: p.source, visible: p.visible, enabled: p.enabled,
      ...(p.min !== undefined ? { min: p.min } : {}), ...(p.max !== undefined ? { max: p.max } : {}),
    })),
    derived: result.derived,
    steps,
    outputs: result.outputs,
    estimate: {
      steps: steps.length,
      activeSteps: steps.filter((s) => !s.skipped).length,
      /** Operaciones del motor que se van a ejecutar (una por instancia). */
      operations: created,
      outputs: result.outputs.length,
      limits: RECIPE_RUN_LIMITS,
    },
  };
}
