/**
 * @file src/core/operations/orientOperations.ts
 * @description «Orientar para imprimir» como operación pura (app, Worker y headless): analizar es de
 * solo lectura y devuelve las orientaciones ordenadas; aplicar una elegida devuelve un `SceneChange`
 * con un parche de transformación (girar, apoyar en la cama y centrar o conservar X/Y: un paso de
 * deshacer). Kurra Studio no genera soportes: solo orienta y mide.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { analyzeOrientations, planOrientTransform, type OrientAnalysis, type OrientOptions } from '../../engine/orient';
import type { SceneObject } from '../../types/kura';
import { isSolid } from '../scene/objectRole';
import { change, type SceneChange } from './operationTypes';

type Orientable = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>;

export interface OrientForPrintTaskArgs {
  obj: Orientable;
  options?: OrientOptions;
}

export interface OrientApplyTaskArgs {
  obj: Orientable & Pick<SceneObject, 'id'>;
  /** Cuaternión de un candidato (`OrientCandidate.quaternion`). */
  quaternion: [number, number, number, number];
  /** Conserva el centro en la cama (X/Y del usuario); si no, centra en el origen. */
  keepXY?: boolean;
}

export type { OrientOverhangFacesArgs } from '../../engine/orient';
export { orientOverhangFaces } from '../../engine/orient';

/** Pieza que «Orientar» puede tratar: un sólido desbloqueado con geometría. */
export const orientableObject = (o: SceneObject | undefined): o is SceneObject =>
  Boolean(o) && isSolid(o!) && !o!.locked && o!.mesh.indices.length >= 3;

/** Orientaciones ordenadas de la pieza (solo lectura). */
export function orientForPrint(a: OrientForPrintTaskArgs): OrientAnalysis {
  return analyzeOrientations(a.obj, a.options);
}

/** Cambio que aplica la orientación elegida (un parche de posición y rotación). */
export function orientApplyChange(a: OrientApplyTaskArgs): SceneChange {
  const t = planOrientTransform(a.obj, a.quaternion, { keepXY: a.keepXY });
  return change({ patches: [{ id: a.obj.id, patch: { position: t.position, rotation: t.rotation } }] });
}
