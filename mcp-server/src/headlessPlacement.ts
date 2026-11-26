/**
 * @file mcp-server/src/headlessPlacement.ts
 * @description Colocación en espacio libre del MCP headless: las piezas nuevas (primitiva, texto,
 * rosca, SVG, molde) van al primer hueco libre de la cama sin solapar las cajas envolventes de la
 * escena, salvo `placement: 'origin'` o una posición explícita. Las piezas de un corte o un molde
 * se separan entre sí para que ninguna caja envolvente quede superpuesta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { findFreeSpot, footprintOf, placeInFreeSpot, sceneFootprints, type BedSize } from '../../src/core/scene/freeSpot';
import type { MeshData, SceneObject, Vec3 } from '../../src/types/kura';

/** `free` (por defecto): primer hueco libre de la cama; `origin`: centro de la escena. */
export type HeadlessPlacement = 'free' | 'origin';

/**
 * Función de colocación para las operaciones de creación: `undefined` (origen) si se pide
 * `origin`; si no, la posición en el primer hueco libre frente a `scene`.
 */
export function freePlacer(
  scene: readonly SceneObject[],
  bed: BedSize,
  placement: HeadlessPlacement = 'free',
  rotation?: Vec3,
  scale?: Vec3,
): ((mesh: MeshData) => Vec3) | undefined {
  if (placement === 'origin') return undefined;
  return (mesh) => placeInFreeSpot(scene, mesh, rotation, scale, bed).position;
}

/**
 * Reparte `parts` (con posiciones de mundo) en huecos libres, una a una, sin solaparse entre sí ni
 * con `scene`. Conserva la altura de cada pieza; solo desplaza en X/Z.
 */
export function spreadPartsInFreeSpace<T extends SceneObject>(
  scene: readonly SceneObject[],
  parts: readonly T[],
  bed: BedSize,
): T[] {
  const occupied = sceneFootprints(scene);
  const placed: T[] = [];
  for (const part of parts) {
    const fp = footprintOf(part.mesh, part.position, part.rotation, part.scale);
    if (!fp) {
      placed.push(part);
      continue;
    }
    const spot = findFreeSpot(occupied, [fp.maxX - fp.minX, fp.maxZ - fp.minZ], bed);
    const dx = spot.x - (fp.minX + fp.maxX) / 2;
    const dz = spot.z - (fp.minZ + fp.maxZ) / 2;
    placed.push({ ...part, position: [part.position[0] + dx, part.position[1], part.position[2] + dz] as Vec3 });
    occupied.push({ minX: fp.minX + dx, maxX: fp.maxX + dx, minZ: fp.minZ + dz, maxZ: fp.maxZ + dz });
  }
  return placed;
}
