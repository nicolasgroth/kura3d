/**
 * @file src/engine/fitCheck/fitResolution.ts
 * @description Estimación de cómo resolver un choque de "Comprobar encaje" (reglas geométricas, sin IA):
 * - "Separar": el eje con la zona de cruce más delgada; A se mueve alejándose del centro de la zona el
 *   espesor de la zona más la holgura deseada. Exacto para un cruce en lámina entre caras paralelas.
 * - "Agrandar": si la zona abarca la pieza menor en dos o más ejes (una placa metida en un alojamiento
 *   chico), se lanzan rayos desde el centro de la pieza menor por ±eje contra la otra: lo que la pieza
 *   sobresale de la pared en cada lado es la penetración; se sugiere agrandar esa medida más la holgura.
 * Siempre es una estimación y así se marca.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { AxisDirection, AxisName } from '../../core/scene/displayAxes';
import type { PreparedBody } from './fitBodies';

/** Fracción del tamaño de la pieza menor que debe cubrir la zona en un eje para decir que la "envuelve". */
const WRAP_FRACTION = 0.9;
const AXES: readonly AxisName[] = ['x', 'y', 'z'];

export type FitResolution =
  | { kind: 'separate'; direction: AxisDirection; distanceMm: number }
  | { kind: 'enlarge'; inner: PreparedBody; outer: PreparedBody; perSideMm: number; axes: AxisName[] };

const volumeOf = (b: THREE.Box3) => {
  const s = b.getSize(new THREE.Vector3());
  return s.x * s.y * s.z;
};

/**
 * Penetración por eje de `inner` en las paredes de `outer`, por rayos desde su centro. Solo cuenta un eje
 * con pared metida por los dos lados (+ y −): por un solo lado, basta con separar.
 */
function penetrations(inner: PreparedBody, outer: PreparedBody): Partial<Record<AxisName, number>> {
  const center = inner.box.getCenter(new THREE.Vector3());
  const half = inner.box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const out: Partial<Record<AxisName, number>> = {};
  const ray = new THREE.Ray();
  AXES.forEach((axis, k) => {
    const h = half.getComponent(k);
    let sides = 0;
    let worst = 0;
    for (const sign of [1, -1]) {
      const dir = new THREE.Vector3().setComponent(k, sign);
      ray.set(center, dir);
      const hit = outer.bvh.raycastFirst(ray, THREE.DoubleSide);
      // Solo cuenta una pared que se encara desde el lado de la pieza (su normal mira hacia el centro).
      if (!hit || hit.distance >= h - 1e-6 || !hit.face || hit.face.normal.dot(dir) > 0) continue;
      sides++;
      worst = Math.max(worst, h - hit.distance);
    }
    if (sides === 2) out[axis] = worst;
  });
  return out;
}

/** Cómo resolver el cruce `zone` entre A y B (ejes internos). */
export function estimateResolution(a: PreparedBody, b: PreparedBody, zone: THREE.Box3, clearanceMm: number): FitResolution {
  const [inner, outer] = volumeOf(a.box) <= volumeOf(b.box) ? [a, b] : [b, a];
  const innerSize = inner.box.getSize(new THREE.Vector3());
  const zoneSize = zone.getSize(new THREE.Vector3());
  const wrapped = AXES.filter((_, k) => zoneSize.getComponent(k) >= WRAP_FRACTION * innerSize.getComponent(k));
  if (wrapped.length >= 2) {
    const pen = penetrations(inner, outer);
    const axes = AXES.filter((ax) => (pen[ax] ?? 0) > 1e-6);
    if (axes.length > 0) {
      const worst = Math.max(...axes.map((ax) => pen[ax]!));
      return { kind: 'enlarge', inner, outer, perSideMm: worst + clearanceMm, axes };
    }
  }
  let k = 0;
  for (let i = 1; i < 3; i++) if (zoneSize.getComponent(i) < zoneSize.getComponent(k)) k = i;
  const aCenter = a.box.getCenter(new THREE.Vector3()).getComponent(k);
  const zCenter = zone.getCenter(new THREE.Vector3()).getComponent(k);
  const direction = `${aCenter < zCenter ? '-' : '+'}${AXES[k]}` as AxisDirection;
  return { kind: 'separate', direction, distanceMm: zoneSize.getComponent(k) + clearanceMm };
}

/** Eje dominante (dirección interna con signo) de un vector. */
export function dominantDirection(v: THREE.Vector3): AxisDirection {
  const abs = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
  const k = abs.indexOf(Math.max(...abs));
  return `${v.getComponent(k) < 0 ? '-' : '+'}${AXES[k]}` as AxisDirection;
}
