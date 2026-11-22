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

export type { FootprintXZ };

/** Cama centrada en el origen (ancho X, fondo Z) en mm. */
export interface BedSize {
  width: number;
  depth: number;
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

/** Huellas de los objetos visibles de la escena. */
export function sceneFootprints(objects: readonly SceneObject[]): FootprintXZ[] {
  const out: FootprintXZ[] = [];
  for (const obj of objects) {
    if (!obj.visible) continue;
    const fp = footprintOf(obj.mesh, obj.position, obj.rotation, obj.scale);
    if (fp) out.push(fp);
  }
  return out;
}

const EPS = 1e-6;

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
      const dist = x * x + z * z;
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
 * primer hueco libre, sin solapar los objetos visibles ni separar las piezas entre sí.
 */
export function placeGroupInFreeSpot(
  objects: readonly SceneObject[],
  items: ReadonlyArray<{ mesh: MeshData; position: Vec3 }>,
  bed: BedSize | null = null,
): { offset: Vec3; fits: boolean } {
  const fps = items
    .map((it) => footprintOf(it.mesh, it.position, [0, 0, 0], [1, 1, 1]))
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
