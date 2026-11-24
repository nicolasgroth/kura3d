/**
 * @file src/components/viewport/magnetCursor.ts
 * @description Cursor en cruz de la capa de colocación del imán: lo pone al entrar a una pieza y lo quita al salir
 * y al desmontarse la capa (si el panel se cierra con el puntero encima, no queda pegado).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';

export interface MagnetCursorHandlers {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerLeave: () => void;
}

export function useMagnetCursor(): MagnetCursorHandlers {
  const target = useRef<HTMLElement | null>(null);
  const clear = useCallback(() => {
    if (target.current) target.current.style.cursor = '';
    target.current = null;
  }, []);
  const onPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    const el = e.nativeEvent.target;
    if (!(el instanceof HTMLElement)) return;
    target.current = el;
    el.style.cursor = 'crosshair';
  }, []);
  useEffect(() => clear, [clear]);
  return { onPointerOver, onPointerLeave: clear };
}
