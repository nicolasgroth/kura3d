/**
 * @file src/core/operations/plateArrangeOperations.ts
 * @description «Repartir en placas» como tarea del motor (Worker o en proceso): con `orient: 'flatDown'` apoya cada
 * pieza en su cara plana más grande usando el motor de «Orientar para imprimir» (candidatos medidos, solo los que
 * tienen base real y son estables) y luego planifica con `arrangeOnPlates`. Solo lectura: devuelve el plan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { analyzeOrientations, planOrientTransform } from '../../engine/orient';
import type { SceneObject, Vec3 } from '../../types/kura';
import { arrangeOnPlates, type ArrangeInput } from '../scene/plateArrange';
import type { ArrangePlan } from '../scene/plateArrangeTypes';

/** Lo que viaja al Worker: todo `ArrangeInput` menos la función de orientación. */
export type ArrangeTaskArgs = Omit<ArrangeInput, 'orientPose'>;

/** Celdas de la grilla de soporte: aquí solo importa el apoyo, no el volumen de soporte (más grueso = más rápido). */
const FLAT_GRID_CELLS = 24;

/**
 * Pose apoyada en la cara plana más grande: entre los candidatos estables con base real, el de mayor área de contacto
 * (desempate: el mejor puesto de Orientar). Si es la orientación actual, solo se apoya (sin girar). null si ninguna
 * orientación tiene base real.
 */
export function flatDownPose(obj: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>): { position: Vec3; rotation: Vec3 } | null {
  if (obj.mesh.indices.length < 3) return null;
  const analysis = analyzeOrientations(obj, { gridCells: FLAT_GRID_CELLS });
  let best = null as (typeof analysis.candidates)[number] | null;
  for (const c of analysis.candidates) {
    if (!c.measures.stable || c.reasons.some((r) => r.key === 'noBase')) continue;
    if (!best || c.measures.contactAreaMm2 > best.measures.contactAreaMm2 * (1 + 1e-6)) best = c;
  }
  if (!best) return null;
  const t = planOrientTransform(obj, best.quaternion, { keepXY: true, alignFootprint: best.source !== 'current' });
  return { position: t.position, rotation: t.rotation };
}

/** Plan de reparto (para el Worker): orienta si se pidió y empaqueta. */
export function arrangeOnPlatesTask(args: ArrangeTaskArgs): ArrangePlan {
  return arrangeOnPlates({ ...args, orientPose: args.options.orient === 'flatDown' ? flatDownPose : undefined });
}
