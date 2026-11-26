/**
 * @file src/core/operations/measureOperations.ts
 * @description Respuestas de medición en ejes del usuario (X derecha, Y fondo, Z arriba), compartidas
 * por el Command Bus de la app y el MCP sin interfaz para que ambos devuelvan exactamente lo mismo:
 * distancia entre dos puntos, área/volumen/caja de un objeto y capacidad como recipiente. Solo
 * lectura: no producen `SceneChange`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { measureDistance, measureObject, type CapacityResult } from '../../engine/measure';
import type { SceneObject, Vec3 } from '../../types/kura';
import { fromUserVector, toUserBox } from '../scene/displayAxes';

const round = (v: number, d = 3) => {
  const f = 10 ** d;
  const r = Math.round(v * f) / f;
  return r === 0 ? 0 : r;
};
const roundVec = (v: Vec3, d = 3): Vec3 => [round(v[0], d), round(v[1], d), round(v[2], d)];
/** 1 cm³ = 1 mL. */
const ml = (mm3: number) => round(mm3 / 1000, 2);

/** Límites aceptados para niveles y puntos (mm). */
export const MEASURE_LIMITS = { coordMm: 100_000 } as const;

export interface DistanceResponse {
  distanceMm: number;
  /** ΔX, ΔY, ΔZ en ejes del usuario (de A a B). */
  deltaMm: Vec3;
}

/** Distancia entre dos puntos dados en ejes del usuario. */
export function measureDistanceUser(pointA: Vec3, pointB: Vec3): DistanceResponse {
  const d = measureDistance(fromUserVector(pointA), fromUserVector(pointB));
  return { distanceMm: round(d.distanceMm), deltaMm: roundVec(d.deltaUser) };
}

export interface ObjectMeasureResponse {
  id: string;
  name: string;
  surfaceAreaMm2: number;
  volumeMm3: number;
  volumeMl: number;
  isClosed: boolean;
  /** Caja en mundo, ejes del usuario. */
  box: { min: Vec3; max: Vec3 };
  sizeMm: Vec3;
}

export function measureObjectUser(obj: SceneObject): ObjectMeasureResponse {
  const m = measureObject(obj);
  const box = toUserBox(m.box);
  return {
    id: obj.id,
    name: obj.name,
    surfaceAreaMm2: round(m.surfaceAreaMm2, 2),
    volumeMm3: round(m.volumeMm3, 2),
    volumeMl: ml(m.volumeMm3),
    isClosed: m.isClosed,
    box: { min: roundVec(box.min), max: roundVec(box.max) },
    sizeMm: roundVec([box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]]),
  };
}

export interface CapacityResponse {
  id: string;
  name: string;
  /** Cavidad medida y su capacidad máxima (hasta el rebalse). */
  cavityIndex: number;
  capacityMm3: number;
  capacityMl: number;
  /** Altura del rebalse sobre la base del objeto (Z del usuario). */
  overflowHeightMm: number;
  /** Nivel medido sobre la base y lo que cabe hasta ahí. */
  levelHeightMm: number;
  filledMm3: number;
  filledMl: number;
  cavities: Array<{ index: number; capacityMm3: number; capacityMl: number; overflowHeightMm: number }>;
  /** Cavidades cerradas por dentro: no cuentan como capacidad. */
  sealedCavitiesMm3: number[];
  /** Altura de la base del objeto en Z del usuario (mundo). */
  baseZMm: number;
  note: string;
}

export const CAPACITY_NOTE =
  'Capacity depends on the current orientation of the object: rotate it to measure another tilt. Levels are heights above the object base.';

export function capacityToUser(obj: Pick<SceneObject, 'id' | 'name'>, r: CapacityResult): CapacityResponse {
  const basin = r.basins[r.basinIndex];
  return {
    id: obj.id,
    name: obj.name,
    cavityIndex: basin ? r.basinIndex : -1,
    capacityMm3: round(basin?.maxCapacityMm3 ?? 0, 1),
    capacityMl: ml(basin?.maxCapacityMm3 ?? 0),
    overflowHeightMm: round(basin?.overflowHeightMm ?? 0, 2),
    levelHeightMm: round(r.levelHeightMm, 2),
    filledMm3: round(r.filledMm3, 1),
    filledMl: ml(r.filledMm3),
    cavities: r.basins.map((b, index) => ({
      index,
      capacityMm3: round(b.maxCapacityMm3, 1),
      capacityMl: ml(b.maxCapacityMm3),
      overflowHeightMm: round(b.overflowHeightMm, 2),
    })),
    sealedCavitiesMm3: r.sealedCavitiesMm3.map((v) => round(v, 1)),
    baseZMm: round(r.baseY, 3),
    note: CAPACITY_NOTE,
  };
}
