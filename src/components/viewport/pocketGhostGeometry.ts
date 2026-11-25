/**
 * @file src/components/viewport/pocketGhostGeometry.ts
 * @description Geometría de la vista previa del hueco de imán. Sale de la misma primitiva (`pocketPrimitive`) que
 * crea el negativo, así que comparte con el resultado la forma, las medidas y el eje. NO comparte el largo de la
 * sobresalida: la vista previa usa la sobresalida mínima, mientras que el negativo real, en una cara cóncava, sobresale
 * más (lo calcula el Worker con la curvatura de la cara). Además da el contorno (aristas) de la vista previa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { PocketPlacement } from '../../core/addons/magnetPocket';

const isMeasure = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Geometría de la primitiva del hueco, con la base en el origen y el eje hacia +Y (como el negativo real). Devuelve
 * null si a la primitiva le falta una medida (no debería ocurrir con las que genera `pocketPrimitive`).
 */
export function pocketGhostGeometry(primitive: PocketPlacement['primitive']): THREE.BufferGeometry | null {
  const { height, radius, segments, width, depth } = primitive.params;
  if (!isMeasure(height)) return null;
  let geometry: THREE.BufferGeometry;
  if (primitive.type === 'cylinder') {
    if (!isMeasure(radius) || !isMeasure(segments)) return null;
    geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
  } else {
    if (!isMeasure(width) || !isMeasure(depth)) return null;
    geometry = new THREE.BoxGeometry(width, height, depth);
  }
  geometry.translate(0, height / 2, 0);
  return geometry;
}

/** Aristas de la vista previa (los bordes de la forma, no cada triángulo). */
export function pocketGhostEdges(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  return new THREE.EdgesGeometry(geometry, 5);
}
