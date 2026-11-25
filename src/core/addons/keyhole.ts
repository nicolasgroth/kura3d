/**
 * @file src/core/addons/keyhole.ts
 * @description Ojo de cerradura para colgar una pieza de un tornillo en el muro: parámetros, rangos, validación y
 * saneo, y la geometría pura del negativo en coordenadas locales (origen en el punto de la cara, +Y hacia afuera, +X
 * hacia donde sube la ranura): la entrada circular para la cabeza (atraviesa labio y cámara), la ranura del cuello en
 * el labio y la cámara detrás, del ancho de la cabeza, donde la cabeza se desliza hasta quedar atrapada. La ranura
 * apunta al «arriba» de la pieza (`uprightFrame`). También el punto donde descansa el tornillo (cuelgue) y la
 * diferencia de altura entre ojos de una misma cara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { KeyholeParams, MeshData, SceneObject, Vec3 } from '../../types/kura';
import { uprightFrame, type UprightFrame } from './faceFrame';
import { MIN_WALL_MM } from './magnetPocket';
import { stadiumLoftMesh } from './stadiumMesh';

export type { KeyholeParams };

/** Cuánto sobresale el negativo sobre la cara para que la resta abra limpio. */
export const KEYHOLE_OVERSHOOT_MM = 0.3;
/** Solape entre la ranura del cuello y la cámara, para que se unan sin rendija. */
export const KEYHOLE_JOIN_MM = 0.05;
/** Material mínimo detrás de la cámara y entre la cámara y la cara (3 perímetros de 0,4 mm). */
export const KEYHOLE_MIN_WALL_MM = MIN_WALL_MM;
/** Diferencia de altura entre ojos de una misma cara a partir de la cual la pieza colgaría torcida (mm). */
export const KEYHOLE_LEVEL_TOLERANCE_MM = 0.2;

export const KEYHOLE_RANGES = {
  screwMm: { min: 2, max: 8 },
  headDiameterMm: { min: 3, max: 20 },
  neckWidthMm: { min: 1.5, max: 12 },
  slotLengthMm: { min: 3, max: 40 },
  chamberDepthMm: { min: 1, max: 10 },
  lipMm: { min: KEYHOLE_MIN_WALL_MM, max: 10 },
  angleDeg: { min: -180, max: 180 },
} as const;

export type KeyholeNumericField = keyof typeof KEYHOLE_RANGES;

/** Holgura mínima entre la cabeza y el cuello: con menos la cabeza se sale por la ranura. */
const NECK_MARGIN_MM = 0.5;

/**
 * Campos fuera de rango, más los cruzados: el cuello debe ser más angosto que la cabeza (o la cabeza se sale) y la
 * ranura lo bastante larga para que la cabeza quede bajo el labio (≥ medio ancho de la cabeza + medio cuello).
 */
export function invalidKeyholeFields(p: KeyholeParams): KeyholeNumericField[] {
  const bad = (Object.keys(KEYHOLE_RANGES) as KeyholeNumericField[]).filter((field) => {
    const v = p[field];
    const r = KEYHOLE_RANGES[field];
    return !(Number.isFinite(v) && v >= r.min && v <= r.max);
  });
  if (!bad.includes('neckWidthMm') && !bad.includes('headDiameterMm') && !(p.neckWidthMm <= p.headDiameterMm - NECK_MARGIN_MM)) {
    bad.push('neckWidthMm');
  }
  if (!bad.includes('slotLengthMm') && !bad.includes('headDiameterMm') && !bad.includes('neckWidthMm')
    && !(p.slotLengthMm >= (p.headDiameterMm + p.neckWidthMm) / 2)) {
    bad.push('slotLengthMm');
  }
  return bad;
}

/** Parámetros válidos a partir de datos no confiables (preferencias, `.kura`); null si no sirven. */
export function sanitizeKeyholeParams(raw: unknown): KeyholeParams | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fallback?: number) => (v === undefined && fallback !== undefined ? fallback : typeof v === 'number' ? v : NaN);
  const p: KeyholeParams = {
    screwMm: num(r.screwMm),
    headDiameterMm: num(r.headDiameterMm),
    neckWidthMm: num(r.neckWidthMm),
    slotLengthMm: num(r.slotLengthMm),
    chamberDepthMm: num(r.chamberDepthMm),
    lipMm: num(r.lipMm),
    angleDeg: num(r.angleDeg, 0),
  };
  return invalidKeyholeFields(p).length === 0 ? p : null;
}

export function sameKeyhole(a: KeyholeParams, b: KeyholeParams): boolean {
  return (Object.keys(KEYHOLE_RANGES) as KeyholeNumericField[]).every((k) => a[k] === b[k]);
}

/** Profundidad total del negativo bajo la cara (labio + cámara). */
export const keyholeDepthMm = (p: Pick<KeyholeParams, 'lipMm' | 'chamberDepthMm'>) => p.lipMm + p.chamberDepthMm;

/** Las tres partes convexas del negativo, en coordenadas locales (se unen en el motor). */
export function keyholePartMeshes(p: KeyholeParams): { entry: MeshData; neck: MeshData; chamber: MeshData } {
  const depth = keyholeDepthMm(p);
  const rh = p.headDiameterMm / 2;
  const rn = p.neckWidthMm / 2;
  const o = KEYHOLE_OVERSHOOT_MM;
  return {
    entry: stadiumLoftMesh({ straightMm: 0, rings: [{ y: -depth, radius: rh }, { y: o, radius: rh }] }),
    neck: stadiumLoftMesh({ straightMm: p.slotLengthMm, rings: [{ y: -p.lipMm - KEYHOLE_JOIN_MM, radius: rn }, { y: o, radius: rn }] }),
    chamber: stadiumLoftMesh({ straightMm: p.slotLengthMm, rings: [{ y: -depth, radius: rh }, { y: -p.lipMm, radius: rh }] }),
  };
}

/** Colocación del ojo: origen en el punto de la cara, rotación de la base «arriba» y punto donde cuelga. */
export interface KeyholePlan {
  frame: UprightFrame;
  position: Vec3;
  rotation: Vec3;
  /** Centro del extremo de la ranura sobre la cara: ahí descansa el tornillo. */
  hangPoint: Vec3;
}

export function placeKeyhole(p: KeyholeParams, point: Vec3, normal: Vec3): KeyholePlan | null {
  const frame = uprightFrame(normal, p.angleDeg);
  if (!frame || !point.every(Number.isFinite)) return null;
  const hangPoint = [0, 1, 2].map((i) => point[i] + frame.x[i] * p.slotLengthMm) as Vec3;
  return { frame, position: [...point] as Vec3, rotation: frame.rotation, hangPoint };
}

type Posed = Pick<SceneObject, 'position' | 'rotation' | 'scale' | 'metadata'>;

const quat = (o: Posed) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation, 'XYZ'));

/**
 * Punto de cuelgue (mundo) de un ojo ya colocado, según su pose actual; null si no es un ojo. El extremo local de la
 * ranura pasa por la transformación completa del objeto (posición · rotación · escala, la misma del visor), así una
 * escala no uniforme o un espejo nunca dependen de un solo eje.
 */
export function keyholeHangPoint(o: Posed): Vec3 | null {
  const addon = o.metadata?.addon;
  if (addon?.kind !== 'keyhole') return null;
  const world = new THREE.Matrix4().compose(new THREE.Vector3(...o.position), quat(o), new THREE.Vector3(...o.scale));
  const v = new THREE.Vector3(addon.params.slotLengthMm, 0, 0).applyMatrix4(world);
  return [v.x, v.y, v.z];
}

/** Normal de la cara (eje +Y local) de un objeto. */
const axisOf = (o: Posed) => new THREE.Vector3(0, 1, 0).applyQuaternion(quat(o));

/**
 * Mayor diferencia de altura (mundo, eje Y) entre el punto de cuelgue de `target` y el de los otros ojos de la misma
 * pieza y la misma cara (misma normal y mismo plano). null si no hay otros en esa cara.
 */
export function keyholeLevelOffsetMm(objects: readonly SceneObject[], target: SceneObject): number | null {
  const hostId = target.metadata?.addon?.hostId;
  const hang = keyholeHangPoint(target);
  if (!hostId || !hang) return null;
  const n = axisOf(target);
  let worst: number | null = null;
  for (const o of objects) {
    if (o.id === target.id || o.metadata?.addon?.kind !== 'keyhole' || o.metadata.addon.hostId !== hostId) continue;
    if (axisOf(o).dot(n) < 0.999) continue;
    const d = new THREE.Vector3(...o.position).sub(new THREE.Vector3(...target.position));
    if (Math.abs(d.dot(n)) > 0.5) continue;
    const other = keyholeHangPoint(o)!;
    const diff = Math.abs(other[1] - hang[1]);
    worst = worst === null ? diff : Math.max(worst, diff);
  }
  return worst;
}
