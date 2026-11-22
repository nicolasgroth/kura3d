/**
 * @file src/core/__tests__/freeSpot.test.ts
 * @description Colocación en espacio libre: escena vacía, un objeto al centro, cama llena y
 * objetos rotados (se usa su caja envolvente en mundo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { findFreeSpot, footprintOf, placeGroupInFreeSpot, placeInFreeSpot, sceneFootprints, type FootprintXZ } from '../scene/freeSpot';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';

/** Caja de w×h×d con base en Y=0 y centrada en XZ (como `normalizeMeshToBed`). */
function boxMesh(w: number, h: number, d: number): MeshData {
  const p: number[] = [];
  for (const x of [-w / 2, w / 2]) for (const y of [0, h]) for (const z of [-d / 2, d / 2]) p.push(x, y, z);
  return { positions: new Float32Array(p), indices: new Uint32Array([0, 1, 2]) };
}
const obj = (mesh: MeshData, position: Vec3, rotation: Vec3 = [0, 0, 0], visible = true) =>
  ({ id: 'o', mesh, position, rotation, scale: [1, 1, 1], visible }) as unknown as SceneObject;

const overlap = (a: FootprintXZ, b: FootprintXZ) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const BED = { width: 220, depth: 220 };

describe('findFreeSpot / placeInFreeSpot', () => {
  it('escena vacía: centro de la cama, apoyada en Y=0', () => {
    const placed = placeInFreeSpot([], boxMesh(20, 10, 20), [0, 0, 0], [1, 1, 1], BED);
    expect(placed).toEqual({ position: [0, 0, 0], fits: true });
  });

  it('un objeto al centro: la pieza nueva queda pegada sin solaparse, lo más cerca del centro', () => {
    const center = obj(boxMesh(30, 30, 30), [0, 0, 0]);
    const mesh = boxMesh(20, 10, 20);
    const placed = placeInFreeSpot([center], mesh, [0, 0, 0], [1, 1, 1], BED);
    expect(placed.fits).toBe(true);
    const fp = footprintOf(mesh, placed.position, [0, 0, 0], [1, 1, 1])!;
    expect(overlap(fp, sceneFootprints([center])[0])).toBe(false);
    // 15 (mitad del cubo) + 5 (separación) + 10 (mitad de la pieza) = 30 mm del centro en un eje.
    expect(Math.hypot(placed.position[0], placed.position[2])).toBeCloseTo(30, 5);
  });

  it('ignora objetos ocultos', () => {
    const hidden = obj(boxMesh(30, 30, 30), [0, 0, 0], [0, 0, 0], false);
    expect(placeInFreeSpot([hidden], boxMesh(10, 10, 10), [0, 0, 0], [1, 1, 1], BED).position).toEqual([0, 0, 0]);
  });

  it('cama llena: queda junto a la cama y avisa (fits=false)', () => {
    const full: FootprintXZ = { minX: -110, maxX: 110, minZ: -110, maxZ: 110 };
    const spot = findFreeSpot([full], [20, 20], BED);
    expect(spot.fits).toBe(false);
    expect(spot.x - 10).toBeGreaterThanOrEqual(110);
  });

  it('pieza más grande que la cama: no cabe', () => {
    expect(findFreeSpot([], [300, 20], BED).fits).toBe(false);
  });

  it('sin límites de cama siempre encuentra un hueco', () => {
    const full: FootprintXZ = { minX: -110, maxX: 110, minZ: -110, maxZ: 110 };
    expect(findFreeSpot([full], [20, 20], null).fits).toBe(true);
  });

  it('objetos rotados: usa la caja envolvente en mundo (45° agranda la huella)', () => {
    const rotated = obj(boxMesh(40, 10, 40), [0, 0, 0], [0, Math.PI / 4, 0]);
    const [fp] = sceneFootprints([rotated]);
    expect(fp.maxX - fp.minX).toBeCloseTo(40 * Math.SQRT2, 3);
    const mesh = boxMesh(10, 10, 10);
    const placed = placeInFreeSpot([rotated], mesh, [0, 0, 0], [1, 1, 1], BED);
    expect(overlap(footprintOf(mesh, placed.position, [0, 0, 0], [1, 1, 1])!, fp)).toBe(false);
  });

  it('varias piezas seguidas nunca se solapan entre sí', () => {
    const scene: SceneObject[] = [];
    for (let i = 0; i < 12; i++) {
      const mesh = boxMesh(25, 10, 25);
      const placed = placeInFreeSpot(scene, mesh, [0, 0, 0], [1, 1, 1], BED);
      expect(placed.fits).toBe(true);
      const fp = footprintOf(mesh, placed.position, [0, 0, 0], [1, 1, 1])!;
      expect(Math.abs(fp.minX) <= 110 && Math.abs(fp.maxX) <= 110 && Math.abs(fp.minZ) <= 110 && Math.abs(fp.maxZ) <= 110).toBe(true);
      for (const other of sceneFootprints(scene)) expect(overlap(fp, other)).toBe(false);
      scene.push(obj(mesh, placed.position));
    }
  });
});

describe('placeGroupInFreeSpot', () => {
  it('mueve el grupo como bloque a un hueco sin solapar la pieza original', () => {
    const master = obj(boxMesh(30, 30, 30), [0, 0, 0]);
    const items = [
      { mesh: boxMesh(20, 10, 20), position: [-12, 0, 0] as Vec3 },
      { mesh: boxMesh(20, 10, 20), position: [12, 0, 0] as Vec3 },
    ];
    const { offset, fits } = placeGroupInFreeSpot([master], items, BED);
    expect(fits).toBe(true);
    const fps = items.map((it) => footprintOf(it.mesh, [it.position[0] + offset[0], 0, it.position[2] + offset[2]], [0, 0, 0], [1, 1, 1])!);
    for (const fp of fps) expect(overlap(fp, sceneFootprints([master])[0])).toBe(false);
    // Las mitades conservan su separación relativa (32 mm entre centros).
    expect(fps[1].minX - fps[0].minX).toBeCloseTo(24, 5);
  });
});
