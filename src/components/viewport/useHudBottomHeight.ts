/**
 * @file src/components/viewport/useHudBottomHeight.ts
 * @description Publica la altura real del pie del visor en `--kura-hud-bottom-h` (en el contenedor del visor) para
 * que la píldora de Consejo se apoye siempre encima del pie, tenga una, dos o tres filas, sin solaparlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useLayoutEffect, type RefObject } from 'react';

export function useHudBottomHeight(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return undefined;
    const publish = () => host.style.setProperty('--kura-hud-bottom-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      host.style.removeProperty('--kura-hud-bottom-h');
    };
  }, [ref]);
}
