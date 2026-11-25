/**
 * @file src/core/addons/wallThickness.ts
 * @description Espesor de la pieza bajo un punto de su cara, medido con un rayo hacia adentro (−normal): distancia
 * hasta donde el rayo vuelve a salir del material. Lo usan la torreta (¿el agujero sale por el otro lado?), el ojo
 * de cerradura (pared detrás de la cámara) y el paso de cable (largo para atravesar la pared). Función pura sobre
 * mallas de mundo cerradas; corre en el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { addScaled, rayHits } from './meshRays';

/** Cuánto se levanta el origen del rayo sobre la cara para no arrancar justo encima de ella. */
const LIFT_MM = 0.5;

/** Espesor de la pieza bajo `point` a lo largo de −`axis` (mm); Infinity si el rayo no la cruza. */
export function thicknessBelow(world: MeshData, point: Vec3, axis: Vec3): number {
  const hits = rayHits(world, addScaled(point, axis, LIFT_MM), [-axis[0], -axis[1], -axis[2]]);
  const entry = hits.findIndex((d) => d >= LIFT_MM - 0.05);
  if (entry < 0 || entry + 1 >= hits.length) return Infinity;
  return hits[entry + 1] - LIFT_MM;
}
