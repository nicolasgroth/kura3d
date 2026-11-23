/**
 * @file src/core/recipes/run/response.ts
 * @description Forma pública (bus, MCP con puente y sin interfaz) del resultado de aplicar una receta: objetos
 * nuevos con medidas de mundo en ejes del usuario, salidas, chequeos y estadísticas; y el primer error de una
 * receta fallida con su código y mensaje traducido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { computeWorldStats } from '../../../engine';
import { t, type TranslationKey } from '../../../i18n';
import type { LanguageCode } from '../../../types/kura';
import { statsToUser } from '../../scene/userAxesContract';
import type { RecipeIssue } from '../errors';
import type { RecipeRunSuccess } from './types';

export function appliedRecipeResponse(result: RecipeRunSuccess) {
  return {
    dryRun: false,
    ok: true,
    objects: result.change.added.map((o) => ({
      id: o.id, name: o.name, role: o.role, stats: statsToUser(computeWorldStats(o.mesh, o.rotation, o.scale)),
    })),
    outputs: result.outputs,
    checks: result.checks,
    messages: result.messages.map((m) => ({ level: m.level, text: m.text })),
    stats: result.stats,
  };
}

/** Código del bus para el primer problema: `failed` si falló la ejecución, `invalid-params` si la receta o las respuestas. */
export function issueBusCode(issue: RecipeIssue | undefined): 'failed' | 'invalid-params' {
  return issue?.code.startsWith('run.') ? 'failed' : 'invalid-params';
}

/** Texto del primer problema (con su ruta) en el idioma pedido. */
export function issueText(issue: RecipeIssue, lang: LanguageCode): string {
  return `${issue.code} @ ${issue.path || '(recipe)'}: ${t(lang, issue.key as TranslationKey, issue.params)}`;
}
