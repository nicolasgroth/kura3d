/**
 * @file src/core/scene/sceneRules.ts
 * @description Reglas de escena independientes de la interfaz: bloqueo de objetos, vigencia de
 * entradas tras una operación asíncrona y selección de objetivos (módulos, booleanas, huecos,
 * envolvente, alineación, estructuras). Funciones puras sobre listas de `SceneObject`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AlignMode, SceneObject } from '../../types/kura';
import { boxesOverlap } from './overlap';
import { isNegative, isReference, isSolid, participatesInBooleans } from './objectRole';

/** Un objeto bloqueado no se modifica ni se consume en operaciones. */
export const isEditable = (obj: SceneObject | undefined): obj is SceneObject => Boolean(obj && !obj.locked);

/**
 * true si cada objeto de entrada sigue en la escena con la misma geometría y transformación
 * (comparación por referencia: cada edición reemplaza esos campos). Metadatos no cuentan.
 */
export function inputsAreCurrent(current: SceneObject[], inputs: SceneObject[]): boolean {
  const byId = new Map(current.map((o) => [o.id, o]));
  return inputs.every((input) => {
    const now = byId.get(input.id);
    return now !== undefined && now.mesh === input.mesh && now.position === input.position &&
      now.rotation === input.rotation && now.scale === input.scale;
  });
}

/** Objetivo de un módulo (+/−): el indicado, el primer sólido seleccionado o el primer sólido. */
export function resolveModuleTarget(
  objects: SceneObject[],
  selectedIds: string[],
  targetId?: string,
): SceneObject | null {
  // Una referencia nunca recibe piezas agregadas.
  return objects.find((o) => o.id === targetId && participatesInBooleans(o)) ??
    objects.find((o) => selectedIds.includes(o.id) && isSolid(o)) ??
    objects.find((o) => isSolid(o)) ??
    null;
}

/** Entradas de una booleana: objetivo, herramienta y extras (explícitos o de la selección). */
export function resolveBooleanInputs(
  objects: SceneObject[],
  selectedIds: string[],
  explicitTargetId?: string,
  explicitToolId?: string | string[],
): { target: SceneObject; tool: SceneObject; extras: SceneObject[]; extrasInSceneOrder: SceneObject[] } | null {
  const explicitTools = explicitToolId === undefined ? [] : Array.isArray(explicitToolId) ? explicitToolId : [explicitToolId];
  const target = objects.find((o) => o.id === (explicitTargetId ?? selectedIds[0]));
  const tool = objects.find((o) => o.id === (explicitTools[0] ?? selectedIds[1]));
  if (!target || !tool || target.id === tool.id) return null;
  const extraIds = !explicitTargetId && explicitTools.length === 0 ? selectedIds.slice(2) : explicitTools.slice(1);
  // Los pasos siguen el orden pedido; el nombre del resultado, el orden de la escena.
  const extras = extraIds.map((id) => objects.find((o) => o.id === id)).filter((o): o is SceneObject => Boolean(o));
  // Una referencia no es objetivo ni herramienta de booleanas.
  if (![target, tool, ...extras].every(participatesInBooleans)) return null;
  return { target, tool, extras, extrasInSceneOrder: objects.filter((o) => extraIds.includes(o.id)) };
}

/** Sólidos y huecos visibles y desbloqueados del alcance (selección de 2+ o toda la escena). */
export function resolveHoleScope(objects: SceneObject[], selectedIds: string[]): { solids: SceneObject[]; holes: SceneObject[] } {
  const scope = selectedIds.length >= 2 ? objects.filter((o) => selectedIds.includes(o.id)) : objects;
  return {
    solids: scope.filter((o) => isSolid(o) && o.visible && !o.locked),
    holes: scope.filter((o) => isNegative(o) && o.visible && !o.locked),
  };
}

/**
 * Recorta el alcance de "Aplicar restas" a lo que realmente se toca: sólidos con algún negativo encima
 * y negativos que tocan algún sólido. El resto queda intacto (sin reconstruir, sin consumir).
 */
export function touchingHoleScope(solids: SceneObject[], holes: SceneObject[]): { solids: SceneObject[]; holes: SceneObject[] } {
  return {
    solids: solids.filter((s) => holes.some((h) => boxesOverlap(s, h))),
    holes: holes.filter((h) => solids.some((s) => boxesOverlap(s, h))),
  };
}

/** Objetos de la envolvente convexa:los indicados (2+) o la selección. */
export function resolveHullTargets(objects: SceneObject[], selectedIds: string[], ids?: string[]): SceneObject[] {
  const targetIds = ids && ids.length >= 2 ? ids : selectedIds;
  const targets = objects.filter((o) => targetIds.includes(o.id));
  // Una referencia en la entrada rechaza la operación entera (no se ignora en silencio).
  return targets.every(participatesInBooleans) ? targets : [];
}

/** Objetos a alinear (desbloqueados); `arrange_grid` sin selección múltiple usa los visibles. */
export function resolveAlignTargets(objects: SceneObject[], selectedIds: string[], mode: AlignMode): SceneObject[] {
  return mode === 'arrange_grid' && selectedIds.length < 2
    ? objects.filter((o) => o.visible && !o.locked && !isReference(o))
    : objects.filter((o) => selectedIds.includes(o.id) && !o.locked);
}

/** Huecos visibles que acompañan a los objetivos al distribuir en grilla. */
export function holeCompanions(objects: SceneObject[], targets: SceneObject[]): SceneObject[] {
  const ids = new Set(targets.map((o) => o.id));
  return objects.filter((o) => isNegative(o) && o.visible && !o.locked && !ids.has(o.id));
}

/** Objeto sobre el que actúa una operación de estructuras: indicado, segmentado, seleccionado o primero. */
export function resolveStructureTarget(
  objects: SceneObject[],
  selectedIds: string[],
  id?: string,
  segmentedId?: string,
): SceneObject | undefined {
  const targetId = id ?? segmentedId ?? selectedIds[0] ?? objects[0]?.id;
  return objects.find((o) => o.id === targetId);
}
