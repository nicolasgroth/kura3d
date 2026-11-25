/**
 * @file src/core/addons/addonNeighbors.ts
 * @description Vecinos de una pieza para colocar agregados: negativos pendientes que pueden tocar un alojamiento de
 * imán nuevo y postes de torreta o imanes que pueden chocar con una torreta nueva (descarte grueso por distancia; el
 * Worker mide el resto). Funciones puras compartidas por el store de la app y el MCP sin interfaz, para que ambos
 * midan contra los mismos objetos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../../types/kura';
import type { PlacedMesh } from '../operations/magnetOperations';
import { isNegative } from '../scene/objectRole';
import { MIN_WALL_MM } from './magnetPocket';
import { BOSS_MIN_WALL_MM } from './screwBoss';

/** Radio generoso de la pieza alrededor de su origen (mm), con su escala. */
const reachOf = (o: SceneObject) => Math.hypot(...o.stats.dimensionsMm) * Math.max(...o.scale.map(Math.abs));

const distance = (a: SceneObject, b: SceneObject) =>
  Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);

/** Solo lo que el Worker necesita de una pieza: su malla (posiciones e índices) y su transformación. */
export const placedMeshOf = (o: SceneObject): PlacedMesh => ({
  mesh: { positions: o.mesh.positions, indices: o.mesh.indices }, position: o.position, rotation: o.rotation, scale: o.scale,
});

/** Negativos pendientes que pueden tocar a la pieza (descarte grueso por distancia; el Worker mide el resto). */
export function nearbyNegatives(objects: readonly SceneObject[], host: SceneObject): SceneObject[] {
  const hr = reachOf(host);
  return objects.filter((o) => o.id !== host.id && isNegative(o) && distance(o, host) <= hr + reachOf(o) + MIN_WALL_MM);
}

/** Torretas (postes) e imanes pendientes cerca de la pieza: con ellos se mide el choque. */
export function nearbyAddons(objects: readonly SceneObject[], host: SceneObject): SceneObject[] {
  const hr = reachOf(host);
  return objects.filter((o) => {
    const addon = o.metadata?.addon;
    if (o.id === host.id || !addon) return false;
    if (addon.kind === 'screw_boss' && addon.part !== 'post') return false;
    return distance(o, host) <= hr + reachOf(o) + BOSS_MIN_WALL_MM;
  });
}

/** Agregados pendientes (de cualquier tipo) cerca de la pieza: con ellos se mide la distancia mínima (paso de cable). */
export function nearbyAddonObjects(objects: readonly SceneObject[], host: SceneObject, marginMm: number): SceneObject[] {
  const hr = reachOf(host);
  return objects.filter((o) => o.id !== host.id && Boolean(o.metadata?.addon) && distance(o, host) <= hr + reachOf(o) + marginMm);
}

/** El menor nombre libre: «base», «base (2)», «base (3)»… */
export function freeName(taken: ReadonlySet<string>, base: string): string {
  let name = base;
  for (let n = 2; taken.has(name); n += 1) name = `${base} (${n})`;
  return name;
}
