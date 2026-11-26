/**
 * @file src/store/keptHalfPreference.ts
 * @description Preferencia del usuario sobre dónde dejar la mitad conservada de un corte por plano
 * (dejarla donde está, apoyarla en la cama o en un lugar libre). Se guarda en localStorage con el mismo
 * mecanismo tolerante de `preferencesStorage`; solo guarda uno de los tres valores permitidos, nunca texto libre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { KEPT_HALF_PLACEMENTS, type KeptHalfPlacement } from '../core/scene/keptHalf';
import { readStorage, writeStorage } from './preferencesStorage';

export const STORAGE_KEPT_HALF_KEY = 'kura3d-kept-half-placement';

/** Valor inicial del diálogo cuando no hay preferencia: apoyarla en la cama. */
export const INITIAL_KEPT_HALF_CHOICE: KeptHalfPlacement = 'dropToBed';

export function loadKeptHalfChoice(): KeptHalfPlacement {
  const raw = readStorage(STORAGE_KEPT_HALF_KEY);
  return KEPT_HALF_PLACEMENTS.find((v) => v === raw) ?? INITIAL_KEPT_HALF_CHOICE;
}

export function saveKeptHalfChoice(value: KeptHalfPlacement): void {
  writeStorage(STORAGE_KEPT_HALF_KEY, value);
}
