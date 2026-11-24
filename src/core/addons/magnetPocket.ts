/**
 * @file src/core/addons/magnetPocket.ts
 * @description Alojamiento de imán: parámetros (forma, medidas, holguras, abierto u oculto), su validación y saneo,
 * las medidas del hueco y la colocación del negativo sobre una cara (eje = normal de la cara, boca a ras con
 * sobresalida hacia afuera, o tapado por 0,6 mm de material). Funciones puras; el negativo es una primitiva
 * paramétrica (cilindro o caja) con su base en el fondo del hueco y su eje +Y local apuntando hacia afuera.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { MeshData, PrimitiveParams, Vec3 } from '../../types/kura';

export type MagnetShape = 'round' | 'square';

/** Imán pedido: `sizeMm` es el diámetro (redondo) o el lado (cuadrado); `heightMm` su alto. */
export interface MagnetParams {
  shape: MagnetShape;
  sizeMm: number;
  heightMm: number;
  /** Holgura sumada al diámetro o lado. */
  clearanceMm: number;
  /** Holgura sumada a la profundidad. */
  depthClearanceMm: number;
  /** Oculto bajo la cara (queda `HIDDEN_COVER_MM` de material encima; requiere pausar la impresión). */
  hidden: boolean;
}

export const MAGNET_DEFAULTS: Readonly<MagnetParams> = {
  shape: 'round', sizeMm: 5, heightMm: 2, clearanceMm: 0.2, depthClearanceMm: 0.2, hidden: false,
};

/** Rangos de edición (mm). */
export const MAGNET_RANGES = {
  sizeMm: { min: 1, max: 60 },
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

/** Campos fuera de rango (vacío = válido). */
export function invalidMagnetFields(p: MagnetParams): MagnetNumericField[] {
  return (Object.keys(MAGNET_RANGES) as MagnetNumericField[]).filter((field) => {
    const v = p[field];
    const r = MAGNET_RANGES[field];
    return !(Number.isFinite(v) && v >= r.min && v <= r.max);
  });
}

/** Parámetros válidos a partir de datos no confiables (preferencias, `.kura`); null si no sirven. */
export function sanitizeMagnetParams(raw: unknown): MagnetParams | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.shape !== 'round' && r.shape !== 'square') return null;
  const num = (v: unknown, fallback?: number) => (v === undefined && fallback !== undefined ? fallback : typeof v === 'number' ? v : NaN);
  const p: MagnetParams = {
    shape: r.shape,
    sizeMm: num(r.sizeMm),
    heightMm: num(r.heightMm),
    clearanceMm: num(r.clearanceMm, MAGNET_DEFAULTS.clearanceMm),
    depthClearanceMm: num(r.depthClearanceMm, MAGNET_DEFAULTS.depthClearanceMm),
    hidden: r.hidden === true,
  };
  return invalidMagnetFields(p).length === 0 ? p : null;
}

/** Medidas del hueco y del negativo que lo abre. */
export interface PocketDims {
  shape: MagnetShape;
  /** Diámetro o lado del hueco (imán + holgura). */
  widthMm: number;
  /** Profundidad del hueco (alto + holgura). */
  depthMm: number;
  /** Largo del negativo a lo largo del eje. */
  lengthMm: number;
  /** Distancia de la cara al fondo del hueco (hacia adentro). */
  bottomMm: number;
  /** Distancia de la cara al techo del hueco (0 si es abierto). */
  topMm: number;
}

export function pocketDims(p: MagnetParams): PocketDims {
  const widthMm = p.sizeMm + p.clearanceMm;
  const depthMm = p.heightMm + p.depthClearanceMm;
  if (p.hidden) {
    return { shape: p.shape, widthMm, depthMm, lengthMm: depthMm, bottomMm: HIDDEN_COVER_MM + depthMm, topMm: HIDDEN_COVER_MM };
  }
  return { shape: p.shape, widthMm, depthMm, lengthMm: depthMm + MOUTH_OVERSHOOT_MM, bottomMm: depthMm, topMm: 0 };
}

/**
 * Primitiva del negativo. El cilindro es un polígono de `POCKET_SEGMENTS` lados circunscrito al círculo pedido: su
 * ancho mínimo (entre caras planas) es el diámetro del hueco, así el imán siempre entra.
 */
export function pocketPrimitive(dims: PocketDims): { type: 'cylinder' | 'box'; params: PrimitiveParams } {
  if (dims.shape === 'square') return { type: 'box', params: { width: dims.widthMm, height: dims.lengthMm, depth: dims.widthMm } };
  const radius = dims.widthMm / 2 / Math.cos(Math.PI / POCKET_SEGMENTS);
  return { type: 'cylinder', params: { radius, height: dims.lengthMm, segments: POCKET_SEGMENTS } };
}

/** Área de la sección del negativo (la del polígono real, no la del círculo). */
export function pocketSectionArea(dims: PocketDims): number {
  if (dims.shape === 'square') return dims.widthMm * dims.widthMm;
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

export function placePocket(p: MagnetParams, point: Vec3, normal: Vec3): PocketPlacement | null {
  const frame = pocketFrame(normal);
  if (!frame || !point.every(Number.isFinite)) return null;
  const dims = pocketDims(p);
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
