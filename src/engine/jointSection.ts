/**
 * @file src/engine/jointSection.ts
 * @description Medida de la sección 2D de un corte (`CrossSection` de manifold-3d) para dimensionar
 * uniones: área total y, por isla (región separada, `decompose`), área, perímetro, agujeros, ancho
 * típico (2·área/perímetro) y el mayor círculo inscrito (polo de inaccesibilidad: punto más alejado
 * del borde). El polo se busca en una rejilla de 40 × 40 dentro de la isla con la distancia exacta a
 * los segmentos (`SegmentDistanceIndex`) y se refina con búsqueda por patrón; el radio nunca supera
 * el real (es una distancia medida a un punto interior).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection } from 'manifold-3d';
import { EvenOddIndex, SegmentDistanceIndex, type Vec2 } from './cutConnectorPolygonIndex';

export interface SectionIslandMeasure {
  areaMm2: number;
  perimeterMm: number;
  /** Agujeros de la isla (un tubo cortado de través tiene 1). */
  holes: number;
  /** Ancho típico 2·área/perímetro (exacto en tiras y anillos). */
  typicalWidthMm: number;
  /** Radio del mayor círculo inscrito: la mitad del ancho local máximo. */
  inscribedRadiusMm: number;
  /** Centro de ese círculo (coordenadas de la sección). */
  pole: Vec2;
  /** Contornos de la isla (exterior y agujeros). */
  polys: Vec2[][];
}

export interface SectionMeasure {
  areaMm2: number;
  islands: SectionIslandMeasure[];
}

const GRID = 40;
const REFINE_STEPS = 30;

function perimeter(polys: Vec2[][]): number {
  let per = 0;
  for (const p of polys) for (let i = 0, j = p.length - 1; i < p.length; j = i++) per += Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]);
  return per;
}

/** Polo de inaccesibilidad de los polígonos (con agujeros) y su distancia al borde. */
export function inscribedCircle(polys: Vec2[][]): { pole: Vec2; radius: number } {
  const inside = new EvenOddIndex(polys);
  const boundary = new SegmentDistanceIndex(polys);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (!Number.isFinite(x0)) return { pole: [0, 0], radius: 0 };
  const sx = (x1 - x0) / GRID, sy = (y1 - y0) / GRID;
  let pole: Vec2 = [(x0 + x1) / 2, (y0 + y1) / 2];
  let best = inside.contains(pole) ? boundary.distance(pole) : -Infinity;
  for (let i = 0; i <= GRID; i++) {
    for (let k = 0; k <= GRID; k++) {
      const p: Vec2 = [x0 + i * sx, y0 + k * sy];
      if (!inside.contains(p)) continue;
      const d = boundary.distance(p);
      if (d > best) {
        best = d;
        pole = p;
      }
    }
  }
  if (!Number.isFinite(best)) return { pole, radius: 0 };
  // Búsqueda por patrón: 8 vecinos al paso actual; si ninguno mejora, se divide el paso
  let step = Math.max(sx, sy);
  for (let it = 0; it < REFINE_STEPS && step > 1e-5; it++) {
    let moved = false;
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p: Vec2 = [pole[0] + du * step, pole[1] + dv * step];
      if (!inside.contains(p)) continue;
      const d = boundary.distance(p);
      if (d > best + 1e-12) {
        best = d;
        pole = p;
        moved = true;
      }
    }
    if (!moved) step /= 2;
  }
  return { pole, radius: best };
}

/** Distancia de `p` al borde de los polígonos (0 o más; no distingue dentro/fuera). */
export function distanceToBoundary(polys: Vec2[][], p: Vec2): number {
  return new SegmentDistanceIndex(polys).distance(p);
}

/** Mide la sección (no la libera). */
export function measureCrossSection(cs: CrossSection): SectionMeasure {
  const parts = cs.decompose();
  try {
    const islands = parts.map((isl): SectionIslandMeasure => {
      const polys = isl.toPolygons() as Vec2[][];
      const areaMm2 = isl.area();
      const perimeterMm = perimeter(polys);
      const { pole, radius } = inscribedCircle(polys);
      return {
        areaMm2,
        perimeterMm,
        holes: Math.max(0, polys.length - 1),
        typicalWidthMm: perimeterMm > 0 ? (2 * areaMm2) / perimeterMm : 0,
        inscribedRadiusMm: radius,
        pole,
        polys,
      };
    });
    return { areaMm2: cs.area(), islands };
  } finally {
    for (const p of parts) p.delete();
  }
}
