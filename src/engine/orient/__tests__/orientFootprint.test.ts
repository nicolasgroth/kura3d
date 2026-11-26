/**
 * @file src/engine/orient/__tests__/orientFootprint.test.ts
 * @description Orientar deja la huella alineada: un cubo de 20 mm girado (30°, 17°) apoyado en una cara del casco
 * queda 20 × 20 sobre la cama (no 28,17 × 28,17 en diagonal); una pieza ya alineada no cambia de giro; sin
 * `alignFootprint` se conserva el comportamiento anterior. También el casco 2D y el ángulo mínimo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPrimitiveMesh } from '../../index';
import { analyzeOrientations, planOrientTransform } from '../orientForPrint';
import { convexHull2D, footprintYaw } from '../orientFootprint';
import type { MeshData, Vec3 } from '../../../types/kura';

const deg = (d: number) => (d * Math.PI) / 180;

/** Caja de mundo de la malla con la transformación dada. */
function worldBox(mesh: MeshData, t: { position: Vec3; rotation: Vec3; scale: Vec3 }) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...t.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotation, 'XYZ')), new THREE.Vector3(...t.scale));
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (let i = 0; i < mesh.positions.length; i += 3) box.expandByPoint(v.set(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]).applyMatrix4(m));
  return box;
}

describe('Orientar: huella alineada', () => {
  it('casco 2D y ángulo: un cuadrado girado 30° se alinea con el giro más corto', () => {
    const sq: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]];
    expect(convexHull2D(sq)).toHaveLength(4);
    const c = Math.cos(deg(30)), s = Math.sin(deg(30));
    const turned = sq.map(([x, z]) => [x * c - z * s, x * s + z * c] as [number, number]);
    expect(Math.abs(footprintYaw(turned))).toBeCloseTo(deg(30), 6);
    expect(footprintYaw(sq)).toBe(0);
  });

  it('cubo girado (30°, 17°) apoyado en una cara del casco: 20 × 20 sobre la cama', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const obj = { mesh, position: [0, 10, 0] as Vec3, rotation: [deg(30), deg(17), 0] as Vec3, scale: [1, 1, 1] as Vec3 };
    const analysis = analyzeOrientations(obj);
    const hull = analysis.candidates.find((c) => c.source !== 'current' && c.id.startsWith('hull'))
      ?? analysis.candidates.find((c) => c.source !== 'current')!;
    const before = planOrientTransform(obj, hull.quaternion, { alignFootprint: false });
    const after = planOrientTransform(obj, hull.quaternion, { alignFootprint: true });
    const sizeOf = (t: typeof after) => worldBox(mesh, t).getSize(new THREE.Vector3());
    const a = sizeOf(after);
    expect(a.x).toBeCloseTo(20, 2);
    expect(a.z).toBeCloseTo(20, 2);
    expect(a.y).toBeCloseTo(20, 2);
    expect(worldBox(mesh, after).min.y).toBeCloseTo(0, 6);
    // Sin alinear quedaba en diagonal (más ancho) si el candidato no venía ya alineado.
    const b = sizeOf(before);
    expect(b.x * b.z).toBeGreaterThanOrEqual(a.x * a.z - 1e-6);
  });

  it('el giro mínimo a mano también se corrige, y una pieza alineada no cambia', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const obj = { mesh, position: [0, 10, 0] as Vec3, rotation: [deg(30), deg(17), 0] as Vec3, scale: [1, 1, 1] as Vec3 };
    // Cuaternión mínimo que lleva la cara −Y girada hacia abajo: deja la huella en diagonal.
    const objQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(30), deg(17), 0, 'XYZ'));
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(objQ);
    const q = new THREE.Quaternion().setFromUnitVectors(down, new THREE.Vector3(0, -1, 0));
    const quat: [number, number, number, number] = [q.x, q.y, q.z, q.w];
    const diag = worldBox(mesh, planOrientTransform(obj, quat)).getSize(new THREE.Vector3());
    expect(diag.x).toBeGreaterThan(22);
    const fixed = worldBox(mesh, planOrientTransform(obj, quat, { alignFootprint: true })).getSize(new THREE.Vector3());
    expect(fixed.x).toBeCloseTo(20, 2);
    expect(fixed.z).toBeCloseTo(20, 2);

    const aligned = { mesh, position: [0, 10, 0] as Vec3, rotation: [0, 0, 0] as Vec3, scale: [1, 1, 1] as Vec3 };
    const same = planOrientTransform(aligned, [0, 0, 0, 1], { alignFootprint: true });
    expect(same.rotation).toEqual([0, 0, 0]);
  });
});
