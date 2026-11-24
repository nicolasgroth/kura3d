/**
 * @file src/core/addons/pocketAnalysis.ts
 * @description Análisis completo de un alojamiento de imán antes de crearlo, sobre mallas de mundo: superficie de la
 * boca (sobresalida en caras cóncavas, imán que sobresale en convexas, tapa real del imán oculto, borde de la pieza),
 * pared alrededor del hueco, huecos pendientes vecinos y cuánto del hueco cae dentro de la pieza (un imán más grande
 * que la pieza la eliminaría al restar). Función pura, sin el motor Manifold: corre en el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { placePocket, type MagnetParams, type PocketPlacement } from './magnetPocket';
import { pocketFillRatio } from './pocketFill';
import { measurePocketNeighbors, type NeighborProbe } from './pocketNeighbors';
import { measureMouthSurface } from './pocketSurface';
import { measurePocketWall, type PocketWallReport } from './pocketWall';

/** Fracción de la pieza que puede ocupar el hueco; más que esto, la resta se la come (se impide la colocación). */
export const MAX_POCKET_FILL = 0.6;

export interface PocketAnalysis {
  plan: PocketPlacement;
  wall: PocketWallReport;
  /** Volumen del hueco dentro de la pieza / volumen de la pieza (0–1, aproximado por muestreo). */
  fill: number;
  /** La boca sale por lados opuestos de la cara: el imán es más ancho que la pieza ahí. */
  spansFace: boolean;
}

/**
 * Analiza el hueco con boca en `point` y normal `normal` sobre la pieza `world` (malla de mundo, cerrada), con los
 * negativos pendientes `others` (mallas de mundo). null si la normal o el punto no sirven.
 */
export function analyzePocket(
  world: MeshData, params: MagnetParams, point: Vec3, normal: Vec3, others: readonly MeshData[],
): PocketAnalysis | null {
  const flat = placePocket(params, point, normal);
  if (!flat) return null;
  // Caras curvas: la sobresalida cubre lo que sube la superficie en el borde de la boca.
  const surface = measureMouthSurface(world, point, flat.frame, params);
  const plan = placePocket(params, point, normal, surface.overshootMm)!;
  const probe: NeighborProbe = { rays: [] };
  const wall = measurePocketWall(world, point, plan.frame, plan.dims, {
    rimHeights: surface.rimHeights,
    onRay: (origin, dir, hostWall) => probe.rays.push({ origin, dir, hostWall }),
  });
  const neighbor = others.length > 0 ? measurePocketNeighbors(world, point, plan.frame, plan.dims, others, probe) : null;
  const fill = pocketFillRatio(world, plan);
  return {
    plan,
    wall: {
      ...wall,
      // El hueco que sale por el costado de la pieza (borde) también se asoma, aunque la pared no lo vea.
      through: wall.through || surface.edgeExit,
      minWallMm: surface.edgeExit ? 0 : wall.minWallMm,
      protrudeMm: surface.protrudeMm,
      coverMm: surface.coverMm,
      neighbor,
    },
    fill,
    spansFace: surface.spansFace,
  };
}
