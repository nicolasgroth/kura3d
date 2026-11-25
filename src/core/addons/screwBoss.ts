/**
 * @file src/core/addons/screwBoss.ts
 * @description Torreta para tornillo: parámetros (tornillo directo o inserto roscado, medida, agujero, alto y
 * diámetro del poste), su validación y saneo, y la geometría pura: el poste (cilindro que se asienta en la cara y se
 * hunde lo necesario para unirse sin rendijas) y el agujero ciego coaxial con chaflán de entrada de 0,5 mm, ambos
 * como sólidos de revolución con su base en el origen local y el eje +Y hacia afuera de la cara. La orientación usa
 * la misma base que el alojamiento de imán (`pocketFrame`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { MeshData, ScrewBossParams, Vec3 } from '../../types/kura';
import { MIN_WALL_MM, pocketFrame, type PocketFrame } from './magnetPocket';
import { revolveProfile, type ProfilePoint } from './revolveMesh';

export type { ScrewBossParams };
export type ScrewBossType = ScrewBossParams['type'];

/** Chaflán de entrada del agujero (mm, a 45°). */
export const BOSS_CHAMFER_MM = 0.5;
/** Cuánto sobresale el negativo del agujero sobre la boca del poste para que la resta abra limpio. */
export const BOSS_HOLE_OVERSHOOT_MM = 0.3;
/** Cuánto se hunde el poste bajo la cara, además de lo que baje la superficie, para unirse sin rendijas. */
export const BOSS_SEAT_OVERLAP_MM = 0.3;
/** Lados del poste y del agujero. */
export const BOSS_SEGMENTS = 64;
/** Pared mínima del poste alrededor del agujero (la misma del imán: 3 perímetros de 0,4 mm). */
export const BOSS_MIN_WALL_MM = MIN_WALL_MM;

export const SCREW_BOSS_RANGES = {
  nominalMm: { min: 1, max: 12 },
  holeDiameterMm: { min: 0.8, max: 20 },
  holeDepthMm: { min: 1, max: 60 },
  heightMm: { min: 1, max: 100 },
  outerDiameterMm: { min: 2, max: 60 },
} as const;

export type ScrewBossNumericField = keyof typeof SCREW_BOSS_RANGES;

/** Diámetro exterior por defecto: 2,5 × nominal, sin bajar de agujero + 2 × pared mínima. */
export function defaultOuterDiameter(nominalMm: number, holeDiameterMm: number): number {
  return Math.round(Math.max(2.5 * nominalMm, holeDiameterMm + 2 * BOSS_MIN_WALL_MM) * 100) / 100;
}

/** Campos fuera de rango, o el diámetro exterior si no deja pared alrededor del agujero (vacío = válido). */
export function invalidScrewBossFields(p: ScrewBossParams): ScrewBossNumericField[] {
  const bad = (Object.keys(SCREW_BOSS_RANGES) as ScrewBossNumericField[]).filter((field) => {
    const v = p[field];
    const r = SCREW_BOSS_RANGES[field];
    return !(Number.isFinite(v) && v >= r.min && v <= r.max);
  });
  if (!bad.includes('outerDiameterMm') && !bad.includes('holeDiameterMm') && !(p.outerDiameterMm > p.holeDiameterMm + 2 * BOSS_CHAMFER_MM)) {
    bad.push('outerDiameterMm');
  }
  return bad;
}

/** Parámetros válidos a partir de datos no confiables (preferencias, `.kura`); null si no sirven. */
export function sanitizeScrewBossParams(raw: unknown): ScrewBossParams | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.type !== 'screw' && r.type !== 'insert') return null;
  const num = (v: unknown) => (typeof v === 'number' ? v : NaN);
  const p: ScrewBossParams = {
    type: r.type,
    nominalMm: num(r.nominalMm),
    holeDiameterMm: num(r.holeDiameterMm),
    holeDepthMm: num(r.holeDepthMm),
    heightMm: num(r.heightMm),
    outerDiameterMm: num(r.outerDiameterMm),
  };
  return invalidScrewBossFields(p).length === 0 ? p : null;
}

/** Pared del poste alrededor del agujero (mm). */
export const bossWallMm = (p: Pick<ScrewBossParams, 'outerDiameterMm' | 'holeDiameterMm'>) => (p.outerDiameterMm - p.holeDiameterMm) / 2;

/** Radio de vértice para que el polígono de `BOSS_SEGMENTS` lados tenga `apothem` entre caras planas (el tornillo entra). */
const circumscribed = (apothem: number) => apothem / Math.cos(Math.PI / BOSS_SEGMENTS);

/**
 * Perfil del agujero (r, y) con la base (fondo) en y = 0: tramo recto del diámetro pedido, chaflán de 45° de
 * `BOSS_CHAMFER_MM` hasta la boca (y = profundidad) y la sobresalida, que sigue abriendo a 45° sobre la boca.
 */
export function bossHoleProfile(p: Pick<ScrewBossParams, 'holeDiameterMm' | 'holeDepthMm'>): ProfilePoint[] {
  const r = circumscribed(p.holeDiameterMm / 2);
  const d = p.holeDepthMm;
  const c = Math.min(BOSS_CHAMFER_MM, d / 2);
  const o = BOSS_HOLE_OVERSHOOT_MM;
  const k = 1 / Math.cos(Math.PI / BOSS_SEGMENTS);
  return [[0, 0], [r, 0], [r, d - c], [r + c * k, d], [r + (c + o) * k, d + o], [0, d + o]];
}

/** Malla local del agujero (base en el fondo, eje +Y hacia la boca). */
export const bossHoleMesh = (p: ScrewBossParams): MeshData => revolveProfile(bossHoleProfile(p), BOSS_SEGMENTS);

/** Malla local del poste: cilindro de `heightMm + seatMm` con la base en y = 0 (hundida `seatMm` bajo la cara). */
export function bossPostMesh(p: Pick<ScrewBossParams, 'outerDiameterMm' | 'heightMm'>, seatMm: number): MeshData {
  const r = p.outerDiameterMm / 2;
  return revolveProfile([[0, 0], [r, 0], [r, p.heightMm + seatMm], [0, p.heightMm + seatMm]], BOSS_SEGMENTS);
}

/** Área de la sección de un polígono regular de `BOSS_SEGMENTS` lados con esa apotema. */
const polygonArea = (apothem: number) => BOSS_SEGMENTS * apothem * apothem * Math.tan(Math.PI / BOSS_SEGMENTS);

/** Volumen que el agujero quita dentro del material (del fondo a la boca, chaflán incluido; la sobresalida es aire). */
export function bossHoleVolumeMm3(p: Pick<ScrewBossParams, 'holeDiameterMm' | 'holeDepthMm'>): number {
  const a1 = p.holeDiameterMm / 2;
  const c = Math.min(BOSS_CHAMFER_MM, p.holeDepthMm / 2);
  const a2 = a1 + c;
  const k = BOSS_SEGMENTS * Math.tan(Math.PI / BOSS_SEGMENTS);
  return polygonArea(a1) * (p.holeDepthMm - c) + k * (c / 3) * (a1 * a1 + a1 * a2 + a2 * a2);
}

/** Volumen del poste sobre la cara (polígono con vértices sobre el círculo exterior). */
export function bossPostVolumeAboveMm3(p: Pick<ScrewBossParams, 'outerDiameterMm' | 'heightMm'>): number {
  const r = p.outerDiameterMm / 2;
  return (BOSS_SEGMENTS / 2) * r * r * Math.sin((2 * Math.PI) / BOSS_SEGMENTS) * p.heightMm;
}

/** Colocación de la torreta: base (posición) del poste y del agujero, rotación común y anclas para seguir a la pieza. */
export interface ScrewBossPlan {
  frame: PocketFrame;
  rotation: Vec3;
  seatMm: number;
  post: { position: Vec3; anchorMm: number };
  hole: { position: Vec3; anchorMm: number };
}

const vec = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);
const arr = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

/**
 * Torreta con su asiento en `point` (sobre la cara) y eje según `normal` (hacia afuera). `seatMm` es cuánto se
 * hunde la base del poste bajo el punto (en caras curvas lo mide `analyzeScrewBoss`). null si la normal no sirve.
 */
export function placeScrewBoss(p: ScrewBossParams, point: Vec3, normal: Vec3, seatMm: number = BOSS_SEAT_OVERLAP_MM): ScrewBossPlan | null {
  const frame = pocketFrame(normal);
  if (!frame || !point.every(Number.isFinite)) return null;
  const seat = Number.isFinite(seatMm) && seatMm > 0 ? seatMm : BOSS_SEAT_OVERLAP_MM;
  const basis = new THREE.Matrix4().makeBasis(vec(frame.u), vec(frame.axis), vec(frame.w));
  const euler = new THREE.Euler().setFromRotationMatrix(basis, 'XYZ');
  const axis = vec(frame.axis);
  const postBase = vec(point).addScaledVector(axis, -seat);
  // El fondo del agujero queda `holeDepthMm` bajo la boca del poste (que está `heightMm` sobre la cara).
  const holeBase = vec(point).addScaledVector(axis, p.heightMm - p.holeDepthMm);
  return {
    frame,
    rotation: [euler.x, euler.y, euler.z],
    seatMm: seat,
    post: { position: arr(postBase), anchorMm: seat },
    hole: { position: arr(holeBase), anchorMm: p.holeDepthMm - p.heightMm },
  };
}

/** Dos torretas son iguales si coinciden tipo y todas sus medidas. */
export function sameScrewBoss(a: ScrewBossParams, b: ScrewBossParams): boolean {
  return a.type === b.type && a.nominalMm === b.nominalMm && a.holeDiameterMm === b.holeDiameterMm
    && a.holeDepthMm === b.holeDepthMm && a.heightMm === b.heightMm && a.outerDiameterMm === b.outerDiameterMm;
}
