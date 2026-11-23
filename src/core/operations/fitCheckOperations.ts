/**
 * @file src/core/operations/fitCheckOperations.ts
 * @description "Comprobar encaje" como operación pura (app, Worker y MCP sin interfaz): alcance por
 * defecto (los indicados; si no, la selección; si no hay, todo lo visible), negativos visibles a aplicar,
 * vigencia de un informe frente a la escena y el chequeo de consistencia tras "Ajustar a la impresora"
 * (corre la comprobación sobre el bloque ya transformado y la acompaña de sus medidas funcionales).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { runFitCheck, type FitCheckBody, type FitCheckHooks, type FitCheckInput, type FitCheckOptions, type FitCheckReport } from '../../engine/fitCheck';
import type { FunctionalFeature } from '../../engine/fitToBed';
import type { SceneObject } from '../../types/kura';
import { isNegative } from '../scene/objectRole';
import type { SceneChange } from './operationTypes';

/** Objetos a comprobar y negativos a aplicar. `ids` vacío o ausente: la selección; sin selección: lo visible. */
export function fitCheckScope(
  objects: readonly SceneObject[],
  selectedIds: readonly string[],
  ids?: readonly string[],
): { objects: SceneObject[]; negatives: SceneObject[] } {
  const pick = ids && ids.length > 0 ? ids : selectedIds;
  const chosen = pick.length > 0 ? objects.filter((o) => pick.includes(o.id)) : objects.filter((o) => o.visible);
  return {
    objects: chosen.filter((o) => !isNegative(o)),
    negatives: objects.filter((o) => o.visible && isNegative(o)),
  };
}

/** Lo que el informe necesita seguir igual para valer (referencias a malla y transformación). */
export interface FitCheckInputRef {
  id: string;
  mesh: SceneObject['mesh'];
  position: SceneObject['position'];
  rotation: SceneObject['rotation'];
  scale: SceneObject['scale'];
  role: SceneObject['role'];
  visible: boolean;
}

export const fitCheckInputRefs = (input: Pick<FitCheckInput, 'objects' | 'negatives'>, scene: readonly SceneObject[]): FitCheckInputRef[] => {
  const byId = new Map(scene.map((o) => [o.id, o]));
  return [...input.objects, ...(input.negatives ?? [])]
    .map((b) => byId.get(b.id))
    .filter((o): o is SceneObject => Boolean(o))
    .map((o) => ({ id: o.id, mesh: o.mesh, position: o.position, rotation: o.rotation, scale: o.scale, role: o.role, visible: o.visible }));
};

const sameVec = (a: readonly number[], b: readonly number[]) => a === b || (a.length === b.length && a.every((v, i) => v === b[i]));

/**
 * El informe sigue valiendo si ningún objeto involucrado cambió de malla, transformación, rol o
 * visibilidad, y no apareció ni se fue un negativo visible (cambiaría las restas aplicadas).
 */
export function fitCheckIsCurrent(refs: readonly FitCheckInputRef[], scene: readonly SceneObject[]): boolean {
  const byId = new Map(scene.map((o) => [o.id, o]));
  for (const r of refs) {
    const o = byId.get(r.id);
    if (!o || o.mesh !== r.mesh || o.role !== r.role || o.visible !== r.visible) return false;
    if (!sameVec(o.position, r.position) || !sameVec(o.rotation, r.rotation) || !sameVec(o.scale, r.scale)) return false;
  }
  const known = new Set(refs.filter((r) => isNegative(r)).map((r) => r.id));
  const negatives = scene.filter((o) => o.visible && isNegative(o));
  return negatives.length === known.size && negatives.every((o) => known.has(o.id));
}

/** Objetos con los parches de transformación de un `SceneChange` aplicados (copias; la escena no cambia). */
function withPatches<T extends FitCheckBody>(objects: readonly T[], change: SceneChange | null): T[] {
  if (!change) return [...objects];
  const patches = new Map(change.patches.map((p) => [p.id, p.patch]));
  return objects.map((o) => {
    const p = patches.get(o.id);
    return p ? { ...o, ...(p.position ? { position: p.position } : {}), ...(p.rotation ? { rotation: p.rotation } : {}), ...(p.scale ? { scale: p.scale } : {}) } : o;
  });
}

/** Resultado mínimo de "Ajustar a la impresora" que necesita el chequeo de consistencia. */
export interface FitToBedOutcome {
  analysis: { objectIds: string[]; functional: FunctionalFeature[] };
  change: SceneChange | null;
}

/**
 * Chequeo de consistencia tras reescalar: comprueba el encaje del bloque ajustado (con la transformación
 * del ajuste aplicada en copia y las restas pendientes) y devuelve el informe con las medidas funcionales
 * del bloque (`FunctionalFeature`), para avisar si algo quedó chocando o justo. Sin interfaz.
 */
export async function checkFitAfterFitToBed(
  scene: readonly SceneObject[],
  outcome: FitToBedOutcome,
  options: FitCheckOptions = {},
  hooks: FitCheckHooks = {},
): Promise<{ report: FitCheckReport; functional: FunctionalFeature[] }> {
  const ids = new Set(outcome.analysis.objectIds);
  const block = withPatches(scene.filter((o) => ids.has(o.id)), outcome.change);
  const negatives = withPatches(scene.filter((o) => o.visible && isNegative(o)), outcome.change);
  const report = await runFitCheck({ objects: block.filter((o) => !isNegative(o)), negatives, options }, hooks);
  return { report, functional: outcome.analysis.functional };
}
