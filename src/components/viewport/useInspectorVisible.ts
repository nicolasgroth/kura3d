/**
 * @file src/components/viewport/useInspectorVisible.ts
 * @description Indica si el inspector derecho se ve en pantalla (no colapsado, no oculto por Zen,
 * por el chat ni por el ancho). Mide el elemento real porque su visibilidad depende del CSS.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useLayoutEffect, useState } from 'react';
import { useKuraStore } from '../../store/useKuraStore';

/** Ancho mínimo para considerar que el inspector está desplegado (no la franja colapsada). */
const MIN_VISIBLE_WIDTH = 120;

export function useInspectorVisible(): boolean {
  const rightCollapsed = useKuraStore((s) => s.rightCollapsed);
  const density = useKuraStore((s) => s.uiDensity);
  const aiOpen = useKuraStore((s) => s.aiDrawerOpen);
  // El inspector cambia de elemento según la selección (vacío, uno, varios): se vuelve a medir.
  const selectionSize = useKuraStore((s) => s.selectedIds.length);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const check = () => {
      const el = document.querySelector<HTMLElement>('.kura-sidebar-right');
      setVisible(Boolean(el && el.offsetWidth >= MIN_VISIBLE_WIDTH));
    };
    check();
    window.addEventListener('resize', check);
    const workspace = document.querySelector<HTMLElement>('.kura-workspace');
    const observer = workspace && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    if (workspace && observer) {
      observer.observe(workspace);
      for (const child of Array.from(workspace.children)) observer.observe(child);
    }
    return () => {
      window.removeEventListener('resize', check);
      observer?.disconnect();
    };
  }, [rightCollapsed, density, aiOpen, selectionSize]);

  return visible;
}
