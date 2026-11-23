/**
 * @file src/components/measure/useCoarsePointer.ts
 * @description Indica si el dispositivo principal de entrada es táctil (`(pointer: coarse)`): ahí las ayudas no
 * mencionan teclas ni clic derecho y se ofrecen botones en su lugar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect, useState } from 'react';

const QUERY = '(pointer: coarse)';

export const isCoarsePointer = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.(QUERY).matches);

export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(isCoarsePointer);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(QUERY);
    const on = () => setCoarse(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return coarse;
}
