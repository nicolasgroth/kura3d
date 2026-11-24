/**
 * @file src/core/addons/pocketSurface.ts
 * @description Superficie alrededor de la boca de un alojamiento de imán en caras curvas. Mide con rayos paralelos
 * al eje cuánto sube o baja la superficie respecto del plano tangente del triángulo clicado a lo largo del borde de
 * la boca: de ahí sale la sobresalida que necesita el negativo para abrir limpio en una cara cóncava (sin láminas),
 * la profundidad útil en una convexa (cuánto sobresale el imán), la tapa real de un imán oculto a lo largo del borde
 * (en una convexa adelgaza hacia el borde) y la altura local que usa la medición de pared. Distingue curvatura de
 * falta de material: si en el borde no hay pieza y un rayo lateral desde el eje sale por una cara de costado, el
 * hueco se asoma por el borde de la pieza (no es una curva).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { HIDDEN_COVER_MM, MOUTH_OVERSHOOT_MM, POCKET_SEGMENTS, type MagnetParams, type MagnetShape, type PocketFrame } from './magnetPocket';
import { addScaled, dot3, rayHits, rayHitsDetailed } from './meshRays';

/** Direcciones de muestreo alrededor del eje (las pares coinciden con las 8 de la medición de pared). */
export const MOUTH_DIRECTIONS = 16;
/** Tope de la sobresalida del negativo (mm): una subida mayor no es curvatura sino otra pared. */
export const MAX_MOUTH_OVERSHOOT_MM = 6;
/** Bajo esto (mm) no se avisa que el imán sobresale (por debajo de la resolución de impresión). */
export const PROTRUDE_TOLERANCE_MM = 0.05;
/** Tapa mínima de un imán oculto (mm): menos se rompe al imprimir o al primer uso. */
export const MIN_COVER_MM = 0.4;
/** Tapa bajo esto (mm) es un hueco abierto: el imán queda a la vista. */
export const OPEN_COVER_MM = 0.05;
/** Un corte cuya normal forma más de ~41° con el eje es una cara de costado (borde de la pieza), no la boca curva. */
const SIDE_FACE_COS = 0.75;

/** Dirección tangente `k` de `MOUTH_DIRECTIONS` y el alcance del borde en ella (el cuadrado llega más lejos en las diagonales). */
export function rimDirection(frame: PocketFrame, k: number, shape: MagnetShape, half: number): { dir: Vec3; reach: number } {
  const ang = (k * 2 * Math.PI) / MOUTH_DIRECTIONS;
  const cu = Math.cos(ang), cw = Math.sin(ang);
  const dir: Vec3 = [frame.u[0] * cu + frame.w[0] * cw, frame.u[1] * cu + frame.w[1] * cw, frame.u[2] * cu + frame.w[2] * cw];
  const reach = shape === 'square' ? half / Math.max(Math.abs(cu), Math.abs(cw)) : half;
  return { dir, reach };
}

/**
 * Altura de la superficie (mm, + hacia afuera) sobre el plano tangente en el punto `base` del plano, buscada por el
 * eje entre −`depth` y +`cap`. Parte desde dentro del material (mitad y fondo del hueco) para no arrancar justo sobre
 * la cara; si ninguno está dentro, la superficie baja más que `depth` (o hay un vacío): −`depth`.
 */
export function surfaceHeight(world: MeshData, base: Vec3, axis: Vec3, depth: number, cap: number): number {
  return surfaceSample(world, base, axis, depth, cap, null).height;
}

/** Muestra de superficie; `edge` = no hay pieza en ese punto porque el hueco sale por una cara de costado. */
interface SurfaceSample {
  height: number;
  edge: boolean;
}

/**
 * Como `surfaceHeight`; si no hay material bajo `base` y se da `fromAxis` (punto del eje en el plano tangente y la
 * dirección y alcance hasta `base`), mira con un rayo lateral desde el eje si lo que falta es pieza (cara de costado
 * antes del borde) o la superficie curva que baja.
 */
function surfaceSample(
  world: MeshData, base: Vec3, axis: Vec3, depth: number, cap: number, fromAxis: { point: Vec3; dir: Vec3; reach: number } | null,
): SurfaceSample {
  const levels = [depth * 0.5 + 0.0013, depth + 0.0017];
  for (const below of levels) {
    const hits = rayHits(world, addScaled(base, axis, -below), axis);
    if (hits.length % 2 === 1) return { height: Math.min(hits[0] - below, cap), edge: false };
  }
  if (fromAxis) {
    for (const below of levels) {
      const start = addScaled(fromAxis.point, axis, -below);
      const hits = rayHitsDetailed(world, start, fromAxis.dir);
      if (hits.length % 2 === 0) continue;
      const first = hits[0];
      if (first.dist < fromAxis.reach && dot3(first.normal, axis) < SIDE_FACE_COS) return { height: -depth, edge: true };
    }
  }
  return { height: -depth, edge: false };
}

export interface MouthSurface {
  /** Sobresalida del negativo abierto sobre el plano tangente (≥ `MOUTH_OVERSHOOT_MM`). */
  overshootMm: number;
  /** Menor profundidad del hueco bajo la superficie real, en el borde del imán. */
  usefulDepthMm: number;
  /** Cuánto queda el imán fuera de la superficie (0 si asienta completo o la diferencia es despreciable). */
  protrudeMm: number;
  /** Imán oculto: menor material sobre el hueco a lo largo de su borde (≤ 0 si se abre); null si es abierto. */
  coverMm: number | null;
  /** El hueco sale por una cara de costado de la pieza (se coloca junto al borde): se asoma. */
  edgeExit: boolean;
  /** Altura de la superficie en el borde del hueco, por dirección (`MOUTH_DIRECTIONS`); 0 donde sale por el borde. */
  rimHeights: number[];
  /** El borde del hueco sale de la pieza en direcciones opuestas: la boca es más ancha que la cara. */
  spansFace: boolean;
}

/** Mide la superficie alrededor de la boca de un hueco con boca en `point` (sobre la cara clicada). */
export function measureMouthSurface(world: MeshData, point: Vec3, frame: PocketFrame, p: MagnetParams): MouthSurface {
  const depth = p.heightMm + p.depthClearanceMm;
  // Oculto: el hueco llega hasta la tapa más su profundidad; hasta ahí se busca la superficie.
  const searchDepth = p.hidden ? HIDDEN_COVER_MM + depth : depth;
  const holeHalf = (p.sizeMm + p.clearanceMm) / 2;
  // El negativo redondo es un polígono circunscrito: su borde llega un poco más lejos que el radio del hueco.
  const outerHalf = (p.shape === 'round' ? holeHalf / Math.cos(Math.PI / POCKET_SEGMENTS) : holeHalf) * 1.04 + 0.05;
  const cap = Math.min(MAX_MOUTH_OVERSHOOT_MM, outerHalf * 1.5);
  const sampleAt = (k: number, half: number, lateral: boolean) => {
    const { dir, reach } = rimDirection(frame, k, p.shape, half);
    return surfaceSample(world, addScaled(point, dir, reach), frame.axis, searchDepth, cap, lateral ? { point, dir, reach } : null);
  };
  let rise = 0;
  let minAtMagnet = Infinity;
  let minAtRim = Infinity;
  let edgeExit = false;
  const rimHeights: number[] = [];
  const rimEdge: boolean[] = [];
  for (let k = 0; k < MOUTH_DIRECTIONS; k++) {
    const atRim = sampleAt(k, holeHalf, true);
    const atMagnet = sampleAt(k, p.sizeMm / 2, true);
    rimEdge.push(atRim.edge || atMagnet.edge);
    // Donde falta pieza (borde), no hay curva: no cuenta para la sobresalida, y la pared se mide ahí (atraviesa).
    edgeExit ||= atRim.edge || atMagnet.edge;
    rimHeights.push(atRim.edge ? 0 : atRim.height);
    rise = Math.max(rise, atRim.height, sampleAt(k, outerHalf, false).height, sampleAt(k, holeHalf * 0.5, false).height);
    if (!atMagnet.edge) minAtMagnet = Math.min(minAtMagnet, atMagnet.height);
    if (!atRim.edge) minAtRim = Math.min(minAtRim, atRim.height);
  }
  const overshootMm = Math.min(MAX_MOUTH_OVERSHOOT_MM, Math.max(MOUTH_OVERSHOOT_MM, rise + MOUTH_OVERSHOOT_MM));
  const usefulDepthMm = depth + Math.min(0, Number.isFinite(minAtMagnet) ? minAtMagnet : 0);
  const lack = p.heightMm - usefulDepthMm;
  const protrudeMm = !p.hidden && lack >= PROTRUDE_TOLERANCE_MM ? lack : 0;
  const coverMm = p.hidden ? HIDDEN_COVER_MM + Math.min(0, Number.isFinite(minAtRim) ? minAtRim : 0) : null;
  const half = MOUTH_DIRECTIONS / 2;
  const spansFace = rimEdge.some((e, k) => e && rimEdge[(k + half) % MOUTH_DIRECTIONS]);
  return { overshootMm, usefulDepthMm, protrudeMm, coverMm, edgeExit, rimHeights, spansFace };
}
