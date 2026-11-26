/**
 * @file src/core/addons/magnetPocket.ts
 * @description Alojamiento de imán: parámetros (forma redonda, cuadrada o rectangular, medidas, holguras, abierto u
 * oculto), su validación y saneo, las medidas del hueco y la colocación del negativo sobre una cara (eje = normal de
 * la cara, boca a ras con sobresalida hacia afuera, o tapado por 0,6 mm de material). El cuadrado es el rectángulo con
 * largo = ancho; el largo del rectangular va al «arriba» de la cara (giro opcional de 90°). Funciones puras; el
 * negativo es una primitiva paramétrica (cilindro o caja) con su base en el fondo del hueco y su eje +Y local hacia
 * afuera.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { MagnetPocketParams, MeshData, PrimitiveParams, Vec3 } from '../../types/kura';

/** Imán pedido: el mismo tipo que guardan los metadatos `addon` (una sola definición, en `types/kura`). */
export type MagnetParams = MagnetPocketParams;
export type MagnetShape = MagnetParams['shape'];

export const MAGNET_DEFAULTS: Readonly<MagnetParams> = {
  shape: 'round', sizeMm: 5, heightMm: 2, clearanceMm: 0.2, depthClearanceMm: 0.2, hidden: false,
};

/** Rangos de edición (mm). */
export const MAGNET_RANGES = {
  sizeMm: { min: 1, max: 60 },
  /** Ancho del rectangular (mismo rango que el largo). */
  widthMm: { min: 1, max: 60 },
  heightMm: { min: 0.5, max: 30 },
  clearanceMm: { min: 0, max: 0.6 },
  depthClearanceMm: { min: 0, max: 0.6 },
} as const;

export type MagnetNumericField = keyof typeof MAGNET_RANGES;

/** Material que queda sobre un imán oculto. */
export const HIDDEN_COVER_MM = 0.6;
/** Cuánto sobresale el negativo abierto hacia afuera de la cara para que la resta abra limpio. */
export const MOUTH_OVERSHOOT_MM = 0.3;
/** Pared mínima recomendada alrededor del hueco (3 perímetros de 0,4 mm). */
export const MIN_WALL_MM = 1.2;
/** Segmentos del cilindro del hueco. */
export const POCKET_SEGMENTS = 64;

/** Campos fuera de rango (vacío = válido). El ancho solo cuenta en el rectangular. */
export function invalidMagnetFields(p: MagnetParams): MagnetNumericField[] {
  return (Object.keys(MAGNET_RANGES) as MagnetNumericField[]).filter((field) => {
    if (field === 'widthMm' && p.shape !== 'rect') return false;
    const v = p[field];
    const r = MAGNET_RANGES[field];
    return !(v !== undefined && Number.isFinite(v) && v >= r.min && v <= r.max);
  });
}

/** Parámetros válidos a partir de datos no confiables (preferencias, `.kura`); null si no sirven. */
export function sanitizeMagnetParams(raw: unknown): MagnetParams | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.shape !== 'round' && r.shape !== 'square' && r.shape !== 'rect') return null;
  const num = (v: unknown, fallback?: number) => (v === undefined && fallback !== undefined ? fallback : typeof v === 'number' ? v : NaN);
  const p: MagnetParams = {
    shape: r.shape,
    sizeMm: num(r.sizeMm),
    heightMm: num(r.heightMm),
    clearanceMm: num(r.clearanceMm, MAGNET_DEFAULTS.clearanceMm),
    depthClearanceMm: num(r.depthClearanceMm, MAGNET_DEFAULTS.depthClearanceMm),
    hidden: r.hidden === true,
  };
  // Solo el rectangular lleva ancho y giro: un cuadrado o redondo guardado con ellos de más se lee sin ellos.
  if (p.shape === 'rect') {
    p.widthMm = num(r.widthMm);
    if (r.turn90 === true) p.turn90 = true;
  }
  return invalidMagnetFields(p).length === 0 ? p : null;
}

/** Largo y ancho del imán (sin holgura): redondo = diámetro en los dos sentidos, cuadrado = lado, rectangular = ambos. */
export function magnetFootprint(p: Pick<MagnetParams, 'shape' | 'sizeMm' | 'widthMm'>): { lengthMm: number; widthMm: number } {
  return { lengthMm: p.sizeMm, widthMm: p.shape === 'rect' ? p.widthMm ?? p.sizeMm : p.sizeMm };
}

/** Área de la base del imán (sin holgura), mm². */
export function magnetBaseArea(p: Pick<MagnetParams, 'shape' | 'sizeMm' | 'widthMm'>): number {
  const f = magnetFootprint(p);
  return p.shape === 'round' ? (Math.PI * f.lengthMm * f.lengthMm) / 4 : f.lengthMm * f.widthMm;
}

/**
 * Distancia del centro al borde de la huella en la dirección (cu, cw) de la base (u, w), con semilados `halfU`
 * (largo) y `halfW` (ancho): el redondo llega a `halfU`; el cuadrado y el rectángulo, a su lado o a su esquina.
 */
export function footprintReach(shape: MagnetShape, halfU: number, halfW: number, cu: number, cw: number): number {
  if (shape === 'round') return halfU;
  const au = Math.abs(cu), aw = Math.abs(cw);
  return Math.min(au > 1e-12 ? halfU / au : Infinity, aw > 1e-12 ? halfW / aw : Infinity);
}

/** Medidas del hueco y del negativo que lo abre. */
export interface PocketDims {
  shape: MagnetShape;
  /** Diámetro, lado o largo del hueco (imán + holgura), a lo largo de `u` del marco. */
  widthMm: number;
  /** Ancho del hueco a lo largo de `w` del marco (= `widthMm` en redondo y cuadrado). */
  crossMm: number;
  /** Profundidad del hueco (alto + holgura). */
  depthMm: number;
  /** Largo del negativo a lo largo del eje. */
  lengthMm: number;
  /** Distancia de la cara al fondo del hueco (hacia adentro). */
  bottomMm: number;
  /** Distancia de la cara al techo del hueco (0 si es abierto). */
  topMm: number;
}

/**
 * Medidas del hueco. `overshootMm` es cuánto sobresale el negativo abierto sobre el plano de la cara: en caras
 * planas basta `MOUTH_OVERSHOOT_MM`; en caras cóncavas el motor lo calcula midiendo la superficie (`pocketSurface`).
 */
export function pocketDims(p: MagnetParams, overshootMm: number = MOUTH_OVERSHOOT_MM): PocketDims {
  const f = magnetFootprint(p);
  const widthMm = f.lengthMm + p.clearanceMm;
  const crossMm = f.widthMm + p.clearanceMm;
  const depthMm = p.heightMm + p.depthClearanceMm;
  if (p.hidden) {
    return { shape: p.shape, widthMm, crossMm, depthMm, lengthMm: depthMm, bottomMm: HIDDEN_COVER_MM + depthMm, topMm: HIDDEN_COVER_MM };
  }
  const over = Number.isFinite(overshootMm) && overshootMm > MOUTH_OVERSHOOT_MM ? overshootMm : MOUTH_OVERSHOOT_MM;
  return { shape: p.shape, widthMm, crossMm, depthMm, lengthMm: depthMm + over, bottomMm: depthMm, topMm: 0 };
}

/**
 * Primitiva del negativo. El cilindro es un polígono de `POCKET_SEGMENTS` lados circunscrito al círculo pedido: su
 * ancho mínimo (entre caras planas) es el diámetro del hueco, así el imán siempre entra.
 */
export function pocketPrimitive(dims: PocketDims): { type: 'cylinder' | 'box'; params: PrimitiveParams } {
  if (dims.shape !== 'round') return { type: 'box', params: { width: dims.widthMm, height: dims.lengthMm, depth: dims.crossMm } };
  const radius = dims.widthMm / 2 / Math.cos(Math.PI / POCKET_SEGMENTS);
  return { type: 'cylinder', params: { radius, height: dims.lengthMm, segments: POCKET_SEGMENTS } };
}

/** Área de la sección del negativo (la del polígono real, no la del círculo). */
export function pocketSectionArea(dims: PocketDims): number {
  if (dims.shape !== 'round') return dims.widthMm * dims.crossMm;
  const a = dims.widthMm / 2;
  return POCKET_SEGMENTS * a * a * Math.tan(Math.PI / POCKET_SEGMENTS);
}

/** Base ortonormal del hueco: `axis` = normal hacia afuera; `u`, `w` tangentes a la cara (u horizontal si se puede). */
export interface PocketFrame {
  axis: Vec3;
  u: Vec3;
  w: Vec3;
}

const vec = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);
const arr = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

export function pocketFrame(normal: Vec3): PocketFrame | null {
  const n = vec(normal);
  if (!(n.lengthSq() > 1e-12) || !n.toArray().every(Number.isFinite)) return null;
  n.normalize();
  // Tangente horizontal (perpendicular al eje Y, la altura); en caras horizontales, el eje X.
  const up = new THREE.Vector3(0, 1, 0);
  const u = Math.abs(n.dot(up)) > 0.999 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3().crossVectors(up, n).normalize();
  // u ⟂ n: re-ortogonaliza por si la normal es casi vertical.
  u.addScaledVector(n, -u.dot(n)).normalize();
  const w = new THREE.Vector3().crossVectors(u, n).normalize();
  return { axis: arr(n), u: arr(u), w: arr(w) };
}

/** Colocación del negativo: posición (centro de su base) y rotación Euler XYZ (radianes). */
export interface PocketPlacement {
  position: Vec3;
  rotation: Vec3;
  frame: PocketFrame;
  dims: PocketDims;
  primitive: { type: 'cylinder' | 'box'; params: PrimitiveParams };
}

/**
 * Base del rectangular: `u` (el largo) = vertical del mundo proyectado en la cara (su «arriba», como `faceFrame`), o
 * la tangente fija de `pocketFrame` en caras horizontales; `turn90` lo gira 90° alrededor de la normal.
 */
export function rectPocketFrame(normal: Vec3, turn90 = false): PocketFrame | null {
  const base = pocketFrame(normal);
  if (!base) return null;
  const n = vec(base.axis);
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y);
  let u = up.length() > 0.05 ? up.normalize() : vec(base.u);
  if (turn90) u = new THREE.Vector3().crossVectors(n, u).normalize();
  const w = new THREE.Vector3().crossVectors(u, n).normalize();
  return { axis: arr(n), u: arr(u), w: arr(w) };
}

export function placePocket(p: MagnetParams, point: Vec3, normal: Vec3, overshootMm?: number): PocketPlacement | null {
  const frame = p.shape === 'rect' ? rectPocketFrame(normal, p.turn90 === true) : pocketFrame(normal);
  if (!frame || !point.every(Number.isFinite)) return null;
  const dims = pocketDims(p, overshootMm);
  // Local X → u, local Y → normal (afuera), local Z → w; la base local (y = 0) va al fondo del hueco.
  const basis = new THREE.Matrix4().makeBasis(vec(frame.u), vec(frame.axis), vec(frame.w));
  const euler = new THREE.Euler().setFromRotationMatrix(basis, 'XYZ');
  const base = vec(point).addScaledVector(vec(frame.axis), -dims.bottomMm);
  return { position: arr(base), rotation: [euler.x, euler.y, euler.z], frame, dims, primitive: pocketPrimitive(dims) };
}

/**
 * Normal de mundo del triángulo `face` de una malla local con rotación y escala (normal = R·S⁻¹·n, la inversa
 * transpuesta; vale también con escala negativa). null si el triángulo es degenerado.
 */
export function worldFaceNormal(mesh: MeshData, face: number, rotation: Vec3, scale: Vec3): Vec3 | null {
  const idx = mesh.indices;
  if (!Number.isInteger(face) || face < 0 || face * 3 + 2 >= idx.length) return null;
  const at = (k: number) => {
    const i = idx[face * 3 + k] * 3;
    return new THREE.Vector3(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]);
  };
  const a = at(0);
  const n = new THREE.Vector3().crossVectors(at(1).sub(a), at(2).sub(a));
  if (!(n.lengthSq() > 1e-18)) return null;
  if (scale.some((s) => s === 0)) return null;
  n.set(n.x / scale[0], n.y / scale[1], n.z / scale[2]);
  n.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'))).normalize();
  return arr(n);
}

/**
 * Punto exacto donde un rayo de mundo corta el plano del triángulo `face` de la pieza (el visor puede dar el punto
 * sobre una copia apenas agrandada). null si el rayo es paralelo o el corte queda detrás.
 */
export function rayHitOnFace(
  mesh: MeshData, face: number, transform: { position: Vec3; rotation: Vec3; scale: Vec3 }, origin: Vec3, direction: Vec3,
): Vec3 | null {
  const idx = mesh.indices;
  if (!Number.isInteger(face) || face < 0 || face * 3 + 2 >= idx.length) return null;
  const m = new THREE.Matrix4().compose(
    vec(transform.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...transform.rotation, 'XYZ')),
    vec(transform.scale),
  );
  const pts = [0, 1, 2].map((k) => {
    const i = idx[face * 3 + k] * 3;
    return new THREE.Vector3(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]).applyMatrix4(m);
  });
  const plane = new THREE.Plane().setFromCoplanarPoints(pts[0], pts[1], pts[2]);
  const ray = new THREE.Ray(vec(origin), vec(direction).normalize());
  const hit = ray.intersectPlane(plane, new THREE.Vector3());
  return hit ? arr(hit) : null;
}
