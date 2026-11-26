/**
 * @file src/core/scene/patterns.ts
 * @description Matemática pura de los patrones de repetición («Patrón»): fila y rejilla lineales, circular alrededor de
 * un eje y plano del espejo con copia. Todo en ejes del USUARIO en la frontera (X derecha, Y fondo, Z arriba) y en mm; por
 * dentro convierte al sistema interno (Y arriba). Un patrón es una lista de «pasos» (movimientos rígidos aplicados a la
 * pose de cada pieza original); el paso 0 es siempre la identidad (la original). También los límites (copias y
 * triángulos), la caja de cada copia y el aviso de solape. Sin estado ni interfaz: lo usan el store, el bus y el MCP sin
 * interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { fromUserVector, internalAxisOfUser, internalIndexOfUser, type AxisName } from './displayAxes';

/** Tope de piezas nuevas por patrón (copias × piezas de origen). */
export const MAX_PATTERN_COPIES = 500;
/** Tope de triángulos nuevos por patrón (suma de todas las copias). */
export const MAX_PATTERN_TRIANGLES = 2_000_000;
/** Tope de piezas (originales + copias) para «unir en una sola pieza»: la unión se hace en el Worker y copia las mallas. */
export const MAX_PATTERN_UNION_PIECES = 100;
/** Por encima de estos triángulos totales no se dibuja el fantasma de las copias (se avisa). */
export const MAX_GHOST_TRIANGLES = 600_000;

/** Rangos de los parámetros (una sola fuente para el formulario, el bus y el MCP). */
export const PATTERN_RANGES = {
  count: { min: 1, max: MAX_PATTERN_COPIES, integer: true, default: 3 },
  distanceMm: { min: -10_000, max: 10_000, default: 20 },
  angleDeg: { min: -360, max: 360, default: 360 },
  offsetMm: { min: -10_000, max: 10_000, default: 0 },
  coordinateMm: { min: -100_000, max: 100_000, default: 0 },
} as const;

export const PATTERN_AXES: readonly AxisName[] = ['x', 'y', 'z'];
/** Cómo se interpreta la distancia: entre copias, o total de la primera a la última. */
export const PATTERN_DISTANCE_MODES = ['step', 'total'] as const;
export type PatternDistanceMode = (typeof PATTERN_DISTANCE_MODES)[number];
export const PATTERN_CENTERS = ['bed', 'selection', 'point'] as const;
export type PatternCenterMode = (typeof PATTERN_CENTERS)[number];
export const MIRROR_BASES = ['object', 'bed'] as const;
export type MirrorBase = (typeof MIRROR_BASES)[number];

/** Pose de una pieza (posición y rotación Euler XYZ internas). */
export interface PatternPose {
  position: Vec3;
  rotation: Vec3;
}

/** Movimiento rígido de una copia respecto de su original (sistema interno). */
export type PatternStep =
  | { kind: 'translate'; offset: Vec3 }
  | { kind: 'rotate'; axis: Vec3; angle: number; pivot: Vec3; spin: boolean; groupCenter: Vec3 };

export interface LinearSpec {
  /** Piezas a lo largo de la dirección principal, contando la original (≥ 1). */
  count: number;
  /** Eje (del usuario) de la dirección principal; `direction` (vector del usuario, no nulo) lo reemplaza. */
  axis: AxisName;
  direction?: Vec3;
  mode: PatternDistanceMode;
  /** Paso entre copias (modo `step`) o distancia total (modo `total`); con signo. */
  distanceMm: number;
  /** Segunda dirección (rejilla): piezas, eje y distancia (mismo modo que la principal). Sin ella, una sola fila. */
  rows?: number;
  rowAxis?: AxisName;
  rowDistanceMm?: number;
}

export interface CircularSpec {
  /** Piezas alrededor del eje, contando la original (≥ 1). */
  count: number;
  /** Eje (del usuario) alrededor del cual se repite. */
  axis: AxisName;
  /** Ángulo total en grados (360 = vuelta completa; con signo: sentido). */
  totalAngleDeg: number;
  /** Las copias giran con el patrón (true) o conservan su orientación (false). */
  rotateCopies: boolean;
}

export interface MirrorSpec {
  /** Eje (del usuario) perpendicular al plano: YZ → x, XZ → y, XY → z. */
  axis: AxisName;
  /** El plano pasa por el centro de la(s) pieza(s) o por el centro de la cama. */
  base: MirrorBase;
  /** Desplazamiento del plano a lo largo del eje, desde la base, en mm del usuario. */
  offsetMm: number;
  /** true: la pieza y su reflejo; false: la pieza se reemplaza por el reflejo. */
  keepOriginal: boolean;
}

const IDENTITY: PatternStep = { kind: 'translate', offset: [0, 0, 0] };

const userUnit = (axis: AxisName): Vec3 => fromUserVector(axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]);

/** Dirección interna unitaria de una dirección del usuario (null si es nula o no finita). */
export function internalDirection(userDir: Vec3): Vec3 | null {
  const v = fromUserVector(userDir);
  const len = Math.hypot(v[0], v[1], v[2]);
  if (!Number.isFinite(len) || len < 1e-9) return null;
  return [v[0] / len, v[1] / len, v[2] / len];
}

const spacingOf = (mode: PatternDistanceMode, count: number, distance: number): number =>
  mode === 'total' ? (count > 1 ? distance / (count - 1) : 0) : distance;

/** Pasos de un patrón lineal (fila o rejilla): índice 0 = la original; orden: fila a fila (la secundaria es la externa). */
export function linearSteps(spec: LinearSpec): PatternStep[] {
  const count = Math.max(1, Math.floor(spec.count));
  const rows = Math.max(1, Math.floor(spec.rows ?? 1));
  const dirA = spec.direction ? internalDirection(spec.direction) ?? userUnit(spec.axis) : userUnit(spec.axis);
  const dirB = userUnit(spec.rowAxis ?? spec.axis);
  const stepA = spacingOf(spec.mode, count, spec.distanceMm);
  const stepB = spacingOf(spec.mode, rows, spec.rowDistanceMm ?? 0);
  const steps: PatternStep[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < count; i++) {
      const offset: Vec3 = [
        dirA[0] * stepA * i + dirB[0] * stepB * j + 0,
        dirA[1] * stepA * i + dirB[1] * stepB * j + 0,
        dirA[2] * stepA * i + dirB[2] * stepB * j + 0,
      ];
      steps.push(i === 0 && j === 0 ? IDENTITY : { kind: 'translate', offset });
    }
  }
  return steps;
}

/** Ángulos (rad) de un patrón circular: vuelta completa reparte en `count` partes; un arco incluye ambos extremos. */
export function circularAngles(spec: Pick<CircularSpec, 'count' | 'totalAngleDeg'>): number[] {
  const count = Math.max(1, Math.floor(spec.count));
  const total = (spec.totalAngleDeg * Math.PI) / 180;
  const full = Math.abs(spec.totalAngleDeg) >= 360 - 1e-9;
  const step = count <= 1 ? 0 : full ? total / count : total / (count - 1);
  return Array.from({ length: count }, (_, i) => step * i);
}

/** Pasos de un patrón circular. `pivot` y `groupCenter` van en mundo interno. */
export function circularSteps(spec: CircularSpec, pivot: Vec3, groupCenter: Vec3): PatternStep[] {
  const axis = userUnit(spec.axis);
  return circularAngles(spec).map((angle, i) =>
    i === 0 ? IDENTITY : { kind: 'rotate', axis, angle, pivot, spin: spec.rotateCopies, groupCenter },
  );
}

/** Pose de la copia: el paso aplicado a la pose de la original. */
export function stepPose(pose: PatternPose, step: PatternStep): PatternPose {
  if (step.kind === 'translate') {
    return {
      position: [pose.position[0] + step.offset[0], pose.position[1] + step.offset[1], pose.position[2] + step.offset[2]],
      rotation: [...pose.rotation] as Vec3,
    };
  }
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...step.axis), step.angle);
  const pivot = new THREE.Vector3(...step.pivot);
  if (!step.spin) {
    // Conserva la orientación: todo el conjunto se traslada lo que se movería su centro.
    const c = new THREE.Vector3(...step.groupCenter);
    const moved = c.clone().sub(pivot).applyQuaternion(q).add(pivot).sub(c);
    return {
      position: [pose.position[0] + moved.x, pose.position[1] + moved.y, pose.position[2] + moved.z],
      rotation: [...pose.rotation] as Vec3,
    };
  }
  const p = new THREE.Vector3(...pose.position).sub(pivot).applyQuaternion(q).add(pivot);
  const own = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ'));
  const euler = new THREE.Euler().setFromQuaternion(q.multiply(own), 'XYZ');
  return { position: [p.x, p.y, p.z], rotation: [euler.x + 0, euler.y + 0, euler.z + 0] };
}

type Boxed = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>;

const localBoxes = new WeakMap<MeshData, THREE.Box3>();
function localBox(mesh: MeshData): THREE.Box3 | null {
  if (mesh.positions.length < 3) return null;
  let box = localBoxes.get(mesh);
  if (!box) {
    box = new THREE.Box3().setFromArray(mesh.positions);
    localBoxes.set(mesh, box);
  }
  return box;
}

/** Caja en mundo de una pieza en una pose (null si la malla está vacía). */
export function poseBox(obj: Pick<SceneObject, 'mesh' | 'scale'>, pose: PatternPose): THREE.Box3 | null {
  const local = localBox(obj.mesh);
  if (!local) return null;
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...pose.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ')),
    new THREE.Vector3(...obj.scale),
  );
  return local.clone().applyMatrix4(matrix);
}

/** Caja envolvente conjunta de las piezas en mundo interno (null si no hay geometría). */
export function groupBoxOf(objs: readonly Boxed[]): { min: Vec3; max: Vec3 } | null {
  const box = new THREE.Box3();
  for (const o of objs) {
    const b = poseBox(o, o);
    if (b) box.union(b);
  }
  return box.isEmpty() ? null : { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] };
}

/** Centro de la caja envolvente conjunta de las piezas (mundo interno). */
export function groupCenterOf(objs: readonly Boxed[]): Vec3 {
  const box = groupBoxOf(objs);
  if (!box) return objs[0] ? ([...objs[0].position] as Vec3) : [0, 0, 0];
  return [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
}

/** Poses de todas las copias: `[paso][pieza]`. */
export function patternPoses(sources: readonly Pick<SceneObject, 'position' | 'rotation'>[], steps: readonly PatternStep[]): PatternPose[][] {
  return steps.map((step) => sources.map((s) => stepPose({ position: s.position, rotation: s.rotation }, step)));
}

/** Resultado de revisar los límites. */
export type PatternLimit = { ok: true; copies: number; triangles: number } | { ok: false; reason: 'copies' | 'triangles'; copies: number; triangles: number };

/** Revisa el tope de piezas nuevas y de triángulos nuevos (copias × piezas de origen). */
export function checkPatternLimits(sources: readonly Pick<SceneObject, 'stats'>[], cells: number): PatternLimit {
  const copies = Math.max(0, cells - 1) * sources.length;
  const perCell = sources.reduce((sum, s) => sum + s.stats.triangles, 0);
  const triangles = Math.max(0, cells - 1) * perCell;
  if (copies > MAX_PATTERN_COPIES) return { ok: false, reason: 'copies', copies, triangles };
  if (triangles > MAX_PATTERN_TRIANGLES) return { ok: false, reason: 'triangles', copies, triangles };
  return { ok: true, copies, triangles };
}

/**
 * Pares de copias de celdas distintas cuyas cajas envolventes se cruzan con volumen (aviso «podrían solaparse»; una
 * caja es una aproximación: en piezas giradas puede avisar de más). Devuelve la cantidad de celdas implicadas.
 */
export function overlappingCells(sources: readonly Pick<SceneObject, 'mesh' | 'scale'>[], poses: readonly PatternPose[][], eps = 1e-3): number {
  const boxes = poses.map((cell) => cell.map((pose, i) => poseBox(sources[i], pose)));
  const hit = new Set<number>();
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      if (hit.has(a) && hit.has(b)) continue;
      if (cellsCross(boxes[a], boxes[b], eps)) {
        hit.add(a);
        hit.add(b);
      }
    }
  }
  return hit.size;
}

function cellsCross(a: readonly (THREE.Box3 | null)[], b: readonly (THREE.Box3 | null)[], eps: number): boolean {
  for (const x of a) {
    if (!x) continue;
    for (const y of b) {
      if (!y) continue;
      if (x.min.x < y.max.x - eps && x.max.x > y.min.x + eps && x.min.y < y.max.y - eps && x.max.y > y.min.y + eps
        && x.min.z < y.max.z - eps && x.max.z > y.min.z + eps) return true;
    }
  }
  return false;
}

/**
 * Plano del espejo en mundo interno: índice del eje interno y su coordenada. `box` es la caja conjunta de las piezas y
 * `bedOrigin` el centro [X, Z] de la placa (la cama no tiene altura: en Z del usuario la base es el suelo, 0).
 */
export function mirrorPlane(spec: MirrorSpec, box: { min: Vec3; max: Vec3 }, bedOrigin: readonly [number, number]): { index: 0 | 1 | 2; coord: number } {
  const index = internalIndexOfUser(spec.axis);
  const { sign } = internalAxisOfUser(spec.axis);
  const base = spec.base === 'object'
    ? (box.min[index] + box.max[index]) / 2
    : index === 0 ? bedOrigin[0] : index === 2 ? bedOrigin[1] : 0;
  return { index, coord: base + sign * spec.offsetMm + 0 };
}
