/**
 * @file src/core/addons/magnetFollow.ts
 * @description Ciclo de vida del alojamiento de imán ligado a su pieza anfitriona: la parte del imán del seguimiento
 * genérico de agregados (`addonFollow`). Un imán conserva su medida real: cuando la escala de la pieza cambia (sola
 * o junto con su grupo), cada negativo con `metadata.addon` de imán vuelve a su escala anterior y se lleva a su cara
 * con la transformación afín de la pieza. También: reasignar el anfitrión al duplicar y reunir los imanes de las
 * piezas que se borran. El store usa directamente las versiones genéricas (todos los agregados).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../../types/kura';
import { dependentAddonIds, followAddonHosts, followAddonPose, remapAddonHosts } from './addonFollow';

type Placed = Pick<SceneObject, 'position' | 'rotation' | 'scale'>;

export const isMagnetPocket = (o: Pick<SceneObject, 'metadata'>): boolean => o.metadata?.addon?.kind === 'magnet_pocket';
export const magnetHostId = (o: Pick<SceneObject, 'metadata'>): string | undefined =>
  isMagnetPocket(o) ? o.metadata?.addon?.hostId : undefined;

/** Pose del imán después de que su pieza pasa de `host0` a `host1` (ver `followAddonPose`). */
export function followHostPose(magnet: SceneObject, host0: Placed, host1: Placed): Placed | null {
  return isMagnetPocket(magnet) ? followAddonPose(magnet, host0, host1) : null;
}

/** Lleva los imanes con su pieza (ver `followAddonHosts`). */
export function followMagnetHosts(prev: readonly SceneObject[], next: SceneObject[]): SceneObject[] {
  return followAddonHosts(prev, next, isMagnetPocket);
}

/** Copias de un duplicado: el imán copiado apunta a la copia de su pieza si también se duplicó. */
export function remapMagnetHosts(copies: SceneObject[], copyIdBySource: ReadonlyMap<string, string>): SceneObject[] {
  return remapAddonHosts(copies, copyIdBySource, isMagnetPocket);
}

/** Imanes de las piezas `hostIds` que no están ya en la lista (ver `dependentAddonIds`). */
export function dependentMagnetIds(
  objects: readonly SceneObject[], hostIds: ReadonlySet<string>, options: { includeLocked?: boolean } = {},
): string[] {
  return dependentAddonIds(objects, hostIds, { ...options, accept: isMagnetPocket });
}
