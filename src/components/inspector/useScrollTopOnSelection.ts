/**
 * @file src/components/inspector/useScrollTopOnSelection.ts
 * @description Al cambiar el objeto seleccionado, el área desplazable del inspector vuelve arriba para que
 * el nombre y el tipo del objeto nuevo queden a la vista; con la misma selección no toca el desplazamiento.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useLayoutEffect, useRef } from 'react';

/** Devuelve la ref del contenedor desplazable; `key` identifica la selección (p. ej. el id del objeto). */
export function useScrollTopOnSelection<T extends HTMLElement = HTMLDivElement>(key: string | null) {
  const ref = useRef<T | null>(null);
  const last = useRef<string | null>(key);
  useLayoutEffect(() => {
    if (last.current === key) return;
    last.current = key;
    if (ref.current) ref.current.scrollTop = 0;
  }, [key]);
  return ref;
}
