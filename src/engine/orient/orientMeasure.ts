/**
 * @file src/engine/orient/orientMeasure.ts
 * @description Medidas de una orientación con la pieza ya apoyada en la cama: área en voladizo,
 * volumen aproximado de soporte, contacto con la cama, polígono de apoyo y ángulo de vuelco,
 * altura, huella y si cabe en la cama (con el giro sobre la vertical que la hace caber).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { Vec3 } from '../../types/kura';
import { convexHull2, extentAt, insideMargin, polygonArea, yawToFit } from './orientPlanar';
import { supportVolume, type OrientedFrame } from './orientSupport';
import type { OrientBed, OrientMeasures } from './orientTypes';
import type { OrientWorld } from './orientWorld';

/** Banda sobre la cama (mm) cuyas caras no cuentan como voladizo: igual que el informe de imprimibilidad. */
export const BED_BAND_MM = 0.2;
/** Una cara cuenta como contacto si su normal está a menos de 1° de la vertical hacia abajo. */
const CONTACT_COS = Math.cos((1 * Math.PI) / 180);

export interface MeasureSettings {
  overhangAngleDeg: number;
  minTipAngleDeg: number;
  minSupportAreaMm2: number;
  gridCells: number;
  bed: OrientBed | null;
}

export interface MeasuredOrientation {
  measures: OrientMeasures;
  /** Cuaternión final (base + giro sobre la vertical). */
  quaternion: THREE.Quaternion;
  supportCellMm: number;
}

/** Giro que lleva `down` a −Y (mundo). */
export function baseQuaternion(down: Vec3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...down).normalize(), new THREE.Vector3(0, -1, 0));
}

function rotateInto(src: Float64Array, e: number[], out: Float64Array): void {
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2];
    out[i] = e[0] * x + e[4] * y + e[8] * z;
    out[i + 1] = e[1] * x + e[5] * y + e[9] * z;
    out[i + 2] = e[2] * x + e[6] * y + e[10] * z;
  }
}

/** Polígono de apoyo: casco 2D (x, z) de los vértices que tocan la cama. */
function supportPolygon(coords: Float64Array, minH: number, tol: number): Float64Array {
  const pts: number[] = [];
  for (let i = 0; i < coords.length; i += 3) if (coords[i + 1] <= minH + tol) pts.push(coords[i], coords[i + 2]);
  return convexHull2(pts);
}

function footprintOf(hull: Float64Array): Float64Array {
  const pts = new Float64Array((hull.length / 3) * 2);
  for (let i = 0, j = 0; i < hull.length; i += 3, j += 2) { pts[j] = hull[i]; pts[j + 1] = hull[i + 2]; }
  return convexHull2(pts);
}

/**
 * Mide `world` girado por `base`. `scratch` es un búfer reutilizable del tamaño de `world.positions`.
 */
export function measureOrientation(world: OrientWorld, base: THREE.Quaternion, s: MeasureSettings, scratch: Float64Array): MeasuredOrientation {
  const quaternion = base.clone();
  // Giro sobre la vertical para caber en la cama (se decide con el casco: la huella es su proyección).
  const hullRot = new Float64Array(world.hullPoints.length);
  rotateInto(world.hullPoints, new THREE.Matrix4().makeRotationFromQuaternion(quaternion).elements, hullRot);
  let footprint = footprintOf(hullRot);
  let fitsBed: boolean | null = null;
  if (s.bed) {
    const m = s.bed.marginMm ?? 0;
    const yaw = yawToFit(footprint, [s.bed.widthMm - 2 * m, s.bed.depthMm - 2 * m]);
    if (yaw !== null && yaw !== 0) {
      // extentAt gira (x, z) por +yaw en el plano; sobre Y de three eso es −yaw.
      quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw));
      rotateInto(world.hullPoints, new THREE.Matrix4().makeRotationFromQuaternion(quaternion).elements, hullRot);
      footprint = footprintOf(hullRot);
    }
    fitsBed = yaw !== null;
  }
  const [fw, fd] = extentAt(footprint, 0);

  const e = new THREE.Matrix4().makeRotationFromQuaternion(quaternion).elements;
  rotateInto(world.positions, e, scratch);
  const c = scratch;
  let minH = Infinity, maxH = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < c.length; i += 3) {
    if (c[i + 1] < minH) minH = c[i + 1]; if (c[i + 1] > maxH) maxH = c[i + 1];
    if (c[i] < minX) minX = c[i]; if (c[i] > maxX) maxX = c[i];
    if (c[i + 2] < minZ) minZ = c[i + 2]; if (c[i + 2] > maxZ) maxZ = c[i + 2];
  }
  const heightMm = maxH - minH;
  if (fitsBed && heightMm > s.bed!.heightMm + 1e-6) fitsBed = false;

  const ohLimit = -Math.cos((s.overhangAngleDeg * Math.PI) / 180);
  const tol = Math.max(0.02, world.diag * 1e-4);
  const band = minH + BED_BAND_MM, flat = minH + tol;
  const idx = world.indices, n = world.normals, areas = world.areas;
  const triCount = areas.length;
  const overhang = new Uint8Array(triCount);
  let overhangAreaMm2 = 0, contactAreaMm2 = 0;
  for (let t = 0; t < triCount; t++) {
    if (!(areas[t] > 1e-12)) continue;
    const nu = e[1] * n[t * 3] + e[5] * n[t * 3 + 1] + e[9] * n[t * 3 + 2];
    if (nu >= ohLimit) continue;
    const h0 = c[idx[t * 3] * 3 + 1], h1 = c[idx[t * 3 + 1] * 3 + 1], h2 = c[idx[t * 3 + 2] * 3 + 1];
    if (h0 <= band && h1 <= band && h2 <= band) {
      if (nu <= -CONTACT_COS && h0 <= flat && h1 <= flat && h2 <= flat) contactAreaMm2 += areas[t];
      continue;
    }
    overhang[t] = 1;
    overhangAreaMm2 += areas[t];
  }
  const frame: OrientedFrame = { coords: c, indices: idx, minX, maxX, minZ, maxZ, minH };
  const support = supportVolume(frame, overhang, s.gridCells);

  const poly = supportPolygon(c, minH, tol);
  const supportPolygonMm2 = polygonArea(poly);
  const com = new THREE.Vector3(...world.com).applyQuaternion(quaternion);
  const margin = insideMargin(poly, com.x, com.z);
  const comHeight = Math.max(com.y - minH, 1e-9);
  const tipAngleDeg = (Math.atan2(margin, comHeight) * 180) / Math.PI;
  const stable = supportPolygonMm2 >= s.minSupportAreaMm2 && tipAngleDeg >= s.minTipAngleDeg;

  return {
    quaternion,
    supportCellMm: support.cellMm,
    measures: {
      overhangAreaMm2, supportVolumeMm3: support.volumeMm3, contactAreaMm2, supportPolygonMm2, tipAngleDeg, stable,
      heightMm, footprintMm: [fw, fd], fitsBed,
    },
  };
}
