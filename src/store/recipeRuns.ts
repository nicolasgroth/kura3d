/**
 * @file src/store/recipeRuns.ts
 * @description Juegos de piezas creados por una receta (todas las salidas de una misma ejecución comparten
 * `metadata.recipe.run`): sellar la procedencia al crear (ejecución, nombre generado y huella de la malla), encontrar
 * el juego de una pieza, saber si se modificó después y planificar su reemplazo al reabrir el asistente (conserva
 * posición, nombre cambiado por el usuario, color y grupo). Puro: no toca el store.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { hasPaintedFaces } from '../core/scene/parametric';
import { computeMeshFingerprint } from '../engine/meshFingerprint';
import type { SceneObject } from '../types/kura';

/** Marca cada pieza recién generada con su ejecución, el nombre que le dio la receta y la huella de su malla. */
export function stampRecipeRun(parts: readonly SceneObject[], run: string): SceneObject[] {
  return parts.map((o) => {
    const recipe = o.metadata?.recipe;
    if (!recipe) return o;
    return { ...o, metadata: { ...o.metadata, recipe: { ...recipe, run, name: o.name.slice(0, 200), meshFingerprint: computeMeshFingerprint(o.mesh) } } };
  });
}

/** Piezas de la misma ejecución que `target` (en orden de escena); sin `run` (proyecto anterior), solo `target`. */
export function recipeRunMembers(objects: readonly SceneObject[], target: SceneObject): SceneObject[] {
  const run = target.metadata?.recipe?.run;
  if (!run) return [target];
  const id = target.metadata?.recipe?.id;
  return objects.filter((o) => o.metadata?.recipe?.run === run && o.metadata.recipe.id === id);
}

/** `true` si alguna pieza del juego ya no es lo que generó la receta (cortada, restada, pintada) o no hay forma de saberlo. */
export function isRecipeRunModified(members: readonly SceneObject[]): boolean {
  return members.some((o) => {
    const saved = o.metadata?.recipe?.meshFingerprint;
    return saved === undefined || saved !== computeMeshFingerprint(o.mesh) || hasPaintedFaces(o.mesh);
  });
}

export interface ReplacePlan {
  readonly added: SceneObject[];
  readonly removedIds: string[];
}

const outputOf = (o: SceneObject) => o.metadata?.recipe?.output ?? '';

/**
 * Qué reemplaza a qué. Cada pieza nueva toma a su par (misma salida y mismo orden dentro de ella) de las viejas: su
 * nombre si el usuario lo cambió, su color, su grupo y si estaba bloqueada u oculta. El bloque nuevo se ancla en la
 * planta del primer par (la receta decide la altura y la disposición entre piezas); si ninguna tiene par, se queda donde
 * lo dejó la receta. El resultado conserva la ejecución de las piezas viejas.
 */
export function planReplacement(old: readonly SceneObject[], fresh: readonly SceneObject[], run: string): ReplacePlan {
  const pairs = fresh.map((part) => {
    const out = outputOf(part);
    const nth = fresh.filter((f) => outputOf(f) === out).indexOf(part);
    return { part, match: old.filter((o) => outputOf(o) === out)[nth] as SceneObject | undefined };
  });
  const anchor = pairs.find((p) => p.match);
  const dx = anchor?.match ? anchor.match.position[0] - anchor.part.position[0] : 0;
  const dz = anchor?.match ? anchor.match.position[2] - anchor.part.position[2] : 0;
  const groupRef = old.find((o) => o.groupRef !== undefined)?.groupRef;
  const placed = pairs.map(({ part, match }) => {
    const ref = match?.groupRef ?? groupRef;
    return {
      ...part,
      position: [part.position[0] + dx, part.position[1], part.position[2] + dz] as SceneObject['position'],
      ...(match && match.name !== match.metadata?.recipe?.name ? { name: match.name } : {}),
      ...(match ? { color: match.color, locked: match.locked, visible: match.visible } : {}),
      ...(ref !== undefined ? { groupRef: ref } : {}),
    };
  });
  return { added: stampRecipeRun(placed, run), removedIds: old.map((o) => o.id) };
}
