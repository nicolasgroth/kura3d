/**
 * @file src/components/viewport/useMagnetPlacement.ts
 * @description Interacción del alojamiento de imán en el visor: la común de los agregados (`useAddonPlacement`)
 * apuntada al panel del imán. Con el panel abierto, el cursor sobre una pieza muestra la vista previa en la cara y un
 * clic sin arrastre coloca el hueco; un arrastre (orbitar) no coloca y la pieza no se selecciona ni se mueve.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { placeMagnetAt, setMagnetHover, useMagnetPanel } from '../../store/magnetPanel';
import type { SceneObject } from '../../types/kura';
import {
  ADDON_CLICK_SLOP_PX, addonHitFromEvent, useAddonPlacement, type AddonPlacementHandlers, type AddonPlacementTarget,
} from './useAddonPlacement';

/** Píxeles de movimiento entre bajar y soltar a partir de los cuales el gesto es un arrastre, no un clic. */
export const MAGNET_CLICK_SLOP_PX = ADDON_CLICK_SLOP_PX;

/** Cara bajo el cursor: punto sobre la pieza real y normal de mundo hacia la cámara. */
export const magnetHitFromEvent = addonHitFromEvent;

export type MagnetPlacementHandlers = AddonPlacementHandlers;

const MAGNET_TARGET: AddonPlacementTarget = {
  setHover: (hover) => setMagnetHover(hover),
  hoverHostId: () => useMagnetPanel.getState().hover?.hostId,
  place: (hostId, point, normal) => placeMagnetAt(hostId, point, normal),
};

export function useMagnetPlacement(obj: SceneObject): MagnetPlacementHandlers {
  return useAddonPlacement(obj, MAGNET_TARGET);
}
