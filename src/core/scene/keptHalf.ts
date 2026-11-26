/**
 * @file src/core/scene/keptHalf.ts
 * @description Dónde queda la mitad que se conserva en un corte por plano cuando se descarta la otra:
 * dejarla donde está (puede quedar flotando), apoyarla en la cama en el mismo lugar o apoyarla en un
 * hueco libre de la cama. Función única que comparten la app, el bus de comandos y el MCP sin interfaz,
 * más la estimación previa (sin cortar) que usa el diálogo para saber si la mitad quedaría apoyada y si
 * al apoyarla se superpondría con otro objeto. Trabaja en ejes internos (Y = altura).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { PlaneCutOptions, SceneObject, Vec3 } from '../../types/kura';
import { footprintOf, placeInFreeSpot, type BedSize, type FootprintXZ } from './freeSpot';
import { computeBedPositionY } from './sceneObjects';
import { occupiesBed } from './objectRole';

/** Dónde queda la mitad conservada: donde está, apoyada en la cama o en un hueco libre. */
export type KeptHalfPlacement = 'inPlace' | 'dropToBed' | 'freeSpot';

export const KEPT_HALF_PLACEMENTS: readonly KeptHalfPlacement[] = ['inPlace', 'dropToBed', 'freeSpot'];

/** Por defecto el contrato anterior: la mitad conservada queda donde estaba. */
export const DEFAULT_KEPT_HALF_PLACEMENT: KeptHalfPlacement = 'inPlace';

/** Tolerancia (mm) para decir que una base toca la cama. */
export const BED_TOUCH_EPS_MM = 0.01;

type Placeable = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>;

const overlapsXZ = (a: FootprintXZ, b: FootprintXZ) =>
  a.minX < b.maxX - 1e-6 && a.maxX > b.minX + 1e-6 && a.minZ < b.maxZ - 1e-6 && a.maxZ > b.minZ + 1e-6;

/** Nombres de los objetos visibles de `others` cuya huella en planta pisa a `footprint`. */
export function overlappingNames(others: readonly SceneObject[], footprint: FootprintXZ | null): string[] {
  if (!footprint) return [];
  return others
    .filter((o) => o.visible && occupiesBed(o))
    .filter((o) => {
      const fp = footprintOf(o.mesh, o.position, o.rotation, o.scale);
      return fp !== null && overlapsXZ(footprint, fp);
    })
    .map((o) => o.name);
}

/** Caja envolvente en mundo de un objeto (mínimo y máximo por eje). */
function worldBox(obj: Placeable): THREE.Box3 | null {
  if (obj.mesh.positions.length < 3) return null;
  const box = new THREE.Box3().setFromArray(obj.mesh.positions);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...obj.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ')),
    new THREE.Vector3(...obj.scale),
  );
  return box.applyMatrix4(matrix);
}

/** Estimación (sin cortar) de la mitad que se conservaría, con la caja del objeto y el plano. */
export interface KeptHalfEstimate {
  /** Altura mundial (Y interna) de la base de la mitad conservada. */
  baseY: number;
  /** Huella en planta de la mitad (caja recortada por el plano si el corte es vertical). */
  footprint: FootprintXZ | null;
  /** La base ya toca la cama: no hay nada que preguntar. */
  restsOnBed: boolean;
}

/**
 * Estima la mitad conservada de un corte con UNA sola mitad. `keepMode` va en sentido interno (el de
 * `PlaneCutOptions` tal como llega al motor); `offset` es respecto del centro de la caja en ese eje.
 * Devuelve null si el objeto no tiene malla o `keepMode` es `both`.
 */
export function estimateKeptHalf(
  obj: Placeable,
  options: Pick<PlaneCutOptions, 'axis' | 'offset' | 'keepMode'>,
): KeptHalfEstimate | null {
  if (options.keepMode === 'both') return null;
  const box = worldBox(obj);
  if (!box) return null;
  const idx = options.axis === 'x' ? 0 : options.axis === 'y' ? 1 : 2;
  const lo = [box.min.x, box.min.y, box.min.z];
  const hi = [box.max.x, box.max.y, box.max.z];
  const plane = (lo[idx] + hi[idx]) / 2 + options.offset;
  if (options.keepMode === 'positive') lo[idx] = Math.max(lo[idx], plane);
  else hi[idx] = Math.min(hi[idx], plane);
  const baseY = lo[1];
  return {
    baseY,
    footprint: { minX: lo[0], maxX: hi[0], minZ: lo[2], maxZ: hi[2] },
    restsOnBed: Math.abs(baseY) <= BED_TOUCH_EPS_MM,
  };
}

/** Resultado de colocar la mitad conservada. */
export interface KeptHalfResult<T> {
  part: T;
  /** Modo aplicado efectivamente (`inPlace` si la mitad ya estaba apoyada o no se pidió nada más). */
  applied: KeptHalfPlacement;
  /** `false` si en el hueco libre no cupo dentro de la cama. */
  fits: boolean;
  /** Objetos con los que se superpone en planta tras colocarla (solo informativo en `dropToBed`). */
  overlaps: string[];
}

/** La pieza ya está apoyada en la cama (su base toca Y = 0). */
export function restsOnBed(part: Placeable): boolean {
  const box = worldBox(part);
  return box !== null && Math.abs(box.min.y) <= BED_TOUCH_EPS_MM;
}

/**
 * Coloca la única mitad conservada de un corte. `others` son los objetos de la escena sin la pieza
 * cortada. `inPlace` no la toca; `dropToBed` baja en Z (Y interna) hasta tocar la cama sin cambiar X/Y del
 * usuario; `freeSpot` la apoya en el primer hueco libre de la cama.
 */
export function placeKeptHalf<T extends Placeable>(
  others: readonly SceneObject[],
  part: T,
  mode: KeptHalfPlacement,
  bed: BedSize | null = null,
): KeptHalfResult<T> {
  if (mode === 'inPlace') return { part, applied: 'inPlace', fits: true, overlaps: [] };
  if (mode === 'dropToBed') {
    const y = computeBedPositionY(part.mesh, part.rotation, part.scale);
    const next = { ...part, position: [part.position[0], y, part.position[2]] as Vec3 };
    return {
      part: next,
      applied: 'dropToBed',
      fits: true,
      overlaps: overlappingNames(others, footprintOf(next.mesh, next.position, next.rotation, next.scale)),
    };
  }
  const spot = placeInFreeSpot(others, part.mesh, part.rotation, part.scale, bed);
  return { part: { ...part, position: spot.position }, applied: 'freeSpot', fits: spot.fits, overlaps: [] };
}

/**
 * Paso común del corte (app y modo sin interfaz): si se conserva una sola mitad y no queda apoyada en la
 * cama, aplica la elección del usuario. Con dos mitades, o si la mitad ya toca la cama, no cambia nada.
 */
export function resolveKeptHalf<T extends Placeable>(
  others: readonly SceneObject[],
  parts: readonly T[],
  options: Pick<PlaneCutOptions, 'keepMode' | 'keptHalfPlacement'>,
  bed: BedSize | null = null,
): KeptHalfResult<T> | null {
  const mode = options.keptHalfPlacement ?? DEFAULT_KEPT_HALF_PLACEMENT;
  if (options.keepMode === 'both' || parts.length !== 1 || mode === 'inPlace') return null;
  if (restsOnBed(parts[0])) return null;
  return placeKeptHalf(others, parts[0], mode, bed);
}
