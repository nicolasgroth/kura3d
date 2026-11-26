/**
 * @file src/components/useAiDrawerLayout.ts
 * @description Disposición del panel flotante de IA en escritorio: publica en el área de trabajo el ancho del
 * inspector (el panel se apoya junto a él, sin cubrirlo) y el espacio que el panel reserva en el visor (para que los
 * controles del HUD se reubiquen). Al abrirse, el encuadre solo se mueve si el objeto seleccionado queda tapado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useEffect, useLayoutEffect } from 'react';
import { useKuraStore } from '../store/useKuraStore';

const WIDE_QUERY = '(min-width: 901px)';

export function useAiDrawerLayout(open: boolean): void {
  useLayoutEffect(() => {
    if (!open) return undefined;
    const workspace = document.querySelector<HTMLElement>('.kura-workspace');
    if (!workspace) return undefined;
    const inspector = workspace.querySelector<HTMLElement>(':scope > .kura-sidebar-right');
    const drawer = workspace.querySelector<HTMLElement>(':scope > .kura-ai-drawer');
    const apply = () => {
      workspace.style.setProperty('--kura-ai-inspector-w', `${inspector?.getBoundingClientRect().width ?? 0}px`);
      workspace.style.setProperty('--kura-ai-reserve', `${(drawer?.getBoundingClientRect().width ?? 0) + 30}px`);
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(apply);
    if (inspector) observer.observe(inspector);
    if (drawer) observer.observe(drawer);
    return () => {
      observer.disconnect();
      workspace.style.removeProperty('--kura-ai-inspector-w');
      workspace.style.removeProperty('--kura-ai-reserve');
    };
  }, [open]);

  // Al abrir el panel la cámara no se mueve; solo si el objeto seleccionado queda tapado se vuelve a encuadrar.
  useEffect(() => {
    if (!open || !window.matchMedia?.(WIDE_QUERY).matches) return undefined;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const { selectedIds, requestCameraPreset } = useKuraStore.getState();
        if (selectedIds.length > 0) requestCameraPreset('ensure', selectedIds);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [open]);
}
