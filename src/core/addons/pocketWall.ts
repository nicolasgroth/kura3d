/**
 * @file src/core/addons/pocketWall.ts
 * @description Pared que queda alrededor de un hueco (alojamiento de imán) dentro de una pieza, medida con rayos
 * sobre la malla de mundo: desde el borde del hueco hacia afuera en 8 direcciones a tres alturas, y desde el fondo
 * hacia adentro. En caras curvas se ignora lo que queda fuera del sólido por la boca: una altura que ya está sobre
 * la superficie local no se mide, y un rayo que sale por la misma superficie de la boca (normal parecida al eje) no
 * es pared sino el labio del hueco. Si un punto que debía estar dentro queda fuera, el hueco atraviesa: pared 0.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { footprintReach, type PocketDims, type PocketFrame } from './magnetPocket';
import { addScaled, dot3, rayHitsDetailed } from './meshRays';
import { MOUTH_DIRECTIONS } from './pocketSurface';

export { rayHits } from './meshRays';

/** Otro hueco pendiente cerca: separación mínima medida o superposición. */
export interface PocketNeighbor {
  gapMm: number;
  overlap: boolean;
}

export interface PocketWallReport {
  /** Pared mínima medida en mm (0 si el hueco atraviesa o se asoma por otra cara). */
  minWallMm: number;
  /** Dónde está la pared mínima. */
  side: 'bottom' | 'side';
  /** El hueco sale de la pieza por otra cara. */
  through: boolean;
  /**
   * false si ningún rayo lateral dio una medida (todas las alturas sobre la superficie local o solo el labio de la
   * boca): la pared lateral queda sin medir y `minWallMm` es solo la del fondo. Ausente en informes anteriores = true.
   */
  sideMeasured?: boolean;
  /** En una cara convexa, cuánto sobresale el imán sobre la superficie (0 si asienta completo). */
  protrudeMm: number;
  /** Otro hueco pendiente a menos de la pared mínima, o superpuesto (null si no hay). */
  neighbor: PocketNeighbor | null;
  /** Imán oculto: material real sobre el imán en su borde (≤ 0 si se abre); null o ausente si es abierto. */
  coverMm?: number | null;
}

/** Un corte cuya normal forma menos de ~41° con el eje es la misma superficie de la boca, no una pared lateral. */
const MOUTH_SURFACE_COS = 0.75;
/** Una altura de medición debe quedar al menos esto bajo la superficie local para contar como pared. */
const LEVEL_MARGIN_MM = 0.2;

export interface PocketWallOptions {
  /** Altura de la superficie sobre el plano tangente en el borde del hueco, por dirección (`MOUTH_DIRECTIONS`). */
  rimHeights?: number[];
  /** Se llama por cada rayo de medición (origen dentro del material junto al hueco y dirección hacia afuera). */
  onRay?: (origin: Vec3, dir: Vec3, hostWall: number) => void;
}

/**
 * Direcciones (radianes en la base u, w) en que se mide la pared lateral: ocho repartidas en el redondo; en cuadrado
 * y rectángulo, los cuatro lados y las cuatro esquinas (en el cuadrado coinciden con las ocho repartidas).
 */
function wallAngles(dims: PocketDims): number[] {
  if (dims.shape === 'round') return [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (k * Math.PI) / 4);
  const c = Math.atan2(dims.crossMm, dims.widthMm);
  return [0, c, Math.PI / 2, Math.PI - c, Math.PI, Math.PI + c, (3 * Math.PI) / 2, 2 * Math.PI - c];
}

/** Mide la pared alrededor del hueco con boca en `point` (sobre la cara) y la base `frame`. */
export function measurePocketWall(
  world: MeshData, point: Vec3, frame: PocketFrame, dims: PocketDims, options: PocketWallOptions = {},
): Omit<PocketWallReport, 'protrudeMm' | 'neighbor' | 'coverMm'> {
  const half = dims.widthMm / 2;
  const halfW = dims.crossMm / 2;
  const inward: Vec3 = [-frame.axis[0], -frame.axis[1], -frame.axis[2]];
  let side = Infinity;
  // Tres alturas dentro del hueco, medidas desde la cara hacia adentro (no la boca: ahí no hay pared que medir).
  for (const f of [0.2, 0.5, 0.9]) {
    const level = dims.topMm + dims.depthMm * f;
    const center = addScaled(point, inward, level);
    for (const ang of wallAngles(dims)) {
      // En una cara convexa la superficie baja hacia el borde: sobre ella no hay material que medir.
      const k = Math.round((ang / (2 * Math.PI)) * MOUTH_DIRECTIONS + MOUTH_DIRECTIONS) % MOUTH_DIRECTIONS;
      const rimHeight = options.rimHeights?.[k] ?? 0;
      if (level + Math.min(0, rimHeight) < LEVEL_MARGIN_MM) continue;
      const cu = Math.cos(ang), cw = Math.sin(ang);
      const dir: Vec3 = [frame.u[0] * cu + frame.w[0] * cw, frame.u[1] * cu + frame.w[1] * cw, frame.u[2] * cu + frame.w[2] * cw];
      // Distancia del eje al borde en esa dirección (cuadrado y rectángulo llegan más lejos hacia sus esquinas).
      const reach = footprintReach(dims.shape, half, halfW, cu, cw);
      const origin = addScaled(center, dir, reach);
      const hits = rayHitsDetailed(world, origin, dir);
      let wall: number;
      if (hits.length % 2 === 0) wall = 0;
      else if (dot3(hits[0].normal, frame.axis) > MOUTH_SURFACE_COS) wall = Infinity;
      else wall = hits[0].dist;
      side = Math.min(side, wall);
      options.onRay?.(origin, dir, wall);
    }
  }
  // Fondo: centro y cuatro puntos cerca del borde.
  let bottom = Infinity;
  const floor = addScaled(point, inward, dims.bottomMm);
  const offsets: Array<[number, number]> = [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]];
  for (const [a, b] of offsets) {
    const origin = addScaled(addScaled(floor, frame.u, a * half), frame.w, b * halfW);
    const hits = rayHitsDetailed(world, origin, inward);
    const wall = hits.length % 2 === 1 ? hits[0].dist : 0;
    bottom = Math.min(bottom, wall);
    options.onRay?.(origin, inward, wall);
  }
  // Sin ningún rayo lateral válido (cara convexa: todas las alturas sobre la superficie local) la pared lateral es
  // «sin medida», no infinita: `minWallMm` es lo medido (el fondo, siempre finito), así el aviso de pared sigue
  // saltando si el fondo es delgado, y `sideMeasured: false` lo deja explícito en el informe.
  const sideMeasured = Number.isFinite(side);
  const minWallMm = sideMeasured ? Math.min(side, bottom) : bottom;
  return { minWallMm, side: !sideMeasured || bottom <= side ? 'bottom' : 'side', through: minWallMm <= 0, sideMeasured };
}
