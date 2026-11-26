/**
 * @file src/core/operations/addonPostMerge.ts
 * @description «Aplicar restas» con agregados positivos: antes de restar, cada poste de torreta (sólido con
 * `metadata.addon` `screw_boss`/`post`) se une a su pieza anfitriona si ambos están en el alcance, así el agujero
 * corta un solo cuerpo y el resultado es una pieza cerrada. La pieza conserva su ID; el poste se consume. Sin postes
 * es exactamente `applyHoles`. También amplía el alcance del store: un poste tocado por un agujero arrastra a su
 * pieza (aunque el agujero no llegue a ella) y una pieza tocada arrastra a sus postes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as engine from '../../engine';
import type { SceneObject } from '../../types/kura';
import { buildSceneObject } from '../scene/sceneObjects';
import { applyHoles } from './csgOperations';
import { change, type OperationContext, type SceneChange } from './operationTypes';

/** Anfitrión del poste de una torreta (undefined si no es un poste). */
export function addonPostHostId(o: Pick<SceneObject, 'metadata'>): string | undefined {
  const addon = o.metadata?.addon;
  return addon?.kind === 'screw_boss' && addon.part === 'post' ? addon.hostId : undefined;
}

/**
 * Alcance de «Aplicar restas» con los postes: a los sólidos tocados (`touching`) suma, desde los sólidos disponibles
 * (`available`), la pieza de cada poste tocado y los postes de cada pieza tocada. Mantiene el orden de `available`.
 */
export function withAddonPosts(available: readonly SceneObject[], touching: readonly SceneObject[]): SceneObject[] {
  const ids = new Set(touching.map((o) => o.id));
  const add = new Set<string>();
  for (const o of touching) {
    const host = addonPostHostId(o);
    if (host) add.add(host);
  }
  for (const o of available) {
    const host = addonPostHostId(o);
    if (host && ids.has(host)) add.add(o.id);
  }
  if ([...add].every((id) => ids.has(id))) return [...touching];
  return available.filter((o) => ids.has(o.id) || add.has(o.id));
}

/** Une cada poste a su pieza (si está en `solids`); devuelve los sólidos resultantes y los postes consumidos. */
export async function mergeAddonPosts(ctx: OperationContext, solids: SceneObject[]): Promise<{ solids: SceneObject[]; mergedIds: string[] }> {
  const byId = new Map(solids.map((s) => [s.id, s]));
  const postsByHost = new Map<string, SceneObject[]>();
  for (const s of solids) {
    const host = addonPostHostId(s);
    if (host && host !== s.id && byId.has(host) && !addonPostHostId(byId.get(host)!)) {
      postsByHost.set(host, [...(postsByHost.get(host) ?? []), s]);
    }
  }
  if (postsByHost.size === 0) return { solids, mergedIds: [] };
  const mergedIds: string[] = [];
  const out: SceneObject[] = [];
  for (const s of solids) {
    if (mergedIds.includes(s.id) || (addonPostHostId(s) && postsByHost.get(addonPostHostId(s)!)?.includes(s))) continue;
    const posts = postsByHost.get(s.id);
    if (!posts) {
      out.push(s);
      continue;
    }
    let current = s;
    for (const post of posts) {
      const res = await engine.runBooleanOperation(current, post, 'union');
      current = buildSceneObject({
        id: s.id, name: s.name, source: 'boolean', mesh: res.mesh, position: res.position, color: s.color, materialPreset: s.materialPreset,
      }, ctx.policy);
      mergedIds.push(post.id);
    }
    out.push(current);
  }
  return { solids: out, mergedIds };
}

/** `applyHoles` uniendo antes los postes a sus piezas: el cambio también quita los postes consumidos. */
export async function applyHolesWithPosts(
  ctx: OperationContext, solids: SceneObject[], holes: SceneObject[],
): Promise<{ updated: SceneObject[]; change: SceneChange }> {
  const merged = await mergeAddonPosts(ctx, solids);
  if (merged.mergedIds.length === 0) return applyHoles(ctx, solids, holes);
  const res = await applyHoles(ctx, merged.solids, holes);
  const removedIds = [...new Set([...(res.change.removedIds ?? []), ...merged.mergedIds])];
  return { updated: res.updated, change: change({ ...res.change, removedIds }) };
}
