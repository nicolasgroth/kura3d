/**
 * @file src/components/viewport/creasedGeometry.ts
 * @description Geometría de render de un objeto con sombreado de aristas vivas: caras planas con borde
 * nítido y superficies curvas suaves (ángulo de pliegue en `utils/creasedNormals`). Conserva el orden de
 * triángulos y el formato no indexado de las mallas pintadas (atributo `color` por esquina).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import * as engine from '../../engine';
import type { MeshData } from '../../types/kura';
import { getCreasedMesh, MAX_CREASED_TRIANGLES } from '../../utils/creasedNormals';

export function buildViewportGeometry(mesh: MeshData, paintBaseColor?: string): THREE.BufferGeometry {
  const triCount = Math.floor(mesh.indices.length / 3);
  const painted = mesh.faceColors && mesh.faceColors.length === triCount && triCount > 0;
  if (triCount === 0 || triCount > MAX_CREASED_TRIANGLES) {
    return engine.createBufferGeometryFromMeshData(mesh, painted ? paintBaseColor : undefined);
  }
  const creased = getCreasedMesh(mesh.positions, mesh.indices);

  if (painted) {
    // Formato no indexado (pintura): se reemplazan las normales planas por las de pliegue.
    const geometry = engine.createBufferGeometryFromMeshData(mesh, paintBaseColor);
    const out = new Float32Array(triCount * 9);
    for (let c = 0; c < triCount * 3; c++) {
      const v = creased.indices[c] * 3;
      out[c * 3] = creased.normals[v];
      out[c * 3 + 1] = creased.normals[v + 1];
      out[c * 3 + 2] = creased.normals[v + 2];
    }
    geometry.setAttribute('normal', new THREE.BufferAttribute(out, 3));
    return geometry;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(creased.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(creased.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(creased.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
