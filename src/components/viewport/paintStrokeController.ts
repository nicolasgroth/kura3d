/**
 * @file src/components/viewport/paintStrokeController.ts
 * @description Trazo del pincel por el store (camino con borde fino o relleno): abre UN trazo de
 * historial en el pointerdown y solo pinta mientras ese trazo siga abierto. Sobre una primitiva o rosca
 * que el trazo dejaría sin parámetros, el arrastre no modifica nada: se capturan los puntos, se pregunta
 * al soltar y solo con consentimiento se aplica el trazo capturado (en un solo paso de historial). Cada
 * muestra lleva su vista (cámara y cara bajo el puntero), así el trazo diferido respeta la misma regla
 * de visibilidad que el inmediato.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useKuraStore } from '../../store/useKuraStore';
import type { BrushView } from '../../engine/paint/brushSelect';
import type { SceneObject, Vec3 } from '../../types/kura';
import { afterPointerRelease, confirmPaintOnParametric, paintWouldDropParameters } from './paintParametricGuard';

/** Muestra del trazo: punto local, cara bajo el puntero y vista desde la que se pintó. */
export interface StrokeSample {
  point: Vec3;
  faceIndex: number | null;
  view?: BrushView;
}

/** Trazo retenido a la espera del consentimiento (objeto y muestras capturadas). */
let held: { objectId: string; samples: StrokeSample[] } | null = null;

/**
 * Empieza el trazo. Devuelve una promesa solo si quedó retenido esperando el aviso (se resuelve al
 * responder); `waitRelease` permite a las pruebas no esperar el pointerup real.
 */
export function startStorePaintStroke(
  obj: SceneObject,
  sample: StrokeSample,
  refine: boolean,
  waitRelease: () => Promise<void> = afterPointerRelease,
): Promise<void> | undefined {
  const store = useKuraStore.getState();
  if (store.paintMode === 'brush' && paintWouldDropParameters(obj, refine)) {
    const capture = { objectId: obj.id, samples: [sample] };
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
  paintSample(obj.id, sample);
  return undefined;
}

/** Muestra siguiente del arrastre: se captura si el trazo está retenido; si no hay trazo abierto, se ignora. */
export function continueStorePaintStroke(objectId: string, sample: StrokeSample): void {
  if (held) {
    if (held.objectId === objectId) held.samples.push(sample);
    return;
  }
  if (!useKuraStore.getState().isPaintStrokeOpen()) return;
  paintSample(objectId, sample);
}

function paintSample(objectId: string, s: StrokeSample): void {
  useKuraStore.getState().paintObjectSurface(objectId, s.point, s.faceIndex, undefined, s.view);
}

/** Aplica de una vez un trazo capturado, como un único paso de historial. */
function applySamples(objectId: string, samples: StrokeSample[]): void {
  const store = useKuraStore.getState();
  store.beginPaintStroke();
  try {
    for (const s of samples) paintSample(objectId, s);
  } finally {
    useKuraStore.getState().endPaintStroke();
  }
}

/** Solo para pruebas. */
export function resetPaintStrokeController(): void {
  held = null;
}
