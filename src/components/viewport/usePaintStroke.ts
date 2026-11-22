/**
 * @file src/components/viewport/usePaintStroke.ts
 * @description Lógica no visual del trazo de pintura en el visor: marca el arrastre de pincel y
 * cierra el trazo (en vivo o del store) al soltar el puntero en cualquier parte de la ventana.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect, useState } from 'react';
import { useKuraStore } from '../../store/useKuraStore';
import { finishLiveStroke } from './livePaintStroke';

/** Devuelve si hay un trazo de pintura en curso y su setter; el trazo termina con cualquier pointerup global. */
export function usePaintStroke() {
  const [isPaintingDrag, setIsPaintingDrag] = useState(false);

  useEffect(() => {
    const onGlobalPointerUp = () => {
      setIsPaintingDrag(false);
      finishLiveStroke();
      useKuraStore.getState().endPaintStroke();
    };
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointercancel', onGlobalPointerUp);
    };
  }, []);

  return { isPaintingDrag, setIsPaintingDrag };
}
