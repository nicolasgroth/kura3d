/**
 * @file src/components/viewport/ghostGeometry.ts
 * @description Armado puro de la geometría de una malla fantasma del visor. Comparte los buffers de la malla (sin
 * copiarlos: `BufferAttribute` apunta a los mismos `Float32Array`/`Uint32Array`) y solo calcula normales cuando el
 * fantasma se dibuja como sólido. Fija el tope de triángulos del fantasma de Simplificar: sobre
 * `SIMPLIFY_GHOST_MAX_TRIANGLES` no se dibuja (el panel lo dice y queda solo el informe).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { MeshData } from '../../types/kura';

/**
 * Tope de triángulos del RESULTADO de Simplificar para dibujar su fantasma. Medido (`ghostGeometry.perf.test.ts`):
 * armar buffers y normales cuesta ~110 ms con 500 mil triángulos y ~310 ms con 2 millones; el resto del costo es de
 * la GPU y de la memoria. Se corta en 1,5 millones para no trabar equipos modestos; más allá solo se muestra el
 * informe.
 */
export const SIMPLIFY_GHOST_MAX_TRIANGLES = 1_500_000;

/**
 * Modo liviano: sobre este número de triángulos el fantasma se dibuja solo como sólido, sin la malla de aristas
 * (una maraña de líneas ya no informa nada y la GPU ahorra el índice de líneas).
 */
export const SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES = 400_000;

/** Triángulos del resultado: un fantasma con más de `max` no se dibuja. */
export function ghostTooHeavy(triangles: number, max: number = SIMPLIFY_GHOST_MAX_TRIANGLES): boolean {
  return triangles > max;
}

/**
 * Geometría de un fantasma. Los buffers de `mesh` se reutilizan tal cual (sin copia). Con `normals` calcula las
 * normales de vértice (necesarias para el sombreado del sólido; el alambre no las usa).
 */
export function buildGhostGeometry(mesh: MeshData, options: { normals: boolean } = { normals: true }): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  if (options.normals) g.computeVertexNormals();
  return g;
}
