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
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('.kura-sidebar-right');
    const check = () => setVisible(Boolean(el && el.isConnected && el.offsetWidth >= MIN_VISIBLE_WIDTH));
    check();
    window.addEventListener('resize', check);
    const observer = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    if (el && observer) observer.observe(el);
    return () => {
      window.removeEventListener('resize', check);
      observer?.disconnect();
    };
  }, [rightCollapsed, density, aiOpen]);

  return visible;
}
