/**
 * @file src/core/scene/patternPlan.ts
 * @description Plan de un patrón sobre piezas concretas (funciones puras): pasos, poses de todas las copias, límites,
 * aviso de solape, centro de giro y radio. Lo calculan igual la vista previa del panel, el Command Bus y el MCP sin
 * interfaz; aplicarlo (copias, grupo, historial) es del store. Una pieza por celda y paso: `poses[celda][pieza]`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject, Vec3 } from '../../types/kura';
import { fromUserVector } from './displayAxes';
import {
  checkPatternLimits, circularSteps, groupCenterOf, linearSteps, overlappingCells, patternPoses,
  type CircularSpec, type LinearSpec, type PatternCenterMode, type PatternLimit, type PatternPose, type PatternStep,
} from './patterns';

export interface CircularCenter {
  mode: PatternCenterMode;
  /** Punto (del usuario, mm) cuando `mode` es `point`. */
  pointMm?: Vec3;
}

export interface PatternPlan {
  steps: PatternStep[];
  /** Poses de cada celda y pieza; la celda 0 son las originales. */
  poses: PatternPose[][];
  /** Celdas (originales incluidas). */
  cells: number;
  limit: PatternLimit;
  /** Celdas cuyas cajas se cruzan con otra (0 = ninguna). Solo se calcula si el límite lo permite. */
  overlapCells: number;
  /** Solo circular: distancia de la pieza (o el conjunto) al eje de giro; ~0 con copias sin giro = copias idénticas. */
  radiusMm?: number;
}

type Source = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale' | 'stats'>;

function finish(sources: readonly Source[], steps: PatternStep[], radiusMm?: number): PatternPlan {
  const limit = checkPatternLimits(sources, steps.length);
  const poses = limit.ok ? patternPoses(sources, steps) : [];
  return {
    steps, poses, cells: steps.length, limit,
    overlapCells: limit.ok && steps.length > 1 ? overlappingCells(sources, poses) : 0,
    ...(radiusMm !== undefined ? { radiusMm } : {}),
  };
}

/** Plan de una fila o rejilla lineal. */
export function planLinear(sources: readonly Source[], spec: LinearSpec): PatternPlan {
  return finish(sources, linearSteps(spec));
}

/** Pivote del giro (mundo interno): el centro de la placa, el de las piezas o un punto del usuario. */
export function circularPivot(sources: readonly Source[], center: CircularCenter, bedOrigin: readonly [number, number]): Vec3 {
  if (center.mode === 'bed') return [bedOrigin[0], 0, bedOrigin[1]];
  if (center.mode === 'point') return fromUserVector(center.pointMm ?? [0, 0, 0]);
  return groupCenterOf(sources);
}

/** Plan de un patrón circular. `bedOrigin` es el centro [X, Z] de la placa de las piezas. */
export function planCircular(sources: readonly Source[], spec: CircularSpec, center: CircularCenter, bedOrigin: readonly [number, number]): PatternPlan {
  const pivot = circularPivot(sources, center, bedOrigin);
  const groupCenter = groupCenterOf(sources);
  const axis = fromUserVector(spec.axis === 'x' ? [1, 0, 0] : spec.axis === 'y' ? [0, 1, 0] : [0, 0, 1]);
  const d: Vec3 = [groupCenter[0] - pivot[0], groupCenter[1] - pivot[1], groupCenter[2] - pivot[2]];
  const along = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
  const radius = Math.hypot(d[0] - axis[0] * along, d[1] - axis[1] * along, d[2] - axis[2] * along);
  return finish(sources, circularSteps(spec, pivot, groupCenter), radius);
}

/** true si el patrón dejaría las copias exactamente sobre la original (giro sin radio y sin girar las copias). */
export function isDegenerateCircular(plan: PatternPlan, spec: CircularSpec): boolean {
  return !spec.rotateCopies && (plan.radiusMm ?? 1) < 1e-6 && plan.cells > 1;
}
