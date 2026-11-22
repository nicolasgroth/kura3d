/**
 * @file src/components/viewport/paintStrokeController.ts
 * @description Trazo del pincel por el store (camino con borde fino o relleno): abre UN trazo de
 * historial en el pointerdown y solo pinta mientras ese trazo siga abierto. Sobre una primitiva o rosca
 * que el trazo dejaría sin parámetros, el arrastre no modifica nada: se capturan los puntos, se pregunta
 * al soltar y solo con consentimiento se aplica el trazo capturado (en un solo paso de historial).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject, Vec3 } from '../../types/kura';
import { afterPointerRelease, confirmPaintOnParametric, paintWouldDropParameters } from './paintParametricGuard';

interface Sample {
  point: Vec3;
  faceIndex: number | null;
}

/** Trazo retenido a la espera del consentimiento (objeto y muestras capturadas). */
let held: { objectId: string; samples: Sample[] } | null = null;

/**
 * Empieza el trazo. Devuelve una promesa solo si quedó retenido esperando el aviso (se resuelve al
 * responder); `waitRelease` permite a las pruebas no esperar el pointerup real.
 */
export function startStorePaintStroke(
  obj: SceneObject,
  point: Vec3,
  faceIndex: number | null,
  refine: boolean,
  waitRelease: () => Promise<void> = afterPointerRelease,
): Promise<void> | undefined {
  const store = useKuraStore.getState();
  if (store.paintMode === 'brush' && paintWouldDropParameters(obj, refine)) {
    const capture = { objectId: obj.id, samples: [{ point, faceIndex }] };
    held = capture;
    const language = store.language;
    return waitRelease()
      .then(() => confirmPaintOnParametric(obj, language))
      .then((ok) => {
        if (held === capture) held = null;
        if (ok) applySamples(obj.id, capture.samples);
      });
  }
  held = null;
  store.beginPaintStroke();
  store.paintObjectSurface(obj.id, point, faceIndex);
  return undefined;
}

/** Muestra siguiente del arrastre: se captura si el trazo está retenido; si no hay trazo abierto, se ignora. */
export function continueStorePaintStroke(objectId: string, point: Vec3, faceIndex: number | null): void {
  if (held) {
    if (held.objectId === objectId) held.samples.push({ point, faceIndex });
    return;
  }
  const store = useKuraStore.getState();
  if (!store.isPaintStrokeOpen()) return;
  store.paintObjectSurface(objectId, point, faceIndex);
}

/** Aplica de una vez un trazo capturado, como un único paso de historial. */
function applySamples(objectId: string, samples: Sample[]): void {
  const store = useKuraStore.getState();
  store.beginPaintStroke();
  try {
    for (const s of samples) useKuraStore.getState().paintObjectSurface(objectId, s.point, s.faceIndex);
  } finally {
    useKuraStore.getState().endPaintStroke();
  }
}

/** Solo para pruebas. */
export function resetPaintStrokeController(): void {
  held = null;
}
