/**
 * @file src/engine/cutConnectorLayout.ts
 * @description Ubicación de conectores del corte por plano sobre la sección real: la cara de corte
 * se descompone en islas (`CrossSection.decompose` de manifold-3d), cada isla se contrae por el radio
 * del alojamiento más la pared (`offset` redondo) y se intersecta con las secciones a lo largo de la
 * profundidad del conector (así un cuerpo curvo como un toro no deja salir el alojamiento). Los
 * conectores se reparten entre las islas proporcional al área (al menos uno por isla que lo admita)
 * y dentro de cada isla por muestreo del punto más alejado (polo de inaccesibilidad para uno solo,
 * muestreo de punto más lejano para varios), respetando la separación entre alojamientos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { CrossSection, Manifold } from 'manifold-3d';
import type { CutConnectorType, Vec3 } from '../types/kura';
import { EvenOddIndex, SegmentDistanceIndex, type Vec2 } from './cutConnectorPolygonIndex';

/** Radio (mm) del círculo que circunscribe la huella del conector en el plano de corte. */
export function connectorFootprintRadius(
  type: Exclude<CutConnectorType, 'none'>,
  size: number,
  expand: number
): number {
  if (type === 'dowel') return Math.max(0.4, size + expand);
  if (type === 'peg') return 0.9 * Math.SQRT2 * Math.max(0.4, size + expand);
  const headHalf = Math.max(0.55, size * 0.95) + expand;
  const halfThick = Math.max(0.4, size * 0.65 + expand);
  return Math.hypot(headHalf, halfThick);
}

/** Datos de una isla de la sección para repartir conectores. */
export interface IslandCapacity {
  area: number;
  /** Cuántos conectores caben con la separación pedida (0 si la isla no admite ninguno). */
  capacity: number;
}

/**
 * Reparte `count` conectores entre islas: si hay menos conectores que islas aptas, van a las de
 * mayor área; si no, uno por isla apta y el resto proporcional al área (mayor resto), sin pasar la
 * capacidad de cada isla. Devuelve `null` si en total no caben `count`.
 */
export function allocateConnectors(islands: IslandCapacity[], count: number): number[] | null {
  const alloc = islands.map(() => 0);
  const eligible = islands.map((_, i) => i).filter((i) => islands[i].capacity > 0);
  const total = eligible.reduce((s, i) => s + islands[i].capacity, 0);
  if (total < count) return null;
  const byArea = [...eligible].sort((a, b) => islands[b].area - islands[a].area);
  if (count <= eligible.length) {
    for (const i of byArea.slice(0, count)) alloc[i] = 1;
    return alloc;
  }
  for (const i of eligible) alloc[i] = 1;
  const eligibleArea = eligible.reduce((s, i) => s + islands[i].area, 0) || 1;
  for (let left = count - eligible.length; left > 0; left--) {
    // Mayor déficit respecto del reparto proporcional al área, entre islas con capacidad libre
    let best = -1;
    let bestDeficit = -Infinity;
    for (const i of byArea) {
      if (alloc[i] >= islands[i].capacity) continue;
      const deficit = (islands[i].area / eligibleArea) * count - alloc[i];
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        best = i;
      }
    }
    alloc[best]++;
  }
  return alloc;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const GRID_STEPS = 40;

/** Candidatos: grilla dentro de la zona segura más sus vértices. */
function sampleCandidates(safe: CrossSection): Vec2[] {
  const polys = safe.toPolygons() as Vec2[][];
  const b = safe.bounds();
  const step = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], 1e-6) / GRID_STEPS;
  const inside = new EvenOddIndex(polys);
  const out: Vec2[] = [];
  for (let u = b.min[0]; u <= b.max[0] + 1e-9; u += step) {
    for (let v = b.min[1]; v <= b.max[1] + 1e-9; v += step) {
      if (inside.contains([u, v])) out.push([u, v]);
    }
  }
  for (const poly of polys) for (const p of poly) out.push([p[0], p[1]]);
  return out;
}

/**
 * Orden de muestreo del punto más lejano: el primero es el polo (más alejado del borde de la isla);
 * para dos o más se toma el par más separado y luego el candidato más lejano de los ya elegidos.
 * `capacity` es cuántos de ese orden quedan a ≥ `separation` entre sí. La distancia al borde usa la
 * rejilla de segmentos y la distancia a los elegidos se mantiene por candidato (O(k·n)).
 */
export function farthestPointOrder(
  candidates: Vec2[],
  islandPolys: Vec2[][],
  maxCount: number,
  separation: number
): { pole: Vec2; order: Vec2[]; capacity: number } {
  const boundary = new SegmentDistanceIndex(islandPolys);
  let pole = candidates[0];
  let poleD = -Infinity;
  for (const c of candidates) {
    const d = boundary.distance(c);
    if (d > poleD) {
      poleD = d;
      pole = c;
    }
  }
  const n = candidates.length;
  const minD = new Float64Array(n);
  /** Reinicia (`reset`) o acota la distancia mínima a los elegidos con `p` y devuelve el más lejano. */
  const farthestAfter = (p: Vec2, reset: boolean) => {
    let best = candidates[0];
    let bestD = -Infinity;
    for (let k = 0; k < n; k++) {
      const d = dist(candidates[k], p);
      const m = reset ? d : Math.min(minD[k], d);
      minD[k] = m;
      if (m > bestD) {
        bestD = m;
        best = candidates[k];
      }
    }
    return { best, bestD };
  };
  const a = farthestAfter(pole, true).best;
  const p1 = farthestAfter(a, true).best;
  let last = farthestAfter(p1, true).best;
  const order: Vec2[] = [p1, last];
  let capacity = dist(p1, last) >= separation ? 2 : 1;
  while (order.length < maxCount) {
    // `minD` ya tiene la distancia a los elegidos salvo el último: basta acotar con él
    const { best, bestD } = farthestAfter(last, false);
    order.push(best);
    last = best;
    if (capacity === order.length - 1 && bestD >= separation) capacity = order.length;
  }
  return { pole, order, capacity };
}

/** Resultado de la ubicación de conectores. */
export interface ConnectorLayout {
  centers: Vec3[];
  islands: number;
  /** Islas de la sección donde no cabe ni un conector. */
  skippedIslands: number;
  /** `false` si no caben `count` conectores separados (aunque quepa alguno). */
  enoughRoom: boolean;
}

/** Parámetros geométricos de la ubicación. */
export interface ConnectorLayoutParams {
  axis: 'x' | 'y' | 'z';
  cutCoord: number;
  count: number;
  /** Radio de la huella del alojamiento más pared (distancia mínima al borde). */
  margin: number;
  /** Separación mínima entre centros. */
  separation: number;
  /** Profundidad (desde el plano, hacia +normal) en la que el alojamiento debe seguir dentro. */
  depth: number;
}

/**
 * Ubica `count` conectores en la sección de `manifold` por el plano del eje `axis` en `cutCoord`.
 * Devuelve los centros en mundo y el conteo de islas (las sin espacio quedan sin conector).
 */
export function layoutConnectorsOnSection(manifold: Manifold, p: ConnectorLayoutParams): ConnectorLayout {
  const handles: Array<{ delete: () => void }> = [];
  const own = <T extends { delete: () => void }>(h: T): T => {
    handles.push(h);
    return h;
  };
  try {
    // Orienta el plano de corte a z' = cutCoord (ver conversión inversa al final)
    const oriented =
      p.axis === 'z' ? manifold : own(p.axis === 'y' ? manifold.rotate([90, 0, 0]) : manifold.rotate([0, -90, 0]));
    const section = own(oriented.slice(p.cutCoord));
    const islandSections = section.decompose();
    handles.push(...islandSections);
    // Secciones a lo largo de la profundidad: el alojamiento debe caber en todas
    const SLICES = 3;
    const deep: CrossSection[] = [];
    for (let k = 1; k <= SLICES; k++) {
      const slice = own(oriented.slice(p.cutCoord + (p.depth * k) / SLICES - 1e-3));
      deep.push(own(slice.offset(-p.margin, 'Round')));
    }
    const islands: Array<IslandCapacity & { order: Vec2[]; pole: Vec2 }> = [];
    for (const island of islandSections) {
      let safe = own(island.offset(-p.margin, 'Round'));
      for (const d of deep) safe = own(safe.intersect(d));
      if (safe.isEmpty()) {
        islands.push({ area: island.area(), capacity: 0, order: [], pole: [0, 0] });
        continue;
      }
      const candidates = sampleCandidates(safe);
      if (candidates.length === 0) {
        islands.push({ area: island.area(), capacity: 0, order: [], pole: [0, 0] });
        continue;
      }
      const fp = farthestPointOrder(candidates, island.toPolygons() as Vec2[][], Math.max(2, p.count), p.separation);
      islands.push({ area: island.area(), ...fp });
    }
    const skippedIslands = islands.filter((i) => i.capacity === 0).length;
    const alloc = allocateConnectors(islands, p.count);
    const uv: Vec2[] = [];
    if (alloc) {
      islands.forEach((island, i) => {
        if (alloc[i] === 1) uv.push(island.pole);
        else uv.push(...island.order.slice(0, alloc[i]));
      });
    }
    const centers = uv.map(([u, v]): Vec3 =>
      p.axis === 'z' ? [u, v, p.cutCoord] : p.axis === 'y' ? [u, p.cutCoord, -v] : [p.cutCoord, v, -u]
    );
    return { centers, islands: islands.length, skippedIslands, enoughRoom: alloc !== null };
  } finally {
    for (const h of handles) h.delete();
  }
}

/** Medidas del conector con las que el corte y su vista previa calculan la ubicación. */
export interface CutConnectorLayoutInput {
  type: Exclude<CutConnectorType, 'none'>;
  size: number;
  depth: number;
  tolerance: number;
  count: number;
}

/** Espesor mínimo de pared que el corte deja alrededor del alojamiento (mm). */
const LAYOUT_MIN_WALL_MM = 0.8;

/**
 * Ubicación exacta que usa el corte por plano: única fuente de márgenes, separación y profundidad,
 * llamada por `planeCutWithConnectors`, por la comprobación de cabida y por la vista previa del visor.
 * `minWallMm` es `CONNECTOR_MIN_WALL_MM` de `cutConnectorChecks.ts`.
 */
export function layoutForCut(
  manifold: Manifold,
  axis: 'x' | 'y' | 'z',
  cutCoord: number,
  c: CutConnectorLayoutInput,
  minWallMm: number = LAYOUT_MIN_WALL_MM
): ConnectorLayout {
  // Margen al borde: huella del alojamiento con pared (+0.02 mm por el facetado del offset);
  // separación: dos huellas con media pared cada una.
  return layoutConnectorsOnSection(manifold, {
    axis,
    cutCoord,
    count: c.count,
    margin: connectorFootprintRadius(c.type, c.size, c.tolerance + minWallMm) + 0.02,
    separation: 2 * connectorFootprintRadius(c.type, c.size, c.tolerance + minWallMm * 0.5),
    depth: Math.max(0.8, c.depth + c.tolerance) + minWallMm,
  });
}
