/**
 * @file src/components/measure/useNarrowViewport.ts
 * @description Indica si la ventana es angosta (<= 900 px, el mismo corte que la disposición con hoja
 * inferior) y se actualiza al cambiar de tamaño.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useEffect, useState } from 'react';

const QUERY = '(max-width: 900px)';

export function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}
