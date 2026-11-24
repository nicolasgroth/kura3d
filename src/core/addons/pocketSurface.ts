/**
 * @file src/core/addons/pocketSurface.ts
 * @description Superficie alrededor de la boca de un alojamiento de imán en caras curvas. Mide con rayos paralelos
 * al eje cuánto sube o baja la superficie respecto del plano tangente del triángulo clicado a lo largo del borde de
 * la boca: de ahí sale la sobresalida que necesita el negativo para abrir limpio en una cara cóncava (sin láminas),
 * la profundidad útil en una convexa (cuánto sobresale el imán) y la altura local que usa la medición de pared.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { MOUTH_OVERSHOOT_MM, POCKET_SEGMENTS, type MagnetParams, type MagnetShape, type PocketFrame } from './magnetPocket';
import { addScaled, rayHits } from './meshRays';

/** Direcciones de muestreo alrededor del eje (las pares coinciden con las 8 de la medición de pared). */
export const MOUTH_DIRECTIONS = 16;
/** Tope de la sobresalida del negativo (mm): una subida mayor no es curvatura sino otra pared. */
export const MAX_MOUTH_OVERSHOOT_MM = 6;
/** Bajo esto (mm) no se avisa que el imán sobresale (por debajo de la resolución de impresión). */
export const PROTRUDE_TOLERANCE_MM = 0.05;

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
  for (const below of [depth * 0.5 + 0.0013, depth + 0.0017]) {
    const hits = rayHits(world, addScaled(base, axis, -below), axis);
    if (hits.length % 2 === 1) return Math.min(hits[0] - below, cap);
  }
  return -depth;
}

export interface MouthSurface {
  /** Sobresalida del negativo abierto sobre el plano tangente (≥ `MOUTH_OVERSHOOT_MM`). */
  overshootMm: number;
  /** Menor profundidad del hueco bajo la superficie real, en el borde del imán. */
  usefulDepthMm: number;
  /** Cuánto queda el imán fuera de la superficie (0 si asienta completo o la diferencia es despreciable). */
  protrudeMm: number;
  /** Altura de la superficie en el borde del hueco, por dirección (`MOUTH_DIRECTIONS`). */
  rimHeights: number[];
}

/** Mide la superficie alrededor de la boca de un hueco con boca en `point` (sobre la cara clicada). */
export function measureMouthSurface(world: MeshData, point: Vec3, frame: PocketFrame, p: MagnetParams): MouthSurface {
  const depth = p.heightMm + p.depthClearanceMm;
  const holeHalf = (p.sizeMm + p.clearanceMm) / 2;
  // El negativo redondo es un polígono circunscrito: su borde llega un poco más lejos que el radio del hueco.
  const outerHalf = (p.shape === 'round' ? holeHalf / Math.cos(Math.PI / POCKET_SEGMENTS) : holeHalf) * 1.04 + 0.05;
  const cap = Math.min(MAX_MOUTH_OVERSHOOT_MM, outerHalf * 1.5);
  const heightAt = (k: number, half: number) => {
    const { dir, reach } = rimDirection(frame, k, p.shape, half);
    return surfaceHeight(world, addScaled(point, dir, reach), frame.axis, depth, cap);
  };
  let rise = 0;
  let minAtMagnet = Infinity;
  const rimHeights: number[] = [];
  for (let k = 0; k < MOUTH_DIRECTIONS; k++) {
    const atRim = heightAt(k, holeHalf);
    rimHeights.push(atRim);
    rise = Math.max(rise, atRim, heightAt(k, outerHalf), heightAt(k, holeHalf * 0.5));
    minAtMagnet = Math.min(minAtMagnet, heightAt(k, p.sizeMm / 2));
  }
  const overshootMm = Math.min(MAX_MOUTH_OVERSHOOT_MM, Math.max(MOUTH_OVERSHOOT_MM, rise + MOUTH_OVERSHOOT_MM));
  const usefulDepthMm = depth + Math.min(0, minAtMagnet);
  const lack = p.heightMm - usefulDepthMm;
  return { overshootMm, usefulDepthMm, protrudeMm: !p.hidden && lack >= PROTRUDE_TOLERANCE_MM ? lack : 0, rimHeights };
}
