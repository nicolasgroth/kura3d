/**
 * @file src/components/inspector/plateRelativePosition.ts
 * @description Con dos o más placas, el inspector muestra y edita la posición de la pieza respecto del centro de su
 * placa (no la global de la escena, que para la placa 2 es del orden de 300 mm). Funciones puras: el desplazamiento
 * de la placa en ejes internos (X, Z; la altura no cambia) y el paso de posición global a relativa y de vuelta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { findPlate } from '../../core/scene/plates';
import type { Vec3 } from '../../types/kura';
import type { SceneLayout, ScenePlate } from '../../types/plates';

/**
 * Placa cuyo centro es el origen de las coordenadas mostradas, o `null` si se muestran las globales (una sola
 * placa, pieza sin placa o disposición de armado: allí la posición es la de la figura compuesta).
 */
export function displayPlate(plates: readonly ScenePlate[], plateRef: string | undefined, layout: SceneLayout | undefined): ScenePlate | null {
  if (plates.length < 2 || layout === 'assembly') return null;
  return findPlate(plates, plateRef);
}

/** Desplazamiento de la placa en ejes internos [X, 0, Z]. */
export const plateOffset = (plate: ScenePlate | null): Vec3 => (plate ? [plate.origin[0], 0, plate.origin[1]] : [0, 0, 0]);

export const toPlateRelative = (position: Readonly<Vec3>, offset: Readonly<Vec3>): Vec3 => [position[0] - offset[0], position[1] - offset[1], position[2] - offset[2]];

export const fromPlateRelative = (relative: Readonly<Vec3>, offset: Readonly<Vec3>): Vec3 => [relative[0] + offset[0], relative[1] + offset[1], relative[2] + offset[2]];
