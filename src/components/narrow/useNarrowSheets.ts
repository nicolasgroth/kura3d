/**
 * @file src/components/narrow/useNarrowSheets.ts
 * @description Estado de la hoja inferior en pantallas estrechas (<= 900 px): solo una hoja a la vez
 * (Formas, Inspector, chat de IA o un panel de operación como Medir), con tres alturas. Abrir una hoja
 * reemplaza la anterior y arranca en altura media; tocar el visor para actuar la pliega.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useKuraStore } from '../../store/useKuraStore';
import { useMeasureStore } from '../../store/measureStore';
import { requestLeftPanelTab } from '../leftPanelTabRequest';
import type { SheetHeight } from './sheetHeight';

const NARROW_QUERY = '(max-width: 900px)';

export const isNarrowViewport = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.(NARROW_QUERY).matches);

/** Cierra el panel de operación abierto (Medir, Cortar, Rosca…) con su propio botón de cierre. */
function closeOperationPanel(): void {
  document.querySelector<HTMLElement>('#kura-op-slot .kura-op-panel-header button')?.click();
}

export type NarrowSheetKind = 'left' | 'right' | 'ai' | 'op' | null;

export function useNarrowSheets() {
  const aiDrawerOpen = useKuraStore((s) => s.aiDrawerOpen);
  const [panel, setPanel] = useState<'left' | 'right' | null>(null);
  const [height, setHeight] = useState<SheetHeight>('half');
  const [opTitle, setOpTitle] = useState<string | null>(null);
  const opOpenRef = useRef(false);

  // Detecta el panel de operación montado en el destino `#kura-op-slot` y lee su título.
  useEffect(() => {
    const slot = document.getElementById('kura-op-slot');
    if (!slot) return;
    const read = () => {
      const heading = slot.querySelector('.kura-op-panel .kura-dialog-title');
      setOpTitle(heading ? (heading.textContent ?? '') : null);
    };
    const observer = new MutationObserver(read);
    observer.observe(slot, { childList: true, subtree: true, characterData: true });
    read();
    return () => observer.disconnect();
  }, []);

  // Un panel de operación nuevo reemplaza la hoja abierta y arranca en altura media.
  useEffect(() => {
    const open = opTitle !== null;
    if (open && !opOpenRef.current && isNarrowViewport()) {
      if (useKuraStore.getState().aiDrawerOpen) useKuraStore.getState().setAiDrawerOpen(false);
      setPanel(null);
      setHeight('half');
    }
    opOpenRef.current = open;
  }, [opTitle]);

  // Abrir el chat de IA reemplaza el panel de operación y arranca en altura media.
  useEffect(() => {
    if (!aiDrawerOpen || !isNarrowViewport()) return;
    closeOperationPanel();
    setHeight('half');
  }, [aiDrawerOpen]);

  // Tocar el visor para actuar (medir, pintar, mover) pliega la hoja y deja el visor libre.
  useEffect(() => {
    // Se pliega al soltar, no al tocar: cambiar el tamaño del visor a mitad de un gesto movería el
    // manipulador bajo el dedo.
    let armed = false;
    const onPointerDown = (e: PointerEvent) => {
      armed = isNarrowViewport() && e.target instanceof Element && Boolean(e.target.closest('canvas'));
    };
    const onPointerEnd = () => {
      if (!armed) return;
      armed = false;
      // Con un punto de medición pendiente la hoja conserva su altura: plegarla cambiaría el tamaño del
      // visor entre los dos toques y desplazaría el segundo punto.
      if (useMeasureStore.getState().pending.length > 0) return;
      setHeight('folded');
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerEnd, true);
    window.addEventListener('pointercancel', onPointerEnd, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerEnd, true);
      window.removeEventListener('pointercancel', onPointerEnd, true);
    };
  }, []);

  const visible: NarrowSheetKind = aiDrawerOpen ? 'ai' : panel ?? (opTitle !== null ? 'op' : null);

  /** Abre Formas o Inspector (reemplaza cualquier otra hoja) en altura media. */
  const open = useCallback((next: 'left' | 'right') => {
    const state = useKuraStore.getState();
    if (state.aiDrawerOpen) state.setAiDrawerOpen(false);
    closeOperationPanel();
    if (next === 'left') requestLeftPanelTab('shapes');
    setPanel(next);
    setHeight('half');
  }, []);

  /** Abre una hoja sin forzar la pestaña (F2/F3, menú contextual, atajos de transformación). */
  const reveal = useCallback((next: 'left' | 'right') => {
    const state = useKuraStore.getState();
    if (state.aiDrawerOpen) state.setAiDrawerOpen(false);
    closeOperationPanel();
    setPanel(next);
    setHeight('half');
  }, []);

  /** Tocar Formas o Inspector: si ya está abierta se cierra; si no, la abre. */
  const toggle = useCallback(
    (next: 'left' | 'right') => {
      if (visible === next) {
        setPanel(null);
        return;
      }
      open(next);
    },
    [open, visible],
  );

  const close = useCallback(() => {
    const state = useKuraStore.getState();
    if (state.aiDrawerOpen) state.setAiDrawerOpen(false);
    closeOperationPanel();
    setPanel(null);
    setHeight('half');
  }, []);

  return { visible, opTitle, height, setHeight, open, reveal, toggle, close };
}
