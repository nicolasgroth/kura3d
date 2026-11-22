/**
 * @file src/components/split/splitPlaneDrag.ts
 * @description Canal de interfaz entre los planos del plan de división en el visor y el panel:
 * el visor publica la nueva posición (mundo, mm) de un plano al arrastrarlo y el panel la aplica
 * como posición forzada del plan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SplitAxis } from '../../engine';

export interface SplitPlaneMove {
  axis: SplitAxis;
  index: number;
  position: number;
}

type Listener = (move: SplitPlaneMove) => void;
const listeners = new Set<Listener>();

/** Suscribe al arrastre de planos; devuelve la función para desuscribir. */
export function onSplitPlaneMove(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSplitPlaneMove(move: SplitPlaneMove): void {
  for (const l of listeners) l(move);
}

/** Clave de un plano (`eje:índice`). */
export const planeKey = (axis: SplitAxis, index: number) => `${axis}:${index}`;
