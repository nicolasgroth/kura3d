/**
 * @file src/components/viewport/ghostGeometry.ts
 * @description Armado puro de la geometría de una malla fantasma del visor. Comparte los buffers de la malla (sin
 * copiarlos: `BufferAttribute` apunta a los mismos `Float32Array`/`Uint32Array`) y solo calcula normales cuando el
 * fantasma se dibuja como sólido.  Los topes de triángulos viven en
 * `store/simplifyGhostLimits.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { MeshData } from '../../types/kura';

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
