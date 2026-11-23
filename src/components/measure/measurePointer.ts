/**
 * @file src/components/measure/measurePointer.ts
 * @description Puente entre los eventos de puntero de un objeto del visor y la herramienta Medir:
 * clic (punto, cara o elegir el recipiente), movimiento (punto de imán resaltado) y clic derecho
 * (cancela el punto en curso). El radio del imán se fija en píxeles y se pasa a mm con la distancia
 * a la cámara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useMeasureStore } from '../../store/measureStore';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject, Vec3 } from '../../types/kura';

/** Radio del imán en píxeles de pantalla; con el dedo es mayor porque la yema tapa y no apunta con precisión. */
const SNAP_PX = 14;
export const SNAP_PX_TOUCH = 24;

/** Radio en mm que ocupa `SNAP_PX` a la distancia del punto tocado. */
export function snapRadiusMm(e: ThreeEvent<PointerEvent | MouseEvent>): number {
  const cam = e.camera as THREE.PerspectiveCamera & THREE.OrthographicCamera;
  const heightPx = (e.nativeEvent.target as HTMLElement | null)?.clientHeight || 800;
  const snapPx = (e.nativeEvent as PointerEvent).pointerType === 'touch' ? SNAP_PX_TOUCH : SNAP_PX;
  if (cam.isOrthographicCamera) return ((cam.top - cam.bottom) / cam.zoom / heightPx) * snapPx;
  const fov = ((cam.fov ?? 50) * Math.PI) / 180;
  return ((2 * e.distance * Math.tan(fov / 2)) / heightPx) * snapPx;
}

const pointOf = (e: ThreeEvent<PointerEvent>): Vec3 => [e.point.x, e.point.y, e.point.z];

export function onMeasurePointerDown(obj: SceneObject, e: ThreeEvent<PointerEvent>): void {
  const measure = useMeasureStore.getState();
  if (measure.mode === 'capacity') {
    useKuraStore.getState().selectObject(obj.id, false);
    return;
  }
  measure.pick(obj, pointOf(e), e.faceIndex ?? null, {
    snapRadiusMm: snapRadiusMm(e),
    noSnap: e.altKey,
    additive: e.shiftKey,
  });
}

export function onMeasurePointerMove(obj: SceneObject, e: ThreeEvent<PointerEvent>): void {
  const measure = useMeasureStore.getState();
  if (measure.mode === 'capacity' || measure.mode === 'area') {
    measure.setHover(null);
    return;
  }
  e.stopPropagation();
  measure.setHover(obj, pointOf(e), e.faceIndex ?? null, snapRadiusMm(e), e.altKey);
}

export function onMeasurePointerOut(): void {
  useMeasureStore.getState().setHover(null);
}

/** true si el clic derecho canceló un punto en curso (y no debe abrir el menú contextual). */
export function onMeasureContextMenu(): boolean {
  return useMeasureStore.getState().cancelPending();
}
