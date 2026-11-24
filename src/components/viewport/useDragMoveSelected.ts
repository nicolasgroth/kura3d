/**
 * @file src/components/viewport/useDragMoveSelected.ts
 * @description Arrastrar el cuerpo de un objeto ya seleccionado lo mueve sobre el plano horizontal que pasa
 * por el punto agarrado (rayo de cámara ∩ plano). Mueve todos los seleccionados sin bloquear, respeta el paso
 * de rejilla, se cancela con Escape, al perder el foco o el puntero, y se confirma como un solo paso de
 * deshacer. Sin arrastre (menos de ~4 px) el gesto es un clic normal; un gesto "solo clic" (`moveEnabled:
 * false`) deja a la cámara orbitar y no cambia la selección si el puntero se arrastra. Los movimientos se
 * agrupan por cuadro. La matemática vive en `core/scene/dragMovePlane`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useCallback, useEffect, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { DRAG_MOVE_THRESHOLD_PX, dragMoveDelta, dragSnapMm } from '../../core/scene/dragMovePlane';
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
  /** false: gesto de solo clic; al pasar el umbral se abandona sin tocar la cámara ni la selección. */
  moveEnabled: boolean;
  rect: DOMRect | null;
  previousCursor: string;
  onClick: () => void;
}

interface PendingMove {
  x: number;
  y: number;
  ctrl: boolean;
}

export interface DragMoveOptions {
  moveEnabled?: boolean;
}

export interface DragMoveApi {
  /** Empieza un gesto sobre un objeto; `onClick` se ejecuta si el gesto termina sin arrastre. */
  startDragMove: (e: ThreeEvent<PointerEvent>, onClick: () => void, options?: DragMoveOptions) => void;
}

const ZERO: Vec3 = [0, 0, 0];

export function useDragMoveSelected(orbitRef: React.RefObject<OrbitControlsImpl | null>): DragMoveApi {
  const camera = useThree((s) => s.camera);
  const canvas = useThree((s) => s.gl.domElement);
  const session = useRef<Session | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const ndcRef = useRef(new THREE.Vector2());
  const pending = useRef<PendingMove | null>(null);
  const frame = useRef(0);
  // Tras cancelar con el botón aún pulsado, la cámara sigue apagada hasta soltar (si no, giraría sola).
  const releaseOrbitOnUp = useRef(false);

  const finish = useCallback(
    (mode: 'commit' | 'cancel', fromRelease = true) => {
      const s = session.current;
      if (!s) return;
      if (frame.current) {
        cancelAnimationFrame(frame.current);
        frame.current = 0;
      }
      session.current = null;
      const store = useKuraStore.getState();
      if (s.active) {
        if (mode === 'commit') store.commitTransformSnapshot();
        else store.cancelTransformSnapshot();
        useGizmoDragStore.getState().end();
        canvas.style.cursor = s.previousCursor;
      } else if (mode === 'commit') {
        s.onClick();
      }
      try {
        canvas.releasePointerCapture?.(s.pointerId);
      } catch {
        /* sin captura */
      }
      if (s.moveEnabled) {
        if (fromRelease && orbitRef.current) orbitRef.current.enabled = true;
        else releaseOrbitOnUp.current = true;
      }
    },
    [canvas, orbitRef],
  );
  const finishRef = useRef(finish);
  finishRef.current = finish;

  /** Aplica la última posición del puntero. Devuelve false si el gesto dejó de tener sentido. */
  const applyPending = useCallback(() => {
    frame.current = 0;
    const s = session.current;
    const p = pending.current;
    pending.current = null;
    if (!s || !s.active || !p || !s.rect) return;
    const store = useKuraStore.getState();
    // Objeto borrado o herramienta cambiada a mitad del gesto: se cancela en vez de seguir moviendo.
    if (store.activeTool !== 'select' || !s.baseline.some((b) => store.objects.some((o) => o.id === b.id))) {
      finish('cancel', false);
      return;
    }
    const { rect } = s;
    if (rect.width <= 0 || rect.height <= 0) return;
    const ndc = ndcRef.current.set(((p.x - rect.left) / rect.width) * 2 - 1, -((p.y - rect.top) / rect.height) * 2 + 1);
    const raycaster = (raycasterRef.current ??= new THREE.Raycaster());
    raycaster.setFromCamera(ndc, camera);
    const { origin, direction } = raycaster.ray;
    const delta = dragMoveDelta({
      rayOrigin: [origin.x, origin.y, origin.z],
      rayDir: [direction.x, direction.y, direction.z],
      grab: s.grab,
      reference: s.reference,
      snapMm: dragSnapMm(store.snapGridMm, p.ctrl),
    });
    // Vista rasante o rayo que no alcanza el plano: se conserva la última posición válida.
    if (delta) s.lastDelta = delta;
    store.transformSelectionRigid({ translate: s.lastDelta }, { baseline: s.baseline });
  }, [camera, finish]);
  const applyRef = useRef(applyPending);
  applyRef.current = applyPending;

  const startDragMove = useCallback(
    (e: ThreeEvent<PointerEvent>, onClick: () => void, options?: DragMoveOptions) => {
      const moveEnabled = options?.moveEnabled ?? true;
      const state = useKuraStore.getState();
      const baseline: Baseline = moveEnabled
        ? state.objects
            .filter((o) => state.selectedIds.includes(o.id))
            .map((o) => ({ id: o.id, position: [...o.position] as Vec3, rotation: [...o.rotation] as Vec3, scale: [...o.scale] as Vec3 }))
        : [];
      const firstMovable = moveEnabled ? state.objects.find((o) => state.selectedIds.includes(o.id) && !o.locked) : undefined;
      session.current = {
        pointerId: e.pointerId,
        startX: e.nativeEvent.clientX,
        startY: e.nativeEvent.clientY,
        grab: [e.point.x, e.point.y, e.point.z],
        baseline,
        reference: firstMovable ? ([...firstMovable.position] as Vec3) : ZERO,
        lastDelta: ZERO,
        active: false,
        moveEnabled,
        rect: null,
        previousCursor: '',
        onClick,
      };
      if (!moveEnabled) return;
      // OrbitControls ya vio este pointerdown: se apaga para que el gesto no gire la cámara.
      if (orbitRef.current) orbitRef.current.enabled = false;
      try {
        canvas.setPointerCapture?.(e.pointerId);
      } catch {
        /* el puntero ya no está activo */
      }
    },
    [canvas, orbitRef],
  );

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const s = session.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      if (!s.active) {
        if (Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) < DRAG_MOVE_THRESHOLD_PX) return;
        if (!s.moveEnabled) {
          // La cámara orbita: no es un clic, la selección no cambia.
          session.current = null;
          return;
        }
        const store = useKuraStore.getState();
        const anyMovable = store.objects.some((o) => store.selectedIds.includes(o.id) && !o.locked);
        if (!anyMovable) {
          store.addToast(t(store.language, 'ux10.drag.locked'), 'info');
          finish('cancel', false);
          return;
        }
        s.active = true;
        s.rect = canvas.getBoundingClientRect();
        s.previousCursor = canvas.style.cursor === 'grabbing' ? '' : canvas.style.cursor;
        useGizmoDragStore.getState().begin();
        canvas.style.cursor = 'grabbing';
      }
      pending.current = { x: ev.clientX, y: ev.clientY, ctrl: ev.ctrlKey || ev.metaKey };
      if (!frame.current) frame.current = requestAnimationFrame(() => applyRef.current());
    };
    const onUp = (ev: PointerEvent) => {
      const s = session.current;
      if (s && ev.pointerId === s.pointerId) {
        // Al confirmar se aplica la última posición aunque el cuadro no haya corrido.
        if (ev.type !== 'pointercancel' && s.active && pending.current) {
          if (frame.current) {
            cancelAnimationFrame(frame.current);
            frame.current = 0;
          }
          applyRef.current();
        }
        finish(ev.type === 'pointercancel' ? 'cancel' : 'commit');
      } else if (!s && releaseOrbitOnUp.current) {
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
    const onBlur = () => finish('cancel', false);
    const onLostCapture = (ev: PointerEvent) => {
      if (session.current && ev.pointerId === session.current.pointerId) finish('cancel', false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('pointerdown', onOtherDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('lostpointercapture', onLostCapture);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('pointerdown', onOtherDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('lostpointercapture', onLostCapture);
    };
  }, [canvas, finish, orbitRef]);

  // Desmontaje a mitad del gesto: se cancela (cierra snapshot y gizmoDrag) y la cámara vuelve a quedar activa.
  useEffect(
    () => () => {
      finishRef.current('cancel', true);
      releaseOrbitOnUp.current = false;
      if (orbitRef.current) orbitRef.current.enabled = true;
    },
    [orbitRef],
  );

  return { startDragMove };
}
