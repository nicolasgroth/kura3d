/**
 * @file src/components/viewport/pocketGhostGeometry.ts
 * @description Geometría de la vista previa del hueco de imán: sale de la misma primitiva (`pocketPrimitive`) que
 * crea el negativo, así vista previa y resultado no pueden divergir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { PocketPlacement } from '../../core/addons/magnetPocket';

/** Geometría de la primitiva del hueco, con la base en el origen y el eje hacia +Y (como el negativo real). */
export function pocketGhostGeometry(primitive: PocketPlacement['primitive']): THREE.BufferGeometry {
  const p = primitive.params;
  const length = p.height as number;
  const geometry = primitive.type === 'cylinder'
    ? new THREE.CylinderGeometry(p.radius as number, p.radius as number, length, p.segments as number)
    : new THREE.BoxGeometry(p.width as number, length, p.depth as number);
  geometry.translate(0, length / 2, 0);
  return geometry;
}
