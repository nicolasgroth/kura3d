/**
 * @file src/components/viewport/useMagnetPlacement.ts
 * @description Interacción del alojamiento de imán en el visor: con el panel abierto, el cursor sobre una pieza
 * muestra la vista previa en la cara (punto exacto sobre el triángulo y su normal de mundo, con rotación y escala de
 * la pieza) y un clic sin arrastre coloca el hueco. Un arrastre (orbitar) no coloca; el gesto no llega a la pieza,
 * así que tampoco la selecciona ni la mueve.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import { rayHitOnFace, worldFaceNormal } from '../../core/addons/magnetPocket';
import { placeMagnetAt, setMagnetHover, useMagnetPanel, type MagnetHover } from '../../store/magnetPanel';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject, Vec3 } from '../../types/kura';

/** Píxeles de movimiento entre bajar y soltar a partir de los cuales el gesto es un arrastre, no un clic. */
export const MAGNET_CLICK_SLOP_PX = 5;

/** Cara bajo el cursor: punto sobre la pieza real y normal de mundo hacia la cámara. */
export function magnetHitFromEvent(obj: SceneObject, e: Pick<ThreeEvent<MouseEvent>, 'faceIndex' | 'ray' | 'point'>): MagnetHover | null {
  const face = e.faceIndex;
  if (face == null) return null;
  const normal = worldFaceNormal(obj.mesh, face, obj.rotation, obj.scale);
  if (!normal) return null;
  const origin: Vec3 = [e.ray.origin.x, e.ray.origin.y, e.ray.origin.z];
  const dir: Vec3 = [e.ray.direction.x, e.ray.direction.y, e.ray.direction.z];
  const point = rayHitOnFace(obj.mesh, face, obj, origin, dir) ?? ([e.point.x, e.point.y, e.point.z] as Vec3);
  // Una malla con caras invertidas daría la normal hacia adentro: se toma la que mira a la cámara.
  const facing = normal[0] * dir[0] + normal[1] * dir[1] + normal[2] * dir[2] > 0 ? (normal.map((v) => -v) as Vec3) : normal;
  return { hostId: obj.id, point, normal: facing };
}

export interface MagnetPlacementHandlers {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: () => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

export function useMagnetPlacement(obj: SceneObject): MagnetPlacementHandlers {
  return useMemo(() => ({
    onPointerDown: (e) => {
      // La pieza real no recibe el gesto: ni selección ni arrastre para mover mientras se colocan imanes.
      if (e.button === 0) e.stopPropagation();
    },
    onPointerMove: (e) => {
      e.stopPropagation();
      if (e.buttons !== 0) return;
      setMagnetHover(magnetHitFromEvent(obj, e));
    },
    onPointerOut: () => {
      if (useMagnetPanel.getState().hover?.hostId === obj.id) setMagnetHover(null);
    },
    onClick: (e) => {
      e.stopPropagation();
      if (e.button !== 0 || e.delta > MAGNET_CLICK_SLOP_PX) return;
      if (useKuraStore.getState().busyOperation) return;
      const hit = magnetHitFromEvent(obj, e);
      if (hit) void placeMagnetAt(hit.hostId, hit.point, hit.normal);
    },
  }), [obj]);
}
