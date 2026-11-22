/**
 * @file src/core/scene/parametric.ts
 * @description Reglas de objetos paramétricos (primitivas y roscas): qué campos edita cada tipo,
 * con sus rangos y valores por defecto del motor, y si el objeto sigue siendo paramétrico (su malla
 * calza con la huella guardada al generarla) o una operación ya la cambió.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { computeMeshFingerprint } from '../../engine/meshFingerprint';
import { OPERATION_RANGES } from '../../engine/operationLimits';
import { PRIMITIVE_LIMITS, primitiveRangeFor, type ParamRange } from '../../engine/primitiveLimits';
import type { MeshData, ParametricOrigin, PrimitiveParams, PrimitiveType, SceneObject, ThreadOptions } from '../../types/kura';

/** Campo numérico editable: clave, rango y valor por defecto que usa el motor cuando falta. */
export interface NumericParamField {
  key: string;
  kind: 'length' | 'count';
  range: ParamRange;
  defaultValue: number;
}

/** Campo de texto editable (texto 3D). */
export interface TextParamField {
  key: 'text';
  kind: 'text';
  maxLength: number;
  defaultValue: string;
}

export type ParamField = NumericParamField | TextParamField;

const len = (type: PrimitiveType, key: Parameters<typeof primitiveRangeFor>[1], defaultValue: number): NumericParamField =>
  ({ key, kind: 'length', range: primitiveRangeFor(type, key), defaultValue });
const count = (type: PrimitiveType, key: 'segments' | 'sides', defaultValue: number): NumericParamField =>
  ({ key, kind: 'count', range: primitiveRangeFor(type, key), defaultValue });

/** Campos de cada primitiva, en el orden en que se muestran (defaults de `primitiveParams.ts`). */
export function primitiveParamFields(type: PrimitiveType): ParamField[] {
  switch (type) {
    case 'box': return [len(type, 'width', 20), len(type, 'height', 20), len(type, 'depth', 20)];
    case 'cylinder': return [len(type, 'radius', 10), len(type, 'height', 20), count(type, 'segments', 32)];
    case 'cone': return [len(type, 'radius', 12), len(type, 'height', 24), count(type, 'segments', 32)];
    case 'tube': return [len(type, 'outerRadius', 12), len(type, 'innerRadius', 7), len(type, 'height', 20), count(type, 'segments', 36)];
    case 'sphere': return [len(type, 'radius', 12), count(type, 'segments', 32)];
    case 'torus': return [len(type, 'outerRadius', 14), len(type, 'tubeRadius', 4), count(type, 'segments', 32)];
    case 'prism': return [len(type, 'radius', 12), len(type, 'height', 20), count(type, 'sides', 6)];
    case 'text': return [
      { key: 'text', kind: 'text', maxLength: PRIMITIVE_LIMITS.maxTextLength, defaultValue: 'KURA' },
      len(type, 'fontSize', 16),
      len(type, 'height', 4),
    ];
  }
}

const T = OPERATION_RANGES.thread;
/** Campos editables de una rosca. */
export const THREAD_PARAM_FIELDS: NumericParamField[] = [
  { key: 'diameterMm', kind: 'length', range: T.diameterMm, defaultValue: 8 },
  { key: 'pitchMm', kind: 'length', range: T.pitchMm, defaultValue: 1.25 },
  { key: 'lengthMm', kind: 'length', range: T.lengthMm, defaultValue: 20 },
  { key: 'clearanceMm', kind: 'length', range: T.clearanceMm, defaultValue: 0.2 },
];

/** Estado paramétrico de un objeto. */
export type ParametricState =
  | { status: 'primitive'; type: PrimitiveType; params: PrimitiveParams }
  | { status: 'thread'; options: ThreadOptions }
  /** Nació paramétrico, pero una operación cambió su malla. */
  | { status: 'modified' }
  | { status: 'none' };

/** Huella que se guarda al generar una malla paramétrica. */
export function parametricOrigin(kind: ParametricOrigin['kind'], mesh: MeshData, thread?: ThreadOptions): ParametricOrigin {
  return { kind, meshFingerprint: computeMeshFingerprint(mesh), ...(thread ? { thread: { ...thread } } : {}) };
}

/** Decide si el objeto sigue siendo editable por parámetros. */
export function parametricStateOf(obj: Pick<SceneObject, 'mesh' | 'parametric' | 'primitiveType' | 'primitiveParams'>): ParametricState {
  const origin = obj.parametric;
  if (!origin) return { status: 'none' };
  if (computeMeshFingerprint(obj.mesh) !== origin.meshFingerprint) return { status: 'modified' };
  if (origin.kind === 'thread' && origin.thread) return { status: 'thread', options: { ...origin.thread } };
  if (origin.kind === 'primitive' && obj.primitiveType) {
    return { status: 'primitive', type: obj.primitiveType, params: { ...(obj.primitiveParams ?? {}) } };
  }
  return { status: 'none' };
}

/** true si la malla tiene caras pintadas (se pierden al regenerar). */
export function hasPaintedFaces(mesh: MeshData): boolean {
  return Boolean(mesh.faceColors?.some((c) => c !== undefined));
}
