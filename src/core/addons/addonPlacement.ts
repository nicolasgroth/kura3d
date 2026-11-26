/**
 * @file src/core/addons/addonPlacement.ts
 * @description Dónde se coloca un agregado (imán, torreta) pedido por comando, sin clic en el visor: un punto y una
 * normal de mundo en ejes del usuario (Z arriba), o una cara por nombre (`top`, `bottom`, `front`, `back`, `left`,
 * `right`) con un desplazamiento en el plano de esa cara. La cara se resuelve con un rayo desde fuera de la caja de la
 * pieza hacia adentro (primer corte con la malla de mundo, la misma de `meshRays` que mide la pared); su normal es la
 * de la superficie promediada en el radio del agregado (`surfaceNormal`; en caras planas, la del triángulo cortado). Devuelve punto y normal en ejes internos (Y arriba), como los da el visor al store.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as engine from '../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { CommandError } from '../bus/commandErrors';
import { pick, readEnum, readVec3, type RawParams } from '../bus/commandValidation';
import { fromUserVector, toUserVector } from '../scene/displayAxes';
import { rayHitsDetailed } from './meshRays';
import { averagedSurfaceNormal, SURFACE_NORMAL_DEFAULT_RADIUS_MM } from './surfaceNormal';

export const ADDON_FACES = ['top', 'bottom', 'front', 'back', 'left', 'right'] as const;
export type AddonFace = (typeof ADDON_FACES)[number];

/** Normal de cada cara (ejes del usuario) y los dos ejes del desplazamiento en su plano [u, v]. */
const FACE_FRAME: Record<AddonFace, { normal: Vec3; u: 0 | 1 | 2; v: 0 | 1 | 2 }> = {
  top: { normal: [0, 0, 1], u: 0, v: 1 },
  bottom: { normal: [0, 0, -1], u: 0, v: 1 },
  front: { normal: [0, -1, 0], u: 0, v: 2 },
  back: { normal: [0, 1, 0], u: 0, v: 2 },
  left: { normal: [-1, 0, 0], u: 1, v: 2 },
  right: { normal: [1, 0, 0], u: 1, v: 2 },
};

/** Lugar pedido: punto + normal (usuario) o cara + desplazamiento (mm sobre los ejes [u, v] de la cara). */
export type AddonPlacementInput =
  | { kind: 'point'; point: Vec3; normal: Vec3 }
  | { kind: 'face'; face: AddonFace; offsetMm: [number, number] };

/** Punto y normal de mundo en ejes internos (lo que recibe la operación). */
export interface ResolvedPlacement {
  point: Vec3;
  normal: Vec3;
}

const invalid = (param: string, expected: string) => new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });

/** Lee el lugar del agregado de los parámetros crudos del comando. */
export function parseAddonPlacement(p: RawParams): AddonPlacementInput {
  const face = readEnum(p, ADDON_FACES, 'face');
  const point = readVec3(p, 'point');
  if (face && point) throw invalid('face', 'either face or point + normal, not both');
  if (face) {
    const raw = pick(p, 'faceOffsetMm')?.[1] ?? [0, 0];
    const ok = Array.isArray(raw) && raw.length === 2 && raw.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100_000);
    if (!ok) throw invalid('faceOffsetMm', '[u, v] in mm');
    return { kind: 'face', face, offsetMm: [raw[0], raw[1]] };
  }
  if (!point) throw invalid('point', 'point + normal, or face');
  const normal = readVec3(p, 'normal');
  if (!normal || !(Math.hypot(...normal) > 1e-9)) throw invalid('normal', 'non-zero [x, y, z]');
  return { kind: 'point', point, normal };
}

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Malla de mundo de la pieza (ejes internos). */
export const worldMeshOf = (host: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>): MeshData =>
  engine.applyTransformToMesh({ positions: host.mesh.positions, indices: host.mesh.indices }, host.position, host.rotation, host.scale);

/** Caja de la malla de mundo en ejes del usuario. */
function userBox(world: MeshData): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const p = world.positions;
  for (let i = 0; i + 2 < p.length; i += 3) {
    const u = toUserVector([p[i], p[i + 1], p[i + 2]]);
    for (let k = 0; k < 3; k++) {
      if (u[k] < min[k]) min[k] = u[k];
      if (u[k] > max[k]) max[k] = u[k];
    }
  }
  return { min, max };
}

/**
 * Punto y normal internos para el lugar pedido (`radiusMm`: radio del agregado para la normal). Con una cara, el rayo parte del centro de la cara de la caja (más el
 * desplazamiento) y entra perpendicular: si no toca la pieza, `invalid-params` en `faceOffsetMm`.
 */
export function resolveAddonPlacement(
  host: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>, input: AddonPlacementInput, radiusMm = SURFACE_NORMAL_DEFAULT_RADIUS_MM,
): ResolvedPlacement {
  if (input.kind === 'point') return { point: fromUserVector(input.point), normal: unit(fromUserVector(input.normal)) };
  const world = worldMeshOf(host);
  const box = userBox(world);
  const frame = FACE_FRAME[input.face];
  const center: Vec3 = [0, 1, 2].map((k) => (box.min[k] + box.max[k]) / 2) as Vec3;
  center[frame.u] += input.offsetMm[0];
  center[frame.v] += input.offsetMm[1];
  const size = Math.max(...[0, 1, 2].map((k) => box.max[k] - box.min[k]));
  const origin = center.map((c, k) => (frame.normal[k] === 0 ? c : (frame.normal[k] > 0 ? box.max[k] : box.min[k]) + frame.normal[k] * (size + 1))) as Vec3;
  const dir = fromUserVector(frame.normal.map((n) => -n) as Vec3);
  const start = fromUserVector(origin);
  const hit = rayHitsDetailed(world, start, dir)[0];
  if (!hit) throw invalid('faceOffsetMm', `a point inside the ${input.face} face of the part`);
  const point: Vec3 = [start[0] + dir[0] * hit.dist, start[1] + dir[1] * hit.dist, start[2] + dir[2] * hit.dist];
  // Normal hacia afuera: contra el rayo que entra (una malla con caras invertidas no la da vuelta).
  const facing = hit.normal[0] * dir[0] + hit.normal[1] * dir[1] + hit.normal[2] * dir[2];
  const normal = facing > 0 ? (hit.normal.map((n) => -n) as Vec3) : hit.normal;
  const face = unit(normal);
  return { point, normal: averagedSurfaceNormal(world, point, face, radiusMm) ?? face };
}

/** Punto y normal internos de vuelta en ejes del usuario (para la respuesta). */
export const placementToUser = (r: ResolvedPlacement) => ({ point: toUserVector(r.point), normal: toUserVector(r.normal) });
