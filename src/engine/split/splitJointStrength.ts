/**
 * @file src/engine/split/splitJointStrength.ts
 * @description "Uniones firmes" dentro de "dividir para imprimir": cuántas islas de la cara admiten
 * conector según su círculo inscrito y la pared mínima (`jointRules.ts`), tope de profundidad medido
 * con rayos a lo largo del eje en las dos piezas (`jointRays.ts`) y el informe de firmeza de la unión
 * (nivel, motivos, qué se achicó y qué islas quedaron solo para pegar) como datos estructurados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection, Manifold } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { connectorFootprintRadius } from '../cutConnectorLayout';
import type { Vec2 } from '../cutConnectorPolygonIndex';
import { AxisRayMesh, materialAlongAxis } from '../jointRays';
import { connectorArea, floorStep, JOINT_RULES, jointLevel, maxConnectorSize } from '../jointRules';
import { inscribedCircle } from '../jointSection';
import { layoutType, looseDowelHoleDepth } from './splitLooseDowel';
import { AXIS_INDEX } from './splitSections';
import type { SplitAxis, SplitConnectorOptions, SplitJointIsland, SplitJointStrength } from './splitTypes';

/** Pared mínima con la que la división ubica conectores (3 perímetros de 0,4 mm). */
export const SPLIT_JOINT_WALL_MM = JOINT_RULES.minWallMm;

/** Islas de la cara que admiten al menos un conector del mínimo útil (o del pedido, si es menor). */
export function eligibleIslands(islands: CrossSection[], c: SplitConnectorOptions, wall = SPLIT_JOINT_WALL_MM): number {
  if (c.type === 'lap') return 0;
  const lt = layoutType(c.type);
  const threshold = Math.min(JOINT_RULES.minUsefulRadiusMm, c.size);
  let n = 0;
  for (const isl of islands) {
    const { radius } = inscribedCircle(isl.toPolygons() as Vec2[][]);
    if (maxConnectorSize(lt, radius, c.tolerance, wall) + 1e-9 >= threshold) n++;
  }
  return n;
}

/**
 * Mayor profundidad (≤ la pedida) que deja `wall` de material a lo largo del eje de cada conector en
 * las dos piezas, medida con rayos desde el centro y el anillo huella + pared. `null` si queda bajo el
 * encastre mínimo (`JOINT_RULES.minDepthMm`).
 */
export function depthByRays(
  low: Manifold, high: Manifold, axis: SplitAxis, centers: Vec3[], c: SplitConnectorOptions, wall = SPLIT_JOINT_WALL_MM,
): { depth: number | null; highMm: number; lowMm: number } {
  const a = AXIS_INDEX[axis];
  const ring = connectorFootprintRadius(layoutType(c.type), c.size, c.tolerance + wall);
  const hi = new AxisRayMesh(high);
  const lo = new AxisRayMesh(low);
  const highMm = Math.min(...centers.map((p) => materialAlongAxis(hi, p, a, 1, ring)));
  const lowMm = Math.min(...centers.map((p) => materialAlongAxis(lo, p, a, -1, ring)));
  let depth = Math.min(c.depth, floorStep(highMm - wall - c.tolerance));
  // El tarugo suelto perfora también la pieza baja; el macho fijo solo necesita su base
  if (c.type === 'loose-dowel') depth = Math.min(depth, floorStep(lowMm - wall - c.tolerance));
  else if (lowMm < wall) return { depth: null, highMm, lowMm };
  return { depth: depth >= JOINT_RULES.minDepthMm ? depth : null, highMm, lowMm };
}

/** Informe de firmeza de una unión ya resuelta. */
export function jointStrength(
  used: SplitConnectorOptions | null, requested: SplitConnectorOptions | null, centers: Vec3[], contactAreaMm2: number,
  islands: SplitJointIsland[], depthLimitedFrom: number | null,
): SplitJointStrength {
  const covered = islands.filter((i) => i.kind !== 'glue').length;
  const discarded = islands
    .map((isl, island) => ({ isl, island }))
    .filter(({ isl }) => isl.kind === 'glue')
    .map(({ isl, island }) => ({ island, reason: 'section-narrow' as const, measuredMm: isl.minWidthMm }));
  if (!used || used.type === 'lap' || centers.length === 0) {
    const level = used?.type === 'lap' ? 'fair' : 'glue';
    return { level, reasons: level === 'glue' ? ['no-connector'] : [], count: 0, sizeMm: 0, depthMm: 0, areaRatio: 0, islands: islands.length, islandsCovered: covered, shrunk: [], discarded };
  }
  const area = centers.length * connectorArea(layoutType(used.type), used.size);
  const areaRatio = contactAreaMm2 > 0 ? area / contactAreaMm2 : 0;
  const { level, reasons } = jointLevel({
    count: centers.length, areaRatio, islands: islands.length, islandsCovered: covered, depthMm: used.depth,
    belowUseful: used.size < JOINT_RULES.minUsefulRadiusMm - 1e-9,
  });
  const shrunk: SplitJointStrength['shrunk'] = [];
  if (requested && used.size < requested.size - 1e-9) shrunk.push({ reason: 'section-width', fromMm: requested.size, toMm: used.size });
  if (requested && used.count < requested.count) shrunk.push({ reason: 'count', fromMm: requested.count, toMm: used.count });
  if (depthLimitedFrom !== null) shrunk.push({ reason: 'depth', fromMm: depthLimitedFrom, toMm: used.depth });
  return { level, reasons, count: centers.length, sizeMm: used.size, depthMm: used.depth, areaRatio, islands: islands.length, islandsCovered: covered, shrunk, discarded };
}
