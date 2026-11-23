/**
 * @file src/components/scene/RowContextMenuHost.tsx
 * @description Atiende las peticiones de menú contextual de las filas del árbol de Escena (clic derecho,
 * Mayús+F10, tecla Menú) y abre el menú del objeto o del grupo junto a la fila, no dentro del visor: se pinta
 * en un portal sobre toda la ventana con coordenadas de pantalla. Escape o un clic fuera lo cierran y el
 * foco vuelve al árbol.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContextMenuRequest, type ContextMenuRequest } from '../../store/contextMenuRequest';
import { useKuraStore } from '../../store/useKuraStore';
import { ObjectContextMenu } from '../viewport/ObjectContextMenu';
import { GroupContextMenu } from './GroupContextMenu';
import '../../styles/rowContextMenu.css';

/** Ancho del menú (coincide con `contextMenuFit.css`) para acotarlo a la ventana. */
const MENU_WIDTH = 300;

export const RowContextMenuHost: React.FC = () => {
  const request = useContextMenuRequest((s) => s.request);
  const [open, setOpen] = useState<ContextMenuRequest | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const target = useKuraStore((s) => (open?.objectId ? s.objects.find((o) => o.id === open.objectId) ?? null : null));

  useEffect(() => {
    if (!request) return;
    useContextMenuRequest.getState().clear();
    returnFocus.current = request.returnFocus;
    setOpen(request);
  }, [request]);

  // Al cerrar, el foco vuelve al árbol.
  useEffect(() => {
    if (open || !returnFocus.current) return;
    const el = returnFocus.current;
    returnFocus.current = null;
    if (el.isConnected) el.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest('.kura-context-menu')) setOpen(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  const x = Math.max(8, Math.min(open.x, Math.max(8, window.innerWidth - MENU_WIDTH - 8)));
  const y = Math.max(8, open.y);
  const close = () => setOpen(null);
  const menu = open.groupId
    ? <GroupContextMenu groupId={open.groupId} x={x} y={y} onClose={close} />
    : target
      ? <ObjectContextMenu menu={{ objectId: target.id, x, y }} target={target} onClose={close} />
      : null;
  if (!menu) return null;
  return createPortal(<div className="kura-row-menu-layer">{menu}</div>, document.body);
};
