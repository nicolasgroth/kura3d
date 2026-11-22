/**
 * @file src/components/viewport/usePaintStroke.ts
 * @description Lógica no visual del trazo de pintura en el visor: marca el arrastre de pincel y
 * cierra el trazo del store al soltar el puntero en cualquier parte de la ventana.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect, useState } from 'react';
import { useKuraStore } from '../../store/useKuraStore';

/** Devuelve si hay un trazo de pintura en curso y su setter; el trazo termina con cualquier pointerup global. */
export function usePaintStroke() {
  const [isPaintingDrag, setIsPaintingDrag] = useState(false);

  useEffect(() => {
    const onGlobalPointerUp = () => {
      setIsPaintingDrag(false);
      useKuraStore.getState().endPaintStroke();
    };
    window.addEventListener('pointerup', onGlobalPointerUp);
    return () => window.removeEventListener('pointerup', onGlobalPointerUp);
  }, []);

  return { isPaintingDrag, setIsPaintingDrag };
}
