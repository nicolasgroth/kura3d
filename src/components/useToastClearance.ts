/**
 * @file src/components/useToastClearance.ts
 * @description Publica el alto real de la pila de avisos del visor como `--kura-toast-clear` (alto + holgura), para
 * que las tarjetas flotantes del visor (p. ej. el control «Armado» de una división) se coloquen por encima y los
 * avisos apilados no las tapen. Sin avisos en la zona del visor la variable no existe (vale 0 en el CSS).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect, type RefObject } from 'react';

/** Holgura entre el último aviso y la tarjeta que queda encima (px). */
const CLEARANCE_GAP_PX = 32;

export function useToastClearance(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!active || !el) return undefined;
    const publish = () => root.style.setProperty('--kura-toast-clear', `${Math.ceil(el.getBoundingClientRect().height) + CLEARANCE_GAP_PX}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') return () => root.style.removeProperty('--kura-toast-clear');
    const observer = new ResizeObserver(publish);
    observer.observe(el, { box: 'border-box' });
    return () => {
      observer.disconnect();
      root.style.removeProperty('--kura-toast-clear');
    };
  }, [ref, active]);
}
