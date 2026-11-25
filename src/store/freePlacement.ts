/**
 * @file src/store/freePlacement.ts
 * @description Único colocador del store para lo nuevo (primitivas, texto 3D, roscas, SVG, imagen a
 * 3D): la pieza cae en el primer hueco libre de la cama activa (`placeInFreeSpot`) y, tras crearla,
 * se avisa si quedó fuera de la cama y se encuadra. Importaciones y moldes usan la misma búsqueda
 * (`findFreeSpot`) a través de `placeGroupInFreeSpot` / `placePartsInFreeSpot`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PlaceMesh } from '../core/operations';
import { placeInFreeSpot } from '../core/scene/freeSpot';
import type { Vec3 } from '../types/kura';
import { placementBedSize } from './bedSize';
import type { KuraStoreState } from './storeTypes';

type PlacementState = Pick<KuraStoreState, 'objects' | 'customBedDimensions' | 'printerProfile'>;

export interface FreePlacer {
  place: PlaceMesh;
  /** `fits`: la última pieza colocada cupo en la cama; `wasEmpty`: la escena estaba vacía al empezar. */
  result: { fits: boolean; wasEmpty: boolean };
}

/** Colocador en el primer hueco libre de la escena vigente (se lee al colocar, no al crear el colocador). */
export function createFreePlacer(get: () => PlacementState, rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): FreePlacer {
  const result = { fits: true, wasEmpty: get().objects.length === 0 };
  const place: PlaceMesh = (mesh) => {
    const state = get();
    const spot = placeInFreeSpot(state.objects, mesh, rotation, scale, placementBedSize(state));
    result.fits = spot.fits;
    return spot.position;
  };
  return { place, result };
}

/**
 * Tras colocar en espacio libre: avisa si no cupo en la cama y encuadra. Escena vacía o fuera de la
 * cama: encuadre de la pieza; si ya había objetos, se asegura que la pieza nueva quede a la vista.
 */
export function announceFreePlacement(
  state: Pick<KuraStoreState, 'addToast' | 'requestCameraPreset'>,
  tr: (key: 'toast.placedOutsideBed') => string,
  result: FreePlacer['result'],
  newId: string,
): void {
  if (!result.fits) state.addToast(tr('toast.placedOutsideBed'), 'info');
  if (!result.fits || result.wasEmpty) state.requestCameraPreset('fit', [newId]);
  else state.requestCameraPreset('ensure', [newId]);
}
