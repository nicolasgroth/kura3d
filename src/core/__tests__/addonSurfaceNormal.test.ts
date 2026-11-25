/**
 * @file src/core/__tests__/addonSurfaceNormal.test.ts
 * @description Normal de colocación de los agregados (torreta, imán, ojo de cerradura, paso de cable): en la cara
 * superior de una esfera r20 la faceta tocada está inclinada, pero el poste sale vertical (normal promediada de la
 * superficie en el radio del agregado), por comando (`face: top`) y por el visor (`addonHitFromEvent`). En caras
 * planas el resultado es exactamente la normal de la cara, también con la pieza girada y escalada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPrimitiveMesh } from '../../engine/primitives';
import { addonHitFromEvent } from '../../components/viewport/useAddonPlacement';
import { worldFaceNormal } from '../addons/magnetPocket';
import { rayHitsDetailed } from '../addons/meshRays';
import { resolveAddonPlacement, worldMeshOf } from '../addons/addonPlacement';
import { averagedSurfaceNormal, worldSurfaceNormal } from '../addons/surfaceNormal';
import { buildSceneObject } from '../scene/sceneObjects';
import type { SceneObject, Vec3 } from '../../types/kura';

const angleDeg = (a: Vec3, b: Vec3) => (Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b)))) * 180) / Math.PI;
const UP: Vec3 = [0, 1, 0];

/** Evento del visor simulado: rayo vertical hacia abajo sobre (x, z) contra la pieza real (three.js). */
function downEvent(obj: SceneObject, x: number, z: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(obj.mesh.positions, 3));
  g.setIndex(new THREE.BufferAttribute(obj.mesh.indices, 1));
  const m = new THREE.Mesh(g);
  m.position.set(...obj.position); m.rotation.set(...obj.rotation, 'XYZ'); m.scale.set(...obj.scale);
  m.updateMatrixWorld(true);
  const ray = new THREE.Ray(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0));
  const hit = new THREE.Raycaster(ray.origin, ray.direction).intersectObject(m)[0];
  return { faceIndex: hit.faceIndex!, ray, point: hit.point };
}

describe('Agregados: normal de la superficie, no de la faceta', () => {
  it('esfera r20, cara superior por comando: la faceta está inclinada pero la normal queda vertical', async () => {
    const mesh = await createPrimitiveMesh('sphere', { radius: 20 });
    const host = buildSceneObject({ id: 's', name: 'Esfera', source: 'primitive', mesh });
    const world = worldMeshOf(host);
    const top = Math.max(...Array.from({ length: world.positions.length / 3 }, (_, i) => world.positions[i * 3 + 1]));
    // Lo que se usaba antes: la normal del triángulo cortado (medida para el informe).
    const facet = rayHitsDetailed(world, [0.3, top + 50, 0.2], [0, -1, 0])[0].normal;
    const tilt = angleDeg(facet, UP);
    const at = resolveAddonPlacement(host, { kind: 'face', face: 'top', offsetMm: [0.3, 0.2] }, 4);
    console.info(`esfera r20, cara superior: faceta ${tilt.toFixed(2)}° → promediada ${angleDeg(at.normal, UP).toFixed(2)}°`);
    expect(angleDeg(at.normal, UP)).toBeLessThan(Math.max(0.5, tilt / 4));
  });

  it('esfera r20 en el visor: el poste sale con la normal de la superficie en ese punto', async () => {
    const mesh = await createPrimitiveMesh('sphere', { radius: 20 });
    const obj = buildSceneObject({ id: 's', name: 'Esfera', source: 'primitive', mesh });
    const e = downEvent(obj, 0.4, -0.3);
    const facet = worldFaceNormal(obj.mesh, e.faceIndex, obj.rotation, obj.scale)!;
    const hit = addonHitFromEvent(obj, e, 4)!;
    // Normal radial de la esfera ideal en el punto tocado (centro = centro de la caja).
    const c = obj.position;
    const radial = new THREE.Vector3(hit.point[0] - c[0], hit.point[1] - c[1] - 20, hit.point[2] - c[2]).normalize();
    const ideal: Vec3 = [radial.x, radial.y, radial.z];
    expect(angleDeg(hit.normal, ideal)).toBeLessThan(angleDeg(facet, ideal));
    expect(angleDeg(hit.normal, ideal)).toBeLessThan(1);
  });

  it('caras planas: exactamente la normal de la cara (regresión), también girada y escalada', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 30, height: 10, depth: 20 });
    for (const [rotation, scale] of [[[0, 0, 0], [1, 1, 1]], [[0.3, 0.5, -0.2], [1.5, 0.7, 2]]] as Array<[Vec3, Vec3]>) {
      const obj = { ...buildSceneObject({ id: 'b', name: 'Caja', source: 'primitive', mesh }), rotation, scale };
      for (let face = 0; face < mesh.indices.length / 3; face++) {
        const n = worldFaceNormal(obj.mesh, face, rotation, scale)!;
        const a = mesh.indices[face * 3] * 3;
        const local: Vec3 = [mesh.positions[a], mesh.positions[a + 1], mesh.positions[a + 2]];
        const m = new THREE.Matrix4().compose(new THREE.Vector3(...obj.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation, 'XYZ')), new THREE.Vector3(...scale));
        const p = new THREE.Vector3(...local).applyMatrix4(m);
        expect(worldSurfaceNormal(obj, [p.x, p.y, p.z], n, 5)).toBeNull();
      }
    }
    const host = buildSceneObject({ id: 'b', name: 'Caja', source: 'primitive', mesh });
    expect(resolveAddonPlacement(host, { kind: 'face', face: 'top', offsetMm: [3, -2] }, 8).normal.map((v) => v + 0)).toEqual([0, 1, 0]);
    const e = downEvent(host, 3, -2);
    expect(addonHitFromEvent(host, e, 8)!.normal).toEqual(worldFaceNormal(host.mesh, e.faceIndex, host.rotation, host.scale));
  });

  it('no promedia con una pared vecina (borde de la caja)', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 30, height: 10, depth: 20 });
    // Punto en la cara superior a 1 mm del borde: las caras laterales (90°) quedan fuera del ángulo.
    expect(averagedSurfaceNormal(mesh, [14, 10, 0], [0, 1, 0], 5)).toBeNull();
  });
});
