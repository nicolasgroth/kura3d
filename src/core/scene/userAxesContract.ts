/**
 * @file src/core/scene/userAxesContract.ts
 * @description Conversión de ejes en el borde del contrato externo (Command Bus de la app y modo sin
 * interfaz del servidor MCP). El contrato usa los ejes del usuario: X derecha, Y fondo, Z arriba (como
 * los slicers). El núcleo sigue en el sistema interno de three.js (Y arriba). Toda la matemática sale de
 * `displayAxes`; aquí solo se aplica a las formas de entrada y salida de cada comando, para que el bus y
 * el MCP sin interfaz conviertan con las mismas funciones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AlignMode, DetectedStructureRegion, SceneObject, SurfaceProjectionAxis, Vec3 } from '../../types/kura';
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
  userDirectionOfInternal,
  type AxisDirection,
  type AxisName,
} from './displayAxes';

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

/** Mitad a conservar del usuario → interna: en el Y del usuario el lado + es el −Z interno. */
export function keepModeFromUser<K extends 'both' | 'positive' | 'negative'>(axis: AxisName, keepMode: K): K {
  if (internalAxisOfUser(axis).sign > 0 || keepMode === 'both') return keepMode;
  return (keepMode === 'positive' ? 'negative' : 'positive') as K;
}

/** Dirección de proyección del usuario (`'+z'` = arriba) → interna. */
export function projectionAxisFromUser(axis: SurfaceProjectionAxis): SurfaceProjectionAxis {
  return axis === 'cylindrical' ? axis : internalDirectionOfUser(axis as AxisDirection);
}

/** Eje de partición del molde bivalvo: el usuario elige un eje horizontal (`'x'` o `'y'`) → interno `'x'|'z'`. */
export function moldSplitAxisFromUser(axis: 'x' | 'y'): 'x' | 'z' {
  return axis === 'y' ? 'z' : 'x';
}

/** Estadísticas con dimensiones en ejes del usuario. */
export function statsToUser(stats: SceneObject['stats']): SceneObject['stats'] {
  return { ...stats, dimensionsMm: toUserSize(stats.dimensionsMm) };
}

/** Transformación de un objeto en ejes del usuario. */
export function transformToUser(o: Pick<SceneObject, 'position' | 'rotation' | 'scale'>) {
  return { position: toUserVector(o.position), rotation: toUserRotation(o.rotation), scale: toUserScale(o.scale) };
}

/** Resumen de objeto (transformación y estadísticas) en ejes del usuario; el resto de campos pasa igual. */
export function objectSummaryToUser<T extends Pick<SceneObject, 'position' | 'rotation' | 'scale' | 'stats'>>(o: T): T {
  return { ...o, ...transformToUser(o), stats: statsToUser(o.stats) };
}

/** Sub-estructura detectada con medidas y centro (locales) en ejes del usuario. */
export function structureRegionToUser<T extends Pick<DetectedStructureRegion, 'dimensionsMm' | 'centerMm'>>(r: T): T {
  return { ...r, dimensionsMm: toUserSize(r.dimensionsMm), centerMm: toUserVector(r.centerMm) };
}

export { toUserVector, toUserSize };

/** Plan de división (tipos mínimos que se convierten; el resto de campos pasa igual). */
interface PlanLike {
  bounds: { min: Vec3; max: Vec3 };
  usableMm: Vec3;
  counts: { x: number; y: number; z: number };
  planes: { axis: AxisName; position: number; uniformPosition: number }[];
  pieces: { cell: [number, number, number]; bounds: { min: Vec3; max: Vec3 }; sizeMm: Vec3; printRotation: Vec3 }[];
  /** Conteos reales del plan: celdas y medidas en ejes internos (`jointsPerPlane` sigue el orden de `planes`). */
  occupancy?: { cells: Array<[number, number, number]>; pieceSizesMm: Vec3[] };
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
    ...(plan.occupancy
      ? {
          occupancy: {
            ...plan.occupancy,
            cells: plan.occupancy.cells.map((c) => [c[0], c[2], c[1]] as [number, number, number]),
            pieceSizesMm: plan.occupancy.pieceSizesMm.map(toUserSize),
          },
        }
      : {}),
  };
}

/** Unión de la división (forma mínima del motor). */
interface JointSide {
  part: number;
  code: string;
  face?: AxisDirection;
}
interface JointLike {
  label: string;
  axis: AxisName;
  a: JointSide;
  b: JointSide;
  connectorCenters: unknown[];
  labelEngraved?: boolean;
}

const sideToUser = <S extends JointSide>(s: S): S => (s.face ? { ...s, face: userDirectionOfInternal(s.face) } : s);

/** Unión de "dividir para la cama" en la forma compacta del contrato, con el eje y las caras del usuario. */
export function splitJointToUser(j: JointLike) {
  return {
    label: j.label, axis: axisToUser(j.axis), a: sideToUser(j.a), b: sideToUser(j.b),
    connectors: j.connectorCenters.length, labelEngraved: j.labelEngraved,
  };
}

/**
 * Respuesta de `validate_assembly` en ejes del usuario: la dirección de inserción de cada paso del orden
 * de montaje (`'-z'` = la pieza baja desde arriba). El resto (códigos, volúmenes, uniones) no tiene ejes.
 */
export function assemblyResponseToUser<T extends { order: { direction: AxisDirection }[] }>(r: T): T {
  return { ...r, order: r.order.map((s) => ({ ...s, direction: userDirectionOfInternal(s.direction) })) };
}
