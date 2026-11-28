/**
 * @file src/components/plates/useListOverflow.ts
 * @description Detecta si una lista con desplazamiento horizontal continúa más allá de cada borde (para difuminarlo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useEffect, useState, type RefObject } from 'react';

export interface ListOverflow {
  start: boolean;
  end: boolean;
}

/** Sigue el desplazamiento y el tamaño de `ref`; `deps` repite la medición al cambiar el contenido. */
export function useListOverflow(ref: RefObject<HTMLElement | null>, deps: readonly unknown[]): ListOverflow {
  const [state, setState] = useState<ListOverflow>({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setState((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
