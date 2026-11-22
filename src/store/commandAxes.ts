/**
 * @file src/store/commandAxes.ts
 * @description Conversión de ejes en el borde del Command Bus. El contrato externo (bus, herramientas de
 * IA, MCP en puente) usa los ejes del usuario: X derecha, Y fondo, Z arriba (como los slicers). El núcleo
 * sigue en el sistema interno de three.js (Y arriba). Toda la conversión sale de `core/scene/displayAxes`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AlignMode, SceneObject, SurfaceProjectionAxis, Vec3 } from '../types/kura';
import {
  fromUserRotation,
  fromUserScale,
  fromUserVector,
  internalAxisOfUser,
  internalDirectionOfUser,
  toUserBox,
  toUserRotation,
  toUserScale,
  toUserSize,
  toUserVector,
  userAxisOfInternal,
  type AxisDirection,
  type AxisName,
} from '../core/scene/displayAxes';

/** Modo de alineación del usuario → modo interno (Y del usuario = fondo = −Z interno; Z = altura = Y interno). */
const ALIGN_USER_TO_INTERNAL: Partial<Record<AlignMode, AlignMode>> = {
  minY: 'maxZ',
  centerY: 'centerZ',
  maxY: 'minZ',
  minZ: 'minY',
  centerZ: 'centerY',
  maxZ: 'maxY',
};

export function alignModeFromUser(mode: AlignMode): AlignMode {
  return ALIGN_USER_TO_INTERNAL[mode] ?? mode;
}

export function alignModeToUser(mode: AlignMode): AlignMode {
  const hit = (Object.entries(ALIGN_USER_TO_INTERNAL) as [AlignMode, AlignMode][]).find(([, internal]) => internal === mode);
  return hit ? hit[0] : mode;
}

export const vecFromUser = (v: Vec3 | undefined): Vec3 | undefined => (v ? fromUserVector(v) : undefined);
export const rotationFromUser = (v: Vec3 | undefined): Vec3 | undefined => (v ? fromUserRotation(v) : undefined);
export const scaleFromUser = (v: Vec3 | undefined): Vec3 | undefined => (v ? fromUserScale(v) : undefined);

/** Eje del usuario → eje interno. */
export const axisFromUser = (axis: AxisName): AxisName => internalAxisOfUser(axis).axis;
/** Eje interno → eje del usuario. */
export const axisToUser = (axis: AxisName): AxisName => userAxisOfInternal(axis).axis;

/** Corte por plano: eje y desplazamiento del usuario → internos (el Y del usuario invierte el signo). */
export function planeFromUser(axis: AxisName, offset: number): { axis: AxisName; offset: number } {
  const { axis: internal, sign } = internalAxisOfUser(axis);
  return { axis: internal, offset: offset * sign + 0 };
}

/** Dirección de proyección del usuario (`'+z'` = arriba) → interna. */
export function projectionAxisFromUser(axis: SurfaceProjectionAxis): SurfaceProjectionAxis {
  return axis === 'cylindrical' ? axis : internalDirectionOfUser(axis as AxisDirection);
}

/** Estadísticas con dimensiones en ejes del usuario. */
export function statsToUser(stats: SceneObject['stats']): SceneObject['stats'] {
  return { ...stats, dimensionsMm: toUserSize(stats.dimensionsMm) };
}

/** Transformación de un objeto en ejes del usuario. */
export function transformToUser(o: Pick<SceneObject, 'position' | 'rotation' | 'scale'>) {
  return { position: toUserVector(o.position), rotation: toUserRotation(o.rotation), scale: toUserScale(o.scale) };
}

export { toUserVector, toUserSize };

/** Plan de división (tipos mínimos que se convierten; el resto de campos pasa igual). */
interface PlanLike {
  bounds: { min: Vec3; max: Vec3 };
  usableMm: Vec3;
  counts: { x: number; y: number; z: number };
  planes: { axis: AxisName; position: number; uniformPosition: number }[];
  pieces: { cell: [number, number, number]; bounds: { min: Vec3; max: Vec3 }; sizeMm: Vec3; printRotation: Vec3 }[];
}

/**
 * Plan de "dividir para la cama" en ejes del usuario: planos (`'z'` = horizontal), cajas, tramos y
 * medidas. `cell` de cada pieza queda en el orden del usuario [X, Y, Z]; el código de pieza no cambia
 * (letra = columna en X, número = nivel en altura Z, minúscula = fila en Y).
 */
export function splitPlanToUser<T extends PlanLike>(plan: T): T {
  return {
    ...plan,
    bounds: toUserBox(plan.bounds),
    usableMm: toUserSize(plan.usableMm),
    counts: { x: plan.counts.x, y: plan.counts.z, z: plan.counts.y },
    planes: plan.planes.map((p) => {
      const { axis, sign } = userAxisOfInternal(p.axis);
      return { ...p, axis, position: p.position * sign + 0, uniformPosition: p.uniformPosition * sign + 0 };
    }),
    pieces: plan.pieces.map((piece) => ({
      ...piece,
      cell: [piece.cell[0], piece.cell[2], piece.cell[1]] as [number, number, number],
      bounds: toUserBox(piece.bounds),
      sizeMm: toUserSize(piece.sizeMm),
      printRotation: toUserRotation(piece.printRotation),
    })),
  };
}
