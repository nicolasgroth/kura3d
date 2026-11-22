/**
 * @file src/components/viewport/useGizmoDrag.ts
 * @description Lógica no visual del gizmo del visor: modificadores Shift/Ctrl/Alt en vivo y ciclo de
 * arrastre (inicio, cancelación con Escape o al cambiar de herramienta/modo, remontaje del gizmo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useKuraStore } from '../../store/useKuraStore';
import type { Vec3 } from '../../types/kura';

/** Rastrea Shift / Ctrl / Alt en tiempo real para modificadores de Gizmo (snap, escala uniforme, Alt-clon). */
export function useGizmoModifiers() {
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const modifiersRef = useRef<{ shift: boolean; ctrl: boolean; alt: boolean }>({
    shift: false,
    ctrl: false,
    alt: false,
  });

  useEffect(() => {
    const syncMods = (e: KeyboardEvent | PointerEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      modifiersRef.current = {
        shift: e.shiftKey,
        ctrl,
        alt: e.altKey,
      };
      setCtrlHeld((prev) => (prev === ctrl ? prev : ctrl));
    };
    const clearMods = () => {
      modifiersRef.current = { shift: false, ctrl: false, alt: false };
      setCtrlHeld(false);
    };
    window.addEventListener('keydown', syncMods);
    window.addEventListener('keyup', syncMods);
    window.addEventListener('pointerdown', syncMods, true);
    window.addEventListener('blur', clearMods);
    return () => {
      window.removeEventListener('keydown', syncMods);
      window.removeEventListener('keyup', syncMods);
      window.removeEventListener('pointerdown', syncMods, true);
      window.removeEventListener('blur', clearMods);
    };
  }, []);

  return { modifiersRef, ctrlHeld };
}

/**
 * Estado del arrastre del gizmo. Cancelar = Escape, o cambio de herramienta/modo a mitad de arrastre:
 * descarta el snapshot pendiente y remonta el gizmo (`gizmoEpoch`) para abortar TransformControls.
 */
export function useGizmoDrag() {
  const activeTool = useKuraStore((s) => s.activeTool);
  const transformMode = useKuraStore((s) => s.transformMode);
  const cancelTransformSnapshot = useKuraStore((s) => s.cancelTransformSnapshot);
  const [isTransforming, setIsTransforming] = useState(false);
  const [gizmoEpoch, setGizmoEpoch] = useState(0);
  const dragStartScaleRef = useRef<Vec3 | null>(null);

  const isTransformingRef = useRef(false);
  isTransformingRef.current = isTransforming;
  const cancelGizmoDrag = useCallback(() => {
    if (!isTransformingRef.current) return;
    isTransformingRef.current = false;
    cancelTransformSnapshot();
    dragStartScaleRef.current = null;
    setIsTransforming(false);
    // Remonta el gizmo para abortar el arrastre interno de TransformControls.
    setGizmoEpoch((n) => n + 1);
  }, [cancelTransformSnapshot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTransformingRef.current) {
        e.preventDefault();
        cancelGizmoDrag();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [cancelGizmoDrag]);

  useEffect(() => {
    cancelGizmoDrag();
  }, [activeTool, transformMode, cancelGizmoDrag]);

  return { isTransforming, setIsTransforming, gizmoEpoch, dragStartScaleRef, cancelGizmoDrag };
}
