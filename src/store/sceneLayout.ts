/**
 * @file src/store/sceneLayout.ts
 * @description Lectores del store para las dos poses: contexto de derivación (cama y marco por placa de las placas
 * virtuales de Dividir, el mismo que usa «Disponer grupo») y la escena en pose de impresión (exportar) o de armado (comprobar
 * encaje), sea cual sea el modo activo. Lógica en `core/scene/layoutPoses.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { activePlateBed, type PlateBedSource } from '../core/scene/activePlateBed';
import { DEFAULT_LAYOUT, posedObjects, type LayoutContext } from '../core/scene/layoutPoses';
import { splitFramesOf, splitPlateSourceOf } from '../core/scene/splitFrame';
import type { SceneObject } from '../types/kura';
import type { SceneLayout } from '../types/plates';

/**
 * Estado que basta para posar la escena. Las medidas de la cama solo se leen si hay que cambiar de modo: un estado
 * parcial sin `layout` (pruebas, acciones con estado mínimo) está en imprimir y no las necesita.
 */
type LayoutState = { objects: SceneObject[]; layout?: SceneLayout };

function posed(state: LayoutState, wanted: SceneLayout): SceneObject[] {
  const current = state.layout ?? DEFAULT_LAYOUT;
  if (current === wanted) return state.objects;
  // Con `layout` es el estado del store, que siempre trae perfil y medidas de cama.
  return posedObjects(state.objects, current, wanted, layoutContextOf(state as unknown as PlateBedSource));
}

export function layoutContextOf(state: PlateBedSource): LayoutContext {
  const { widthMm, depthMm } = activePlateBed(state).bed;
  // Con placas, cada pieza dividida se deriva respecto de su placa real (sin placas, la cuadrícula de siempre).
  if (!state.plates?.length) return { bed: { widthMm, depthMm } };
  return { bed: { widthMm, depthMm }, frames: splitFramesOf(splitPlateSourceOf(state)) };
}

/** Escena en pose de impresión (la misma lista si ya está en imprimir): lo que se exporta. */
export function printPosedObjects(state: LayoutState): SceneObject[] {
  return posed(state, 'print');
}

/** Escena en pose de armado (la misma lista si ya está en armado): lo que comprueba el encaje. */
export function assemblyPosedObjects(state: LayoutState): SceneObject[] {
  return posed(state, 'assembly');
}
