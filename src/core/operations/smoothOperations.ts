/**
 * @file src/core/operations/smoothOperations.ts
 * @description Operación pura «Suavizar malla»: llama a `smoothMesh` del motor y devuelve un
 * `SceneChange` con un solo parche (un paso de deshacer) más el informe de suavizado (fuerza
 * aplicada, vértices movidos, volumen antes y después). Sin vértices que mover, el cambio no trae
 * parches y solo el aviso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { smoothMesh, type SmoothOptions, type SmoothReport } from '../../engine/smooth';
import type { SceneObject } from '../../types/kura';
import { change, meshPatch, type OperationContext, type SceneChange } from './operationTypes';

/** Opciones serializables de la tarea (sin `onProgress`: lo pone el contexto). */
export type SmoothTaskOptions = Omit<SmoothOptions, 'onProgress'>;

/** Suaviza la malla del objeto (en local; la transformación no cambia). El informe va en coordenadas de mundo. */
export function smoothObject(
  ctx: OperationContext,
  obj: SceneObject,
  options: SmoothTaskOptions = {},
): { report: SmoothReport; change: SceneChange } {
  // La escala del objeto: el informe (volumen, desplazamiento) y el ángulo de arista viva se miden en mundo.
  const res = smoothMesh(obj.mesh, { ...options, scale: obj.scale, onProgress: ctx.onProgress });
  if (res.report.movedVertices === 0) return { report: res.report, change: change({ warnings: res.warnings }) };
  return {
    report: res.report,
    change: change({ patches: [{ id: obj.id, patch: meshPatch(ctx, obj, res.mesh) }], warnings: res.warnings }),
  };
}
