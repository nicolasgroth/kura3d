/**
 * @file src/engine/split/splitJointIslands.ts
 * @description Informe por islas de la cara de una unión de "dividir para imprimir": qué isla lleva
 * conector (algún centro cae dentro de ella), cuál solape y cuál queda solo para pegar, con su área y
 * ancho típico. Las islas viven en la sección orientada (plano del eje en z' = coordenada, misma
 * convención que `cutConnectorLayout.ts`): y → (x, −z); x → (−z, y); z → (x, y).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { islandWidth } from './splitSections';
import type { SplitAxis, SplitJointIsland } from './splitTypes';

/** Punto mundial → coordenadas (u, v) de la sección orientada del eje. */
export function worldToSectionUV(axis: SplitAxis, p: Vec3): [number, number] {
  if (axis === 'z') return [p[0], p[1]];
  if (axis === 'y') return [p[0], -p[2]];
  return [-p[2], p[1]];
}

/** Regla par-impar sobre todos los contornos (los agujeros quedan fuera). */
export function sectionContains(cs: CrossSection, uv: [number, number]): boolean {
  let inside = false;
  for (const poly of cs.toPolygons() as Array<Array<[number, number]>>) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > uv[1] !== yj > uv[1] && uv[0] < ((xj - xi) * (uv[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/**
 * Clasifica las islas de la cara. `lapAccepted[i]` = la isla i recibió solape (ver `buildLapSolids`).
 * No libera las islas.
 */
export function classifyIslands(islands: CrossSection[], axis: SplitAxis, centers: Vec3[], lapAccepted?: boolean[]): SplitJointIsland[] {
  const uvs = centers.map((c) => worldToSectionUV(axis, c));
  return islands.map((isl, i) => {
    const areaMm2 = isl.area();
    const minWidthMm = islandWidth(isl, areaMm2);
    const kind: SplitJointIsland['kind'] = uvs.some((uv) => sectionContains(isl, uv)) ? 'connector' : lapAccepted?.[i] ? 'lap' : 'glue';
    return { kind, areaMm2, minWidthMm };
  });
}
