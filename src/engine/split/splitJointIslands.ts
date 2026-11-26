/**
 * @file src/engine/split/splitJointIslands.ts
 * @description Informe por islas de la cara de una unión de "dividir para imprimir": qué isla lleva
 * conector (algún centro cae dentro de ella), cuál solape y cuál queda solo para pegar, con su área y
 * ancho típico. Las islas viven en la sección orientada (plano del eje en z' = coordenada, misma
 * convención que `cutConnectorLayout.ts`): y → (x, −z); x → (−z, y); z → (x, y).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { CrossSection } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { type Vec2 } from '../cutConnectorPolygonIndex';
import { inscribedCircle } from '../jointSection';
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

/** Isla clasificada; el ancho útil se mide solo en las que quedan para pegar (es la medida que se informa). */
function islandInfo(isl: CrossSection, kind: SplitJointIsland['kind']): SplitJointIsland {
  const areaMm2 = isl.area();
  const minWidthMm = islandWidth(isl, areaMm2);
  if (kind !== 'glue') return { kind, areaMm2, minWidthMm };
  const usableWidthMm = 2 * inscribedCircle(isl.toPolygons() as Vec2[][]).radius;
  return { kind, areaMm2, minWidthMm, usableWidthMm: Math.round(usableWidthMm * 100) / 100 };
}

/**
 * Clasifica las islas de la cara. `lapAccepted[i]` = la isla i recibió solape (ver `buildLapSolids`).
 * No libera las islas.
 */
export function classifyIslands(islands: CrossSection[], axis: SplitAxis, centers: Vec3[], lapAccepted?: boolean[]): SplitJointIsland[] {
  const uvs = centers.map((c) => worldToSectionUV(axis, c));
  return islands.map((isl, i) => {
    const kind: SplitJointIsland['kind'] = uvs.some((uv) => sectionContains(isl, uv)) ? 'connector' : lapAccepted?.[i] ? 'lap' : 'glue';
    return islandInfo(isl, kind);
  });
}

/**
 * Islas de la unión con el área del CONTACTO real (no de la cara recortada lejos de los demás planos,
 * que pierde los bordes): así la suma de `areaMm2` es `contactAreaMm2`. Cada isla de contacto es
 * `connector` si tiene un centro, `lap` si la toca una isla de cara con solape aceptado, si no `glue`.
 * No libera `contact` ni `faceIslands`.
 */
export function classifyContactIslands(
  contact: CrossSection, faceIslands: CrossSection[], axis: SplitAxis, centers: Vec3[], lapAccepted?: boolean[],
): SplitJointIsland[] {
  const parts = contact.decompose();
  try {
    if (parts.length === 0) return classifyIslands(faceIslands, axis, centers, lapAccepted);
    const uvs = centers.map((c) => worldToSectionUV(axis, c));
    return parts.map((isl) => {
      let kind: SplitJointIsland['kind'] = 'glue';
      if (uvs.some((uv) => sectionContains(isl, uv))) kind = 'connector';
      else if (lapAccepted && faceIslands.some((f, i) => lapAccepted[i] && overlaps(isl, f))) kind = 'lap';
      return islandInfo(isl, kind);
    });
  } finally {
    for (const p of parts) p.delete();
  }
}

function overlaps(a: CrossSection, b: CrossSection): boolean {
  const i = a.intersect(b);
  try {
    return i.area() > 1e-6;
  } finally {
    i.delete();
  }
}

