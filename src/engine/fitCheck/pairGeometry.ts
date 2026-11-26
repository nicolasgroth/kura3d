/**
 * @file src/engine/fitCheck/pairGeometry.ts
 * @description Fase fina exacta de "Comprobar encaje" para un par: interferencia con Manifold
 * (`intersect`: volumen exacto en mm³, caja de la zona y área de su superficie) y holgura como distancia
 * mínima entre superficies con `three-mesh-bvh` (`closestPointToGeometry`, BVH contra BVH, acotada por
 * el tope de búsqueda). Todo en ejes internos; la conversión a ejes del usuario se hace al armar el informe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { Manifold } from 'manifold-3d';
import type { PreparedBody } from './fitBodies';

/** Volumen por debajo del cual un cruce se considera roce (mm³). */
export const FIT_MIN_VOLUME_MM3 = 1e-6;

export interface InternalInterference {
  volumeMm3: number;
  zone: THREE.Box3;
  /** Área de la superficie de la zona (mm²); permite estimar el espesor de un cruce delgado. */
  areaMm2: number;
  approximate: boolean;
  crossingTriangles?: number;
}

/** Intersección exacta de dos sólidos cerrados; `null` si no hay volumen común. */
export function exactInterference(a: Manifold, b: Manifold): InternalInterference | null {
  const inter = a.intersect(b);
  try {
    const volumeMm3 = inter.volume();
    if (!(volumeMm3 > FIT_MIN_VOLUME_MM3)) return null;
    const bb = inter.boundingBox();
    const zone = new THREE.Box3(new THREE.Vector3(...bb.min), new THREE.Vector3(...bb.max));
    return { volumeMm3, zone, areaMm2: inter.surfaceArea(), approximate: false };
  } finally {
    inter.delete();
  }
}

const IDENTITY = new THREE.Matrix4();

/**
 * Distancia mínima entre las superficies de A y B y los puntos más cercanos (en A y en B), o `null`
 * si supera `searchMm`. Funciona también con mallas abiertas.
 */
export function closestPoints(a: PreparedBody, b: PreparedBody, searchMm: number): { distance: number; onA: THREE.Vector3; onB: THREE.Vector3 } | null {
  const hitA = { point: new THREE.Vector3(), distance: Infinity, faceIndex: -1 };
  const hitB = { point: new THREE.Vector3(), distance: Infinity, faceIndex: -1 };
  // B se recorre contra el BVH de A; ambos en mundo, de ahí la identidad.
  const res = a.bvh.closestPointToGeometry(b.geometry, IDENTITY, hitA, hitB, 0, searchMm);
  if (!res || !Number.isFinite(hitA.distance) || hitA.distance > searchMm) return null;
  return { distance: hitA.distance, onA: hitA.point.clone(), onB: hitB.point.clone() };
}
