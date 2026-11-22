/**
 * @file src/components/viewport/useObjectContextMenu.ts
 * @description Hook del menú contextual del visor: posición acotada al visor, cierre con Escape o clic externo y objeto destino.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useKuraStore } from '../../store/useKuraStore';
import { type ContextMenuState } from './viewportHelpers';

/** Estado y lógica del menú contextual sobre objetos del visor. */
export function useObjectContextMenu(viewportRef: React.RefObject<HTMLElement | null>) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const selectObject = useKuraStore((s) => s.selectObject);
  const objects = useKuraStore((s) => s.objects);

  const handleObjectContextMenu = useCallback(
    (objectId: string, clientX: number, clientY: number) => {
      if (!useKuraStore.getState().selectedIds.includes(objectId)) {
        selectObject(objectId, false);
      }
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;
      const clampedX = Math.max(8, Math.min(rawX, Math.max(8, rect.width - 256)));
      const clampedY = Math.max(8, Math.min(rawY, Math.max(8, rect.height - 490)));
      setContextMenu({ objectId, x: clampedX, y: clampedY });
    },
    [selectObject],
  );

  // Cerrar menú contextual con Escape o clic externo
  useEffect(() => {
    if (!contextMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.kura-context-menu')) {
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [contextMenu]);

  const ctxTarget = contextMenu
    ? objects.find((o) => o.id === contextMenu.objectId) ?? null
    : null;

  return { contextMenu, setContextMenu, ctxTarget, handleObjectContextMenu };
}
