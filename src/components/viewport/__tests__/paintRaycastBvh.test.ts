/**
 * @file src/components/viewport/__tests__/paintRaycastBvh.test.ts
 * @description El BVH del visor (three-mesh-bvh en modo indirecto) no altera la geometría pintada y
 * el raycast acelerado devuelve la misma cara y el mismo punto que el raycast normal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import { describe, expect, it } from 'vitest';
import { PAINT_BVH_OPTIONS } from '../paintPointer';
import { createBufferGeometryFromMeshData } from '../../../engine/primitives';
import { seededRandom, uvSphere } from '../../../engine/paint/__tests__/paintTestMeshes';

describe('raycast con BVH indirecto', () => {
  it('misma cara que el raycast normal y sin índice nuevo', () => {
    const m = uvSphere(20, 64, 32);
    const geometry = createBufferGeometryFromMeshData({ ...m, faceColors: new Array(m.indices.length / 3).fill('#ffffff') }, '#ffffff');
    const plain = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const fast = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const indexBefore = geometry.index;
    (geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree = new MeshBVH(geometry, PAINT_BVH_OPTIONS);
    fast.raycast = acceleratedRaycast;
    expect(geometry.index).toBe(indexBefore);
    const rand = seededRandom(7);
    const ray = new THREE.Raycaster();
    for (let i = 0; i < 50; i++) {
      const dir = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      ray.set(dir.clone().multiplyScalar(-60), dir);
      const a = ray.intersectObject(plain)[0];
      const b = ray.intersectObject(fast)[0];
      expect(b.faceIndex).toBe(a.faceIndex);
      expect(b.point.distanceTo(a.point)).toBeLessThan(1e-6);
    }
  });
});
