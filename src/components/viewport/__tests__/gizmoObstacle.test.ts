/**
 * @file src/components/viewport/__tests__/gizmoObstacle.test.ts
 * @description Huella del manipulador en pantalla: centrada en el pivote, proporcional al alto del visor y nula si no se ve.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { findGizmoRoot, gizmoScreenObstacle } from '../gizmoObstacle';

function setup() {
  const scene = new THREE.Scene();
  const target = new THREE.Object3D();
  scene.add(target);
  const root = new THREE.Object3D() as THREE.Object3D & { object: THREE.Object3D; size: number; enabled: boolean; };
  root.object = target;
  root.size = 0.78;
  root.enabled = true;
  const gizmo = new THREE.Object3D() as THREE.Object3D & { isTransformControlsGizmo: boolean };
  gizmo.isTransformControlsGizmo = true;
  root.add(gizmo);
  scene.add(root);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  return { scene, root, camera, target };
}

describe('gizmoScreenObstacle', () => {
  it('se centra en el pivote y mide 1,9·size/8 · 0,85 del alto del visor por lado', () => {
    const { scene, camera } = setup();
    const ob = gizmoScreenObstacle(findGizmoRoot(scene), camera, { width: 600, height: 400 });
    expect(ob).not.toBeNull();
    expect((ob!.left + ob!.right) / 2).toBeCloseTo(300, 3);
    expect((ob!.top + ob!.bottom) / 2).toBeCloseTo(200, 3);
    expect((ob!.right - ob!.left) / 2).toBeCloseTo(((1.9 * 0.78) / 8) * 400 * 0.85, 3);
  });
  it('sin manipulador, oculto, deshabilitado o con el pivote detrás de la cámara no hay zona', () => {
    const { scene, root, camera, target } = setup();
    const vp = { width: 600, height: 400 };
    expect(gizmoScreenObstacle(null, camera, vp)).toBeNull();
    root.visible = false;
    expect(gizmoScreenObstacle(root, camera, vp)).toBeNull();
    root.visible = true;
    root.enabled = false;
    expect(gizmoScreenObstacle(root, camera, vp)).toBeNull();
    root.enabled = true;
    target.position.set(0, 0, 200);
    expect(gizmoScreenObstacle(findGizmoRoot(scene), camera, vp)).toBeNull();
  });
});
