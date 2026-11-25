/**
 * @file src/core/scene/freeSpot.ts
 * @description Colocación de piezas nuevas en espacio libre: busca el hueco más cercano al centro
 * de la cama cuya huella XZ no se solape con las cajas envolventes en mundo de los objetos
 * visibles, dentro de la cama si se conoce; si no cabe, la deja junto a la cama y lo indica.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { FootprintXZ } from '../../engine/io/importPlacement';
import { PLACEMENT_GAP_MM } from '../../engine/io/importPlacement';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { computeBedPositionY } from './sceneObjects';
import { occupiesBed } from './objectRole';

export type { FootprintXZ };

/** Cama centrada en el origen (ancho X, fondo Z) en mm. */
export interface BedSize {
  width: number;
  depth: number;
  /** Centro [X, Z] de la cama en el mundo (placas); ausente = el origen. */
  origin?: [number, number];
}

export interface FreeSpot {
  /** Centro XZ de la huella colocada. */
  x: number;
  z: number;
  /** false si no cupo en la cama y quedó junto a ella. */
  fits: boolean;
}

/** Huella XZ en mundo de una malla con transformación (caja envolvente de los vértices transformados). */
export function footprintOf(mesh: MeshData, position: Vec3, rotation: Vec3, scale: Vec3): FootprintXZ | null {
  if (mesh.positions.length < 3) return null;
  const box = new THREE.Box3().setFromArray(mesh.positions);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ')),
    new THREE.Vector3(...scale),
  );
  box.applyMatrix4(matrix);
  return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
}

/** Huellas de los objetos visibles de la escena (las referencias no ocupan cama). */
export function sceneFootprints(objects: readonly SceneObject[]): FootprintXZ[] {
  const out: FootprintXZ[] = [];
  for (const obj of objects) {
    if (!obj.visible || (obj.role !== undefined && !occupiesBed(obj))) continue;
    const fp = footprintOf(obj.mesh, obj.position, obj.rotation, obj.scale);
    if (fp) out.push(fp);
  }
  return out;
}

const EPS = 1e-6;
/**
 * Peso de la distancia hacia el frente (+Z, hacia la cámara inicial) y hacia el fondo al elegir hueco.
 * Ambos altos: desde la vista inicial una pieza delante tapa al modelo y una detrás queda oculta tras
 * él, y en los dos casos parece caer encima. Solo se usa otra fila cuando el costado queda lejos.
 */
const FRONT_WEIGHT = 25;
const BACK_WEIGHT = 16;

function overlaps(x: number, z: number, hw: number, hd: number, r: FootprintXZ, gap: number): boolean {
  return x - hw < r.maxX + gap - EPS && x + hw > r.minX - gap + EPS
    && z - hd < r.maxZ + gap - EPS && z + hd > r.minZ - gap + EPS;
}

/**
 * Busca el centro XZ libre más cercano al origen para una huella de `size` = [ancho, fondo].
 * Los candidatos son el centro y las posiciones pegadas (con `gap`) a cada lado de cada huella
 * ocupada, combinadas en X y Z; gana el más cercano al centro que no solapa y cabe en la cama.
 */
export function findFreeSpot(
  occupied: readonly FootprintXZ[],
  size: [number, number],
  bed: BedSize | null = null,
  gap = PLACEMENT_GAP_MM,
): FreeSpot {
  const origin = bed?.origin;
  if (bed && origin && (origin[0] !== 0 || origin[1] !== 0)) {
    // Cama de otra placa: se busca en su marco local (centrada en el origen) y el resultado vuelve al mundo.
    const local = occupied.map((r) => ({ minX: r.minX - origin[0], maxX: r.maxX - origin[0], minZ: r.minZ - origin[1], maxZ: r.maxZ - origin[1] }));
    const spot = findFreeSpot(local, size, { width: bed.width, depth: bed.depth }, gap);
    return { x: spot.x + origin[0], z: spot.z + origin[1], fits: spot.fits };
  }
  const hw = Math.max(0, size[0]) / 2;
  const hd = Math.max(0, size[1]) / 2;
  const xs = new Set<number>([0]);
  const zs = new Set<number>([0]);
  for (const r of occupied) {
    xs.add(r.maxX + gap + hw);
    xs.add(r.minX - gap - hw);
    zs.add(r.maxZ + gap + hd);
    zs.add(r.minZ - gap - hd);
  }
  if (bed) {
    // Bordes de la cama: permiten ocupar esquinas cuando el centro está lleno.
    xs.add(bed.width / 2 - hw);
    xs.add(-bed.width / 2 + hw);
    zs.add(bed.depth / 2 - hd);
    zs.add(-bed.depth / 2 + hd);
  }
  const insideBed = (x: number, z: number) =>
    !bed || (Math.abs(x) + hw <= bed.width / 2 + EPS && Math.abs(z) + hd <= bed.depth / 2 + EPS);

  let best: FreeSpot | null = null;
  let bestDist = Infinity;
  for (const x of xs) {
    for (const z of zs) {
      // Se prefiere el costado (X) al frente o al fondo: desde la vista inicial (de frente y arriba)
      // una pieza delante (+Z interno) tapa al modelo y parece caer encima; detrás queda oculta.
      const dist = x * x + z * z * (z > EPS ? FRONT_WEIGHT : z < -EPS ? BACK_WEIGHT : 1);
      if (dist >= bestDist || !insideBed(x, z)) continue;
      if (occupied.some((r) => overlaps(x, z, hw, hd, r, gap))) continue;
      best = { x, z, fits: true };
      bestDist = dist;
    }
  }
  if (best) return best;

  // No cabe: junto a la cama (a la derecha), más allá de cualquier pieza ya puesta fuera.
  const right = Math.max(bed ? bed.width / 2 : 0, ...occupied.map((r) => r.maxX));
  return { x: right + gap + hw, z: 0, fits: false };
}

/**
 * Posición mundial para insertar una malla nueva apoyada en la cama en el primer hueco libre.
 * Devuelve también si cupo dentro de la cama.
 */
export function placeInFreeSpot(
  objects: readonly SceneObject[],
  mesh: MeshData,
  rotation: Vec3 = [0, 0, 0],
  scale: Vec3 = [1, 1, 1],
  bed: BedSize | null = null,
): { position: Vec3; fits: boolean } {
  const own = footprintOf(mesh, [0, 0, 0], rotation, scale) ?? { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  const spot = findFreeSpot(sceneFootprints(objects), [own.maxX - own.minX, own.maxZ - own.minZ], bed);
  const cx = (own.minX + own.maxX) / 2;
  const cz = (own.minZ + own.maxZ) / 2;
  const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);
  return {
    position: [clean(spot.x - cx), computeBedPositionY(mesh, rotation, scale), clean(spot.z - cz)],
    fits: spot.fits,
  };
}

/**
 * Desplazamiento XZ para mover un grupo de piezas (con posiciones ya en mundo) como un bloque al
 * primer hueco libre, sin solapar los objetos visibles ni separar las piezas entre sí. Usa el giro y
 * la escala de cada pieza si los trae.
 */
export function placeGroupInFreeSpot(
  objects: readonly SceneObject[],
  items: ReadonlyArray<{ mesh: MeshData; position: Vec3; rotation?: Vec3; scale?: Vec3 }>,
  bed: BedSize | null = null,
): { offset: Vec3; fits: boolean } {
  const fps = items
    .map((it) => footprintOf(it.mesh, it.position, it.rotation ?? [0, 0, 0], it.scale ?? [1, 1, 1]))
    .filter((f): f is FootprintXZ => f !== null);
  if (fps.length === 0) return { offset: [0, 0, 0], fits: true };
  const union = {
    minX: Math.min(...fps.map((f) => f.minX)), maxX: Math.max(...fps.map((f) => f.maxX)),
    minZ: Math.min(...fps.map((f) => f.minZ)), maxZ: Math.max(...fps.map((f) => f.maxZ)),
  };
  const spot = findFreeSpot(sceneFootprints(objects), [union.maxX - union.minX, union.maxZ - union.minZ], bed);
  const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);
  return {
    offset: [clean(spot.x - (union.minX + union.maxX) / 2), 0, clean(spot.z - (union.minZ + union.maxZ) / 2)],
    fits: spot.fits,
  };
}

const overlapsXZ = (a: FootprintXZ, b: FootprintXZ) =>
  a.minX < b.maxX - EPS && a.maxX > b.minX + EPS && a.minZ < b.maxZ - EPS && a.maxZ > b.minZ + EPS;

type Placeable = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>;

/**
 * Coloca un grupo de piezas nuevas (molde, etc.): primero como bloque en el primer hueco libre y,
 * si alguna pieza del grupo queda encima de otra del mismo grupo, la lleva sola a otro hueco libre.
 */
export function placePartsInFreeSpot<T extends Placeable>(
  objects: readonly SceneObject[],
  parts: readonly T[],
  bed: BedSize | null = null,
): { parts: T[]; fits: boolean } {
  const group = placeGroupInFreeSpot(objects, parts, bed);
  let fits = group.fits;
  const out: T[] = [];
  const placedFps: FootprintXZ[] = [];
  for (const part of parts) {
    let next: T = {
      ...part,
      position: [part.position[0] + group.offset[0], part.position[1], part.position[2] + group.offset[2]],
    };
    const fp = footprintOf(next.mesh, next.position, next.rotation, next.scale);
    if (fp && placedFps.some((other) => overlapsXZ(fp, other))) {
      const scene = [...objects, ...out.map((p) => ({ ...p, visible: true }) as unknown as SceneObject)];
      const spot = placeInFreeSpot(scene, next.mesh, next.rotation, next.scale, bed);
      fits = fits && spot.fits;
      next = { ...next, position: spot.position };
    }
    const placedFp = footprintOf(next.mesh, next.position, next.rotation, next.scale);
    if (placedFp) placedFps.push(placedFp);
    out.push(next);
  }
  return { parts: out, fits };
}

/** Separación entre las dos mitades de un corte por plano (mm). */
export const CUT_SEPARATION_MM = 4;

/**
 * Separa las mitades de un corte para que no queden encimadas: con plano vertical (X o Z) se
 * alejan `CUT_SEPARATION_MM` a lo largo del eje; con plano horizontal (Y) la mitad superior se
 * apoya en la cama en el primer hueco libre junto a la inferior.
 * @param others objetos de la escena sin la pieza cortada.
 * @param parts mitades en el orden [positiva, negativa]; con una sola mitad no cambia nada.
 */
export function separateCutHalves<T extends Placeable>(
  others: readonly SceneObject[],
  parts: readonly T[],
  axis: 'x' | 'y' | 'z',
  bed: BedSize | null = null,
): { parts: T[]; fits: boolean } {
  if (parts.length !== 2) return { parts: [...parts], fits: true };
  const [upper, lower] = parts;
  if (axis === 'y') {
    const scene = [...others, { ...lower, visible: true } as unknown as SceneObject];
    const spot = placeInFreeSpot(scene, upper.mesh, upper.rotation, upper.scale, bed);
    return { parts: [{ ...upper, position: spot.position }, lower], fits: spot.fits };
  }
  const k = axis === 'x' ? 0 : 2;
  const shift = (p: T, sign: number): T => {
    const position = [...p.position] as Vec3;
    position[k] += (sign * CUT_SEPARATION_MM) / 2;
    return { ...p, position };
  };
  return { parts: [shift(upper, 1), shift(lower, -1)], fits: true };
}

/** true si alguna de las piezas pisa (en planta) la huella de alguno de los objetos visibles `others`. */
export function overlapsOthers(others: readonly SceneObject[], parts: readonly Placeable[]): boolean {
  const occupied = sceneFootprints(others);
  return parts.some((part) => {
    const fp = footprintOf(part.mesh, part.position, part.rotation, part.scale);
    return fp !== null && occupied.some((other) => overlapsXZ(fp, other));
  });
}

/**
 * Resultados de una operación (mitades, piezas separadas o extraídas, duplicados): si alguno pisa a
 * OTRO objeto, el conjunto se mueve como bloque al primer hueco libre (entre sí no se separan).
 * @param others objetos de la escena que no forman parte del resultado (ni la pieza de origen si se reemplaza).
 */
export function keepClearOfOthers<T extends Placeable>(
  others: readonly SceneObject[],
  parts: readonly T[],
  bed: BedSize | null = null,
): { parts: T[]; fits: boolean; moved: boolean } {
  if (parts.length === 0 || !overlapsOthers(others, parts)) return { parts: [...parts], fits: true, moved: false };
  const group = placeGroupInFreeSpot(others, parts, bed);
  return {
    parts: parts.map((p) => ({ ...p, position: [p.position[0] + group.offset[0], p.position[1], p.position[2] + group.offset[2]] as Vec3 })),
    fits: group.fits,
    moved: true,
  };
}
