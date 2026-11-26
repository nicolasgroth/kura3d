/**
 * @file mcp-server/src/headlessFollow.ts
 * @description Regla de los agregados en el motor sin interfaz, la misma que aplica el store de la app tras cada
 * cambio (`followAddonHosts`): un imán o una torreta conserva su medida y sigue a su pieza cuando esta se mueve, gira
 * o escala. Como la escena headless se modifica en el lugar, se toma una copia superficial de las poses antes del
 * cambio y, después, se lleva cada agregado a su cara con la función compartida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { addonHostId, followAddonHosts } from '../../src/core/addons/addonFollow';
import { worldStatsOf, type HeadlessSceneObject } from './headlessSupport.js';

/** Copia superficial de la escena antes de un cambio; null si no hay agregados (nada que seguir). */
export function snapshotForFollow(objects: Iterable<HeadlessSceneObject>): HeadlessSceneObject[] | null {
  const list = [...objects];
  return list.some((o) => addonHostId(o) !== undefined) ? list.map((o) => ({ ...o })) : null;
}

/**
 * Lleva los agregados cuya pieza cambió de pose (con la misma malla) a su cara con su medida anterior. Modifica los
 * objetos vivos y devuelve los IDs movidos.
 */
export function followAddonsAfter(before: HeadlessSceneObject[] | null, live: HeadlessSceneObject[]): string[] {
  if (!before) return [];
  const next = followAddonHosts(before, live);
  if (next === live) return [];
  const moved: string[] = [];
  next.forEach((o, i) => {
    if (o === live[i]) return;
    const obj = live[i];
    obj.position = o.position;
    obj.rotation = o.rotation;
    obj.scale = o.scale;
    obj.stats = worldStatsOf(obj);
    moved.push(obj.id);
  });
  return moved;
}
