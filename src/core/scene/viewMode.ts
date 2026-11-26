/**
 * @file src/core/scene/viewMode.ts
 * @description Modos de vista Imprimir / Armado / Libre (lote P4 de `docs/diseno/PLACAS_Y_ARMADO.md`). Solo hay dos
 * disposiciones reales (`layout`: 'print' | 'assembly'); «Libre» es Armado más la preferencia de sesión `freeView`:
 * sin poses propias, sin plano de apoyo ni avisos de cama. Aquí viven las reglas puras: qué ve y qué permite cada modo,
 * cuándo se ofrece el selector y la separación visual («explosión») de cualquier conjunto de piezas. Sin React ni store.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { computeSelectionBounds } from '../../utils/selectionBounds';
import type { SceneObject, Vec3 } from '../../types/kura';
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

/**
 * Posiciones de la separación visual (0 = armado exacto, 1 = separadas): cada pieza se aleja del centro del conjunto
 * en la dirección de su propio centro, en proporción a `factor`. Solo dibujo: no toca poses ni historial. Con menos
 * de dos piezas no hay nada que separar.
 */
export function explodedFigurePositions(objects: readonly SceneObject[], ids: ReadonlySet<string>, factor: number, spread = 0.8): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  const picked = objects.filter((o) => ids.has(o.id));
  const f = Math.min(1, Math.max(0, factor));
  if (picked.length < 2 || f <= 0) return out;
  const all = computeSelectionBounds(picked);
  if (!all) return out;
  const cx = (all.min[0] + all.max[0]) / 2;
  const cy = (all.min[1] + all.max[1]) / 2;
  const cz = (all.min[2] + all.max[2]) / 2;
  const reach = Math.max(all.size[0], all.size[1], all.size[2], 1) * spread;
  for (const o of picked) {
    const b = computeSelectionBounds([o]);
    if (!b) continue;
    const d: Vec3 = [(b.min[0] + b.max[0]) / 2 - cx, (b.min[1] + b.max[1]) / 2 - cy, (b.min[2] + b.max[2]) / 2 - cz];
    const len = Math.hypot(d[0], d[1], d[2]);
    // Una pieza justo en el centro no tiene dirección: se queda donde está.
    if (len < 1e-6) continue;
    const k = (f * reach) / len;
    out.set(o.id, [o.position[0] + d[0] * k, o.position[1] + d[1] * k, o.position[2] + d[2] * k]);
  }
  return out;
}
