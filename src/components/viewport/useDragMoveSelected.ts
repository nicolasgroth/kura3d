/**
 * @file src/components/viewport/useDragMoveSelected.ts
 * @description Arrastrar el cuerpo de un objeto ya seleccionado lo mueve sobre el plano horizontal que pasa
 * por el punto agarrado (rayo de cámara ∩ plano). Mueve todos los seleccionados sin bloquear, respeta el paso
 * de rejilla, se cancela con Escape y se confirma como un solo paso de deshacer. Sin arrastre (menos de ~4 px)
 * el gesto es un clic normal. La matemática vive en `core/scene/dragMovePlane`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { DRAG_MOVE_THRESHOLD_PX, dragMoveDelta } from '../../core/scene/dragMovePlane';
import { t } from '../../i18n';
import { useGizmoDragStore } from '../../store/gizmoDragStore';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject, Vec3 } from '../../types/kura';

type Baseline = Array<Pick<SceneObject, 'id' | 'position' | 'rotation' | 'scale'>>;

interface Session {
  pointerId: number;
  startX: number;
  startY: number;
  grab: Vec3;
  baseline: Baseline;
  reference: Vec3;
  lastDelta: Vec3;
  active: boolean;
  onClick: () => void;
}

export interface DragMoveApi {
  /** Hay un arrastre de movimiento en curso (más allá del umbral). */
  isDragMoving: boolean;
  /** Empieza un gesto sobre un objeto ya seleccionado; `onClick` se ejecuta si el gesto termina sin arrastre. */
  startDragMove: (e: ThreeEvent<PointerEvent>, onClick: () => void) => void;
}

const ZERO: Vec3 = [0, 0, 0];

export function useDragMoveSelected(orbitRef: React.RefObject<OrbitControlsImpl | null>): DragMoveApi {
  const camera = useThree((s) => s.camera);
  const canvas = useThree((s) => s.gl.domElement);
  const [isDragMoving, setIsDragMoving] = useState(false);
  const session = useRef<Session | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  // Tras cancelar con el botón aún pulsado, la cámara sigue apagada hasta soltar (si no, giraría sola).
  const releaseOrbitOnUp = useRef(false);

  const finish = useCallback(
    (mode: 'commit' | 'cancel', fromRelease = true) => {
      const s = session.current;
      if (!s) return;
      session.current = null;
      const store = useKuraStore.getState();
      if (s.active) {
        if (mode === 'commit') store.commitTransformSnapshot();
        else store.cancelTransformSnapshot();
        useGizmoDragStore.getState().end();
      } else if (mode === 'commit') {
        s.onClick();
      }
      canvas.style.cursor = '';
      if (fromRelease && orbitRef.current) orbitRef.current.enabled = true;
      else releaseOrbitOnUp.current = true;
      setIsDragMoving(false);
    },
    [canvas, orbitRef],
  );

  const startDragMove = useCallback(
    (e: ThreeEvent<PointerEvent>, onClick: () => void) => {
      const state = useKuraStore.getState();
      const baseline: Baseline = state.objects
        .filter((o) => state.selectedIds.includes(o.id))
        .map((o) => ({ id: o.id, position: [...o.position] as Vec3, rotation: [...o.rotation] as Vec3, scale: [...o.scale] as Vec3 }));
      const firstMovable = state.objects.find((o) => state.selectedIds.includes(o.id) && !o.locked);
      session.current = {
        pointerId: e.pointerId,
        startX: e.nativeEvent.clientX,
        startY: e.nativeEvent.clientY,
        grab: [e.point.x, e.point.y, e.point.z],
        baseline,
        reference: firstMovable ? ([...firstMovable.position] as Vec3) : ZERO,
        lastDelta: ZERO,
        active: false,
        onClick,
      };
      // OrbitControls ya vio este pointerdown: se apaga para que el gesto no gire la cámara.
      if (orbitRef.current) orbitRef.current.enabled = false;
    },
    [orbitRef],
  );

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const s = session.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      if (!s.active) {
        if (Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) < DRAG_MOVE_THRESHOLD_PX) return;
        const store = useKuraStore.getState();
        const anyMovable = store.objects.some((o) => store.selectedIds.includes(o.id) && !o.locked);
        if (!anyMovable) {
          store.addToast(t(store.language, 'ux10.drag.locked'), 'info');
          finish('cancel', false);
          return;
        }
        s.active = true;
        useGizmoDragStore.getState().begin();
        canvas.style.cursor = 'grabbing';
        setIsDragMoving(true);
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.current.setFromCamera(ndc, camera);
      const { origin, direction } = raycaster.current.ray;
      const store = useKuraStore.getState();
      const snap = store.snapGridMm > 0 ? store.snapGridMm : ev.ctrlKey || ev.metaKey ? 1 : 0;
      const delta = dragMoveDelta({
        rayOrigin: [origin.x, origin.y, origin.z],
        rayDir: [direction.x, direction.y, direction.z],
        grab: s.grab,
        reference: s.reference,
        snapMm: snap,
      });
      // Vista rasante o rayo que no alcanza el plano: se conserva la última posición válida.
      if (delta) s.lastDelta = delta;
      store.transformSelectionRigid({ translate: s.lastDelta }, { baseline: s.baseline });
    };
    const onUp = (ev: PointerEvent) => {
      const s = session.current;
      if (s && ev.pointerId === s.pointerId) finish(ev.type === 'pointercancel' ? 'cancel' : 'commit');
      else if (!s && releaseOrbitOnUp.current) {
        releaseOrbitOnUp.current = false;
        if (orbitRef.current) orbitRef.current.enabled = true;
      }
    };
    const onOtherDown = (ev: PointerEvent) => {
      const s = session.current;
      // Un segundo dedo es un gesto de cámara: se abandona el movimiento.
      if (s && ev.pointerId !== s.pointerId) finish('cancel', false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !session.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      finish('cancel', false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('pointerdown', onOtherDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('pointerdown', onOtherDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [camera, canvas, finish, orbitRef]);

  return { isDragMoving, startDragMove };
}
