/**
 * @file src/engine/orient/orientOverhangFaces.ts
 * @description Triángulos de la pieza que quedarían en voladizo con una orientación candidata (la misma regla
 * que `measureOrientation`: normal hacia abajo más allá del umbral y no apoyados en la cama), para resaltarlos
 * en el visor. Devuelve índices de triángulo de la malla original, con un tope para no inflar el mensaje.
 * Función pura y barata (lineal en triángulos): no arma el casco convexo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { faceGeometry } from '../printabilityChecks';
import { ORIENT_DEFAULTS } from './orientForPrint';
import { BED_BAND_MM } from './orientMeasure';
import type { OrientInput } from './orientTypes';
import { massProperties, worldPositions } from './orientWorld';

/** Tope de triángulos que se devuelven (el resto se omite y `truncated` lo dice). */
export const OVERHANG_FACES_MAX = 150_000;

export interface OrientOverhangFaces {
  /** Índices de triángulo (posición `t` en `indices` / 3) en voladizo, hasta `OVERHANG_FACES_MAX`. */
  triangles: Uint32Array;
  truncated: boolean;
}

export interface OrientOverhangFacesArgs {
  obj: OrientInput;
  /** Cuaternión de un candidato (`OrientCandidate.quaternion`). */
  quaternion: [number, number, number, number];
  overhangAngleDeg?: number;
}

export function orientOverhangFaces(a: OrientOverhangFacesArgs): OrientOverhangFaces {
  const idx = a.obj.mesh.indices;
  const p = worldPositions(a.obj);
  if (idx.length < 3 || p.length < 9) return { triangles: new Uint32Array(0), truncated: false };
  const sign = massProperties(p, idx).volume < 0 ? -1 : 1;
  const geo = faceGeometry({ positions: p, indices: idx }, sign);
  const e = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...a.quaternion).normalize()).elements;
  // Altura de cada vértice con la pieza girada (solo la fila Y de la rotación).
  const h = new Float64Array(p.length / 3);
  let minH = Infinity;
  for (let i = 0, k = 0; i < p.length; i += 3, k++) {
    h[k] = e[1] * p[i] + e[5] * p[i + 1] + e[9] * p[i + 2];
    if (h[k] < minH) minH = h[k];
  }
  const band = minH + BED_BAND_MM;
  const limit = -Math.cos(((a.overhangAngleDeg ?? ORIENT_DEFAULTS.overhangAngleDeg) * Math.PI) / 180);
  const out: number[] = [];
  let truncated = false;
  for (let t = 0; t < geo.areas.length; t++) {
    if (!(geo.areas[t] > 1e-12)) continue;
    const nu = e[1] * geo.normals[t * 3] + e[5] * geo.normals[t * 3 + 1] + e[9] * geo.normals[t * 3 + 2];
    if (nu >= limit) continue;
    if (h[idx[t * 3]] <= band && h[idx[t * 3 + 1]] <= band && h[idx[t * 3 + 2]] <= band) continue;
    if (out.length >= OVERHANG_FACES_MAX) { truncated = true; break; }
    out.push(t);
  }
  return { triangles: Uint32Array.from(out), truncated };
}
