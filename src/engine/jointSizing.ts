/**
 * @file src/engine/jointSizing.ts
 * @description Plan de "uniones firmes" para un corte por plano de eje: mide la sección real
 * (`jointSection.ts`), dimensiona el conector por la distancia al borde de cada isla con la pared
 * mínima (`jointRules.ts`), cubre cada isla que lo admite (al menos un conector por isla), ubica con
 * la misma rutina que el corte (`layoutForCut`), limita la profundidad con rayos a lo largo del eje en
 * ambas mitades (`jointRays.ts`) y devuelve un informe con claves y parámetros: conectores colocados
 * con su tamaño final, cuáles se achicaron y por qué, islas o centros descartados y el nivel.
 * `applyJointPlan` arma las dos mitades (machos en la baja, hembras con holgura en la alta).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../types/kura';
import { EvenOddIndex, type Vec2 } from './cutConnectorPolygonIndex';
import { connectorFootprintRadius, layoutForCut } from './cutConnectorLayout';
import { buildConnectorSolid } from './cutConnectorSolid';
import { AxisRayMesh, materialAlongAxis } from './jointRays';
import { connectorArea, floorStep, JOINT_RULES, jointLevel, maxConnectorSize, type JointConnectorType, type JointLevel, type JointLevelReason } from './jointRules';
import { measureCrossSection, type SectionMeasure } from './jointSection';

type Axis = 'x' | 'y' | 'z';
const AXIS: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export interface JointRequest {
  type: JointConnectorType;
  /** Tamaño pedido (radio, como `buildConnectorSolid`). */
  size: number;
  depth: number;
  tolerance: number;
  count: number;
  /** Pared mínima (por defecto `JOINT_RULES.minWallMm`). */
  wallMm?: number;
}

/** Por qué se achicó un conector. */
export interface JointShrink {
  reason: 'section-width' | 'depth' | 'room';
  fromMm: number;
  toMm: number;
}

/** Por qué una isla o un centro quedó sin conector. */
export interface JointDiscard {
  island: number;
  reason: 'section-narrow' | 'depth' | 'low-depth' | 'room';
  /** Medida que decidió (ancho local o material disponible, mm) y lo necesario. */
  measuredMm: number;
  requiredMm: number;
}

export interface JointPlacedConnector {
  center: Vec3;
  island: number;
  sizeMm: number;
  shrunk: JointShrink[];
  /** Material a lo largo del eje en la mitad alta (alojamiento) y en la baja (base del macho). */
  highDepthAvailableMm: number;
  lowDepthAvailableMm: number;
}

/** Aviso de la unión: clave estable + parámetros (el texto lo arma la interfaz). */
export interface JointWarning {
  code: 'JOINT_GLUE_ONLY' | 'JOINT_WEAK' | 'JOINT_CONNECTOR_REDUCED' | 'JOINT_DEPTH_REDUCED';
  params: Record<string, number | string>;
}

export interface JointPlan {
  axis: Axis;
  coord: number;
  type: JointConnectorType;
  /** Profundidad final común a todos los conectores. */
  depthMm: number;
  connectors: JointPlacedConnector[];
  discarded: JointDiscard[];
  section: { areaMm2: number; islands: Array<{ areaMm2: number; inscribedRadiusMm: number; holes: number; maxSizeMm: number }> };
  islandsCovered: number;
  /** Área de machos / área de la sección. */
  areaRatio: number;
  level: JointLevel;
  levelReasons: JointLevelReason[];
  warnings: JointWarning[];
}

/** Sección orientada (plano en z' = coord) del sólido; misma convención que `cutConnectorLayout.ts`. */
function sectionOf(m: Manifold, axis: Axis, coord: number): SectionMeasure {
  const oriented = axis === 'z' ? m : axis === 'y' ? m.rotate([90, 0, 0]) : m.rotate([0, -90, 0]);
  const cs = oriented.slice(coord + 0.01);
  try {
    return measureCrossSection(cs);
  } finally {
    cs.delete();
    if (oriented !== m) oriented.delete();
  }
}

const toUV = (axis: Axis, p: Vec3): Vec2 => (axis === 'z' ? [p[0], p[1]] : axis === 'y' ? [p[0], -p[2]] : [-p[2], p[1]]);

/** Profundidad de alojamiento (con holgura) que deja `wall` con `available` de material; 0 si no llega. */
const depthFor = (available: number, tol: number, wall: number) => floorStep(available - wall - tol);

/**
 * Planifica los conectores de la unión de `m` por el plano `axis = coord` (la mitad alta, +eje, lleva
 * los alojamientos). Sin efectos: no modifica ni libera `m`.
 */
export function planJointConnectors(m: Manifold, axis: Axis, coord: number, req: JointRequest): JointPlan {
  const wall = req.wallMm ?? JOINT_RULES.minWallMm;
  const tol = req.tolerance;
  const a = AXIS[axis];
  const section = sectionOf(m, axis, coord);
  const islandMax = section.islands.map((isl) => maxConnectorSize(req.type, isl.inscribedRadiusMm, tol, wall));
  // Bajo el mínimo útil no hay conector (salvo que el usuario pida uno aún más chico)
  const threshold = Math.min(JOINT_RULES.minUsefulRadiusMm, req.size);
  const discarded: JointDiscard[] = [];
  const covered: number[] = [];
  islandMax.forEach((max, i) => {
    if (max + 1e-9 >= threshold) covered.push(i);
    else discarded.push({ island: i, reason: 'section-narrow', measuredMm: 2 * section.islands[i].inscribedRadiusMm, requiredMm: 2 * (connectorFootprintRadius(req.type, threshold, tol + wall) + JOINT_RULES.facetMarginMm) });
  });
  const base = {
    axis, coord, type: req.type,
    section: { areaMm2: section.areaMm2, islands: section.islands.map((s, i) => ({ areaMm2: s.areaMm2, inscribedRadiusMm: s.inscribedRadiusMm, holes: s.holes, maxSizeMm: islandMax[i] })) },
  };
  const glue = (): JointPlan => ({
    ...base, depthMm: 0, connectors: [], discarded, islandsCovered: 0, areaRatio: 0, level: 'glue', levelReasons: ['no-connector'],
    warnings: [{ code: 'JOINT_GLUE_ONLY', params: { widthMm: round2(2 * Math.max(0, ...section.islands.map((s) => s.inscribedRadiusMm))), minWidthMm: round2(discarded[0]?.requiredMm ?? 0) } }],
  });
  if (covered.length === 0) return glue();

  const shrinks: JointShrink[] = [];
  let size = Math.min(req.size, ...covered.map((i) => islandMax[i]));
  if (size < req.size - 1e-9) shrinks.push({ reason: 'section-width', fromMm: req.size, toMm: size });
  const count = Math.min(JOINT_RULES.maxCount, Math.max(req.count, covered.length));

  const high = m.trimByPlane([a === 0 ? 1 : 0, a === 1 ? 1 : 0, a === 2 ? 1 : 0], coord);
  const low = m.trimByPlane([a === 0 ? -1 : 0, a === 1 ? -1 : 0, a === 2 ? -1 : 0], -coord);
  const highRays = new AxisRayMesh(high);
  const lowRays = new AxisRayMesh(low);
  high.delete();
  low.delete();
  // Primera pasada con encastre mínimo (solo para tener centros); luego la profundidad la dan los rayos
  // a lo largo del eje y se vuelve a ubicar con ella hasta que los rayos la confirman (≤ 4 pasadas).
  let depth: number = JOINT_RULES.minDepthMm;
  let target = req.depth;
  let centers: Vec3[] = [];
  let n = count;
  for (let pass = 0; pass < 4; pass++) {
    const placed = placeWithFallback(m, axis, coord, req.type, size, Math.min(depth, target), tol, wall, n, covered.length, threshold);
    if (!placed) return glue();
    if (placed.size < size - 1e-9) shrinks.push({ reason: 'room', fromMm: size, toMm: placed.size });
    ({ size, centers, count: n } = placed);
    const ring = connectorFootprintRadius(req.type, size, tol + wall);
    const minHigh = Math.min(...centers.map((c) => materialAlongAxis(highRays, c, a, 1, ring)));
    const reachable = Math.min(req.depth, depthFor(minHigh, tol, wall));
    if (reachable < JOINT_RULES.minDepthMm) {
      for (const c of centers) discarded.push({ island: islandOf(section, axis, c), reason: 'depth', measuredMm: round2(minHigh), requiredMm: round2(JOINT_RULES.minDepthMm + tol + wall) });
      return { ...glue(), discarded };
    }
    const used = Math.min(depth, target);
    if (pass > 0 && reachable >= used - 1e-9) {
      depth = used;
      break;
    }
    depth = target = reachable;
  }
  if (depth < req.depth - 1e-9) shrinks.push({ reason: 'depth', fromMm: req.depth, toMm: depth });
  const ring = connectorFootprintRadius(req.type, size, tol + wall);
  const connectors: JointPlacedConnector[] = [];
  for (const c of centers) {
    const highAvail = materialAlongAxis(highRays, c, a, 1, ring);
    const lowAvail = materialAlongAxis(lowRays, c, a, -1, ring);
    const island = islandOf(section, axis, c);
    if (lowAvail < wall) {
      discarded.push({ island, reason: 'low-depth', measuredMm: round2(lowAvail), requiredMm: wall });
      continue;
    }
    connectors.push({ center: c, island, sizeMm: size, shrunk: [...shrinks], highDepthAvailableMm: highAvail, lowDepthAvailableMm: lowAvail });
  }
  if (connectors.length === 0) return { ...glue(), discarded };
  const islandsCovered = new Set(connectors.map((c) => c.island)).size;
  const areaRatio = (connectors.length * connectorArea(req.type, size)) / Math.max(1e-9, section.areaMm2);
  const { level, reasons } = jointLevel({
    count: connectors.length, areaRatio, islands: section.islands.length, islandsCovered, depthMm: depth, belowUseful: size < JOINT_RULES.minUsefulRadiusMm - 1e-9,
  });
  const warnings: JointWarning[] = [];
  if (size < req.size - 1e-9) warnings.push({ code: 'JOINT_CONNECTOR_REDUCED', params: { size, requested: req.size, count: connectors.length } });
  if (depth < req.depth - 1e-9) warnings.push({ code: 'JOINT_DEPTH_REDUCED', params: { depth, requested: req.depth } });
  if (level === 'weak') warnings.push({ code: 'JOINT_WEAK', params: { count: connectors.length, areaPct: round2(100 * areaRatio), reason: reasons[0] } });
  return { ...base, depthMm: depth, connectors, discarded, islandsCovered, areaRatio, level, levelReasons: reasons, warnings };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Isla de la sección que contiene el centro (−1 si ninguna). */
function islandOf(section: SectionMeasure, axis: Axis, c: Vec3): number {
  const uv = toUV(axis, c);
  return section.islands.findIndex((isl) => new EvenOddIndex(isl.polys).contains(uv));
}

/**
 * Ubica `count` conectores; si no caben, baja la cantidad hasta una por isla cubierta y luego achica el
 * tamaño (×0,9) sin bajar de `minSize`. `null` si no cabe ni uno del mínimo.
 */
function placeWithFallback(
  m: Manifold, axis: Axis, coord: number, type: JointConnectorType, size: number, depth: number, tol: number, wall: number,
  count: number, islands: number, minSize: number,
): { centers: Vec3[]; size: number; count: number } | null {
  for (let s = size; s >= minSize - 1e-9; s = s * 0.9 < minSize && s > minSize + 1e-9 ? minSize : floorStep(s * 0.9)) {
    for (let n = count; n >= Math.min(count, Math.max(1, islands)); n--) {
      // La sección se toma 0,01 mm dentro de la mitad alta; se descuenta de la profundidad para que la
      // última sección de `layoutForCut` (a `depth + holgura + pared`) quede dentro del material medido.
      const layout = layoutForCut(m, axis, coord + 0.01, { type, size: s, depth: depth - 0.01, tolerance: tol, count: n }, wall);
      if (layout.enoughRoom && layout.centers.length > 0) {
        const a = AXIS[axis];
        const centers = layout.centers.map((p) => {
          const q = [...p] as Vec3;
          q[a] = coord;
          return q;
        });
        return { centers, size: s, count: n };
      }
    }
    if (s <= minSize + 1e-9) break;
  }
  return null;
}

/** Arma las dos mitades del plan: baja con machos, alta con hembras (holgura del pedido). El llamador libera. */
export function applyJointPlan(wasm: ManifoldToplevel, m: Manifold, plan: JointPlan, tolerance = 0.25): { low: Manifold; high: Manifold } {
  const a = AXIS[plan.axis];
  const n: Vec3 = [a === 0 ? 1 : 0, a === 1 ? 1 : 0, a === 2 ? 1 : 0];
  let high = m.trimByPlane(n, plan.coord);
  let low = m.trimByPlane([-n[0], -n[1], -n[2]], -plan.coord);
  for (const c of plan.connectors) {
    const male = buildConnectorSolid(wasm, plan.type, plan.axis, c.center, c.sizeMm, plan.depthMm, 0);
    const female = buildConnectorSolid(wasm, plan.type, plan.axis, c.center, c.sizeMm, plan.depthMm, tolerance);
    const nl = low.add(male);
    const nh = high.subtract(female);
    [low, high, male, female].forEach((x) => x.delete());
    low = nl;
    high = nh;
  }
  return { low, high };
}
