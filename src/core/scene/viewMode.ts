/**
 * @file src/core/scene/viewMode.ts
 * @description Modos de vista Imprimir / Armado / Libre (lote P4 de `docs/diseno/PLACAS_Y_ARMADO.md`). Solo hay dos
 * disposiciones reales (`layout`: 'print' | 'assembly'); «Libre» es Armado más la preferencia de sesión `freeView`:
 * sin poses propias, sin plano de apoyo ni avisos de cama. Aquí viven las reglas puras: qué ve y qué permite cada modo,
 * y cuándo se ofrece el selector. Sin React ni store (la separación visual está en `utils/figureExplode.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../../types/kura';
import type { SceneLayout } from '../../types/plates';

export type ViewMode = 'print' | 'assembly' | 'free';

export const VIEW_MODES: readonly ViewMode[] = ['print', 'assembly', 'free'];

/** Modo visible a partir de la disposición real y la preferencia de sesión (sin disposición de armado no hay «Libre»). */
export function viewModeOf(layout: SceneLayout | undefined, freeView: boolean | undefined): ViewMode {
  if (layout !== 'assembly') return 'print';
  return freeView ? 'free' : 'assembly';
}

/** Disposición real que exige un modo. */
export function layoutOfViewMode(mode: ViewMode): SceneLayout {
  return mode === 'print' ? 'print' : 'assembly';
}

/** Siguiente modo del atajo (cicla Imprimir, Armado, Libre). */
export function nextViewMode(mode: ViewMode): ViewMode {
  return VIEW_MODES[(VIEW_MODES.indexOf(mode) + 1) % VIEW_MODES.length];
}

export interface ViewModeTraits {
  /** Camas (rejilla, placa, rótulo y volumen) a la vista: solo en Imprimir. */
  bedsVisible: boolean;
  /** Plano de apoyo (sombra de contacto, órbita limitada a Z ≥ 0): todos menos Libre. */
  groundVisible: boolean;
  /** «Fuera de volumen» por placa: solo en Imprimir. */
  bedChecks: boolean;
  /** Ajustar a la impresora, apoyar, centrar, distribuir y mover a placa. */
  plateTools: boolean;
  /** Mover no se limita al rectángulo de las camas: Armado y Libre. */
  freeDrag: boolean;
}

export function viewModeTraits(mode: ViewMode): ViewModeTraits {
  const print = mode === 'print';
  return { bedsVisible: print, groundVisible: mode !== 'free', bedChecks: print, plateTools: print, freeDrag: !print };
}

/** Clave i18n del motivo de que una acción de cama esté deshabilitada, o `null` si se puede usar. */
export function plateToolBlockReason(layout: SceneLayout | undefined): 'viewMode.reason.printOnly' | null {
  return layout === 'assembly' ? 'viewMode.reason.printOnly' : null;
}

/** Datos mínimos del estado para decidir si se ofrece el selector. */
export interface ViewModeOfferInput {
  layout: SceneLayout | undefined;
  plates: readonly unknown[];
  objects: readonly Pick<SceneObject, 'restPose' | 'metadata'>[];
}

/**
 * ¿Se ofrece el selector? Con un proyecto simple de una placa y sin piezas con dos poses no hay nada que alternar y la
 * barra queda limpia. Se ofrece con dos o más placas, con alguna pieza con `restPose`, con un grupo dividido (hay
 * pose de armado derivada de Dividir) y siempre que se esté en Armado (para poder volver).
 */
export function shouldOfferViewModes(input: ViewModeOfferInput): boolean {
  if (input.layout === 'assembly') return true;
  if (input.plates.length >= 2) return true;
  return input.objects.some((o) => Boolean(o.restPose) || Boolean(o.metadata?.split));
}
