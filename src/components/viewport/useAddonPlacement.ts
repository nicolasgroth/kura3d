/**
 * @file src/components/viewport/useAddonPlacement.ts
 * @description Interacción común de los agregados que se colocan con clic sobre una cara (imán, torreta): con su
 * panel abierto, el cursor sobre una pieza muestra la vista previa en la cara (punto exacto sobre el triángulo y la
 * normal de la superficie promediada en el radio del agregado, con rotación y escala de la pieza) y un clic sin arrastre coloca. Un arrastre (orbitar) no
 * coloca; el gesto no llega a la pieza, así que tampoco la selecciona ni la mueve.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import { rayHitOnFace, worldFaceNormal } from '../../core/addons/magnetPocket';
import { SURFACE_NORMAL_DEFAULT_RADIUS_MM, worldSurfaceNormal } from '../../core/addons/surfaceNormal';
import type { AddonHover } from '../../store/addonHover';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject, Vec3 } from '../../types/kura';

/** Píxeles de movimiento entre bajar y soltar a partir de los cuales el gesto es un arrastre, no un clic. */
export const ADDON_CLICK_SLOP_PX = 5;

/**
 * Cara bajo el cursor: punto sobre la pieza real y normal de mundo hacia la cámara. En caras curvas la normal es la de
 * la superficie promediada en `radiusMm` (no la de la faceta); en caras planas, la de la cara tal cual.
 */
export function addonHitFromEvent(
  obj: SceneObject, e: Pick<ThreeEvent<MouseEvent>, 'faceIndex' | 'ray' | 'point'>, radiusMm = SURFACE_NORMAL_DEFAULT_RADIUS_MM,
): AddonHover | null {
  const face = e.faceIndex;
  if (face == null) return null;
  const normal = worldFaceNormal(obj.mesh, face, obj.rotation, obj.scale);
  if (!normal) return null;
  const origin: Vec3 = [e.ray.origin.x, e.ray.origin.y, e.ray.origin.z];
  const dir: Vec3 = [e.ray.direction.x, e.ray.direction.y, e.ray.direction.z];
  const point = rayHitOnFace(obj.mesh, face, obj, origin, dir) ?? ([e.point.x, e.point.y, e.point.z] as Vec3);
  // Una malla con caras invertidas daría la normal hacia adentro: se toma la que mira a la cámara.
  const facing = normal[0] * dir[0] + normal[1] * dir[1] + normal[2] * dir[2] > 0 ? (normal.map((v) => -v) as Vec3) : normal;
  return { hostId: obj.id, point, normal: worldSurfaceNormal(obj, point, facing, radiusMm) ?? facing };
}

export interface AddonPlacementHandlers {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: () => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

/** Lo que cada agregado aporta: escribir la cara bajo el cursor, leer la actual y colocar. */
export interface AddonPlacementTarget {
  setHover: (hover: AddonHover | null) => void;
  hoverHostId: () => string | undefined;
  place: (hostId: string, point: Vec3, normal: Vec3) => unknown;
  /** Radio (mm) en que se promedia la normal de la superficie: el del agregado. */
  radiusMm?: () => number;
}

export function addonPlacementHandlers(obj: SceneObject, target: AddonPlacementTarget): AddonPlacementHandlers {
  return {
    onPointerDown: (e) => {
      // La pieza real no recibe el gesto: ni selección ni arrastre para mover mientras se colocan agregados.
      if (e.button === 0) e.stopPropagation();
    },
    onPointerMove: (e) => {
      e.stopPropagation();
      if (e.buttons !== 0) return;
      target.setHover(addonHitFromEvent(obj, e, target.radiusMm?.()));
    },
    onPointerOut: () => {
      if (target.hoverHostId() === obj.id) target.setHover(null);
    },
    onClick: (e) => {
      e.stopPropagation();
      if (e.button !== 0 || e.delta > ADDON_CLICK_SLOP_PX) return;
      if (useKuraStore.getState().busyOperation) return;
      const hit = addonHitFromEvent(obj, e, target.radiusMm?.());
      if (hit) void target.place(hit.hostId, hit.point, hit.normal);
    },
  };
}

export function useAddonPlacement(obj: SceneObject, target: AddonPlacementTarget): AddonPlacementHandlers {
  return useMemo(() => addonPlacementHandlers(obj, target), [obj, target]);
}
