/**
 * @file src/components/viewport/__tests__/gizmoUserAxes.test.ts
 * @description Fija que las flechas del gizmo (mover y escalar, objeto suelto o grupo) quedan en el lado
 * POSITIVO de los ejes del usuario: X+ derecha, Y+ fondo (−Z interno), Z+ arriba (+Y interno), vista desde
 * cualquier lado, sin cambiar la convención interna.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TransformControls } from 'three-stdlib';
import { orientGizmoToUserAxes } from '../gizmoUserAxes';
import { fromUserVector } from '../../../core/scene/displayAxes';

type Handle = THREE.Mesh & { tag?: string };

function setup(cameraPos: [number, number, number], mode: 'translate' | 'scale' = 'translate', patch = true) {
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 4000);
  camera.position.set(...cameraPos);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const scene = new THREE.Scene();
  const target = new THREE.Object3D();
  scene.add(target);
  const controls = new TransformControls(camera, undefined);
  scene.add(controls);
  controls.attach(target);
  controls.setMode(mode);
  if (patch) expect(orientGizmoToUserAxes(controls)).toBe(true);
  controls.updateMatrixWorld();
  const gizmo = (controls as unknown as { gizmo: { gizmo: Record<string, THREE.Object3D> } }).gizmo;
  return { gizmo, center: new THREE.Vector3() };
}

/** Centroide en mundo de las flechas visibles de un eje interno (lado en que se dibujan). */
function arrowSide(gizmo: { gizmo: Record<string, THREE.Object3D> }, mode: string, name: 'X' | 'Y' | 'Z'): THREE.Vector3 {
  const meshes = gizmo.gizmo[mode].children.filter((c) => c.name === name && c.visible && (c as Handle).isMesh) as Handle[];
  expect(meshes.length).toBeGreaterThan(0);
  const sum = new THREE.Vector3();
  let n = 0;
  for (const mesh of meshes) {
    mesh.updateMatrixWorld(true);
    const pos = mesh.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      sum.add(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
      n++;
    }
  }
  return sum.divideScalar(n);
}

/** Punta de la flecha de mover (vértice más alejado del centro del gizmo). */
function arrowTip(gizmo: { gizmo: Record<string, THREE.Object3D> }, name: 'X' | 'Y' | 'Z'): THREE.Vector3 {
  const mesh = gizmo.gizmo.translate.children.find((c) => c.name === name && c.visible && (c as Handle).isMesh) as Handle;
  mesh.updateMatrixWorld(true);
  const pos = mesh.geometry.getAttribute('position');
  let best = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    if (v.length() > best.length()) best = v;
  }
  return best;
}

const userDir = (axis: 0 | 1 | 2) => {
  const u: [number, number, number] = [0, 0, 0];
  u[axis] = 1;
  return new THREE.Vector3(...fromUserVector(u));
};

/** Ejes a revisar (nombre interno, eje de usuario): el que se ve de punta lo oculta el gizmo. */
function axesFor(cam: [number, number, number]): Array<['X' | 'Y' | 'Z', 0 | 1 | 2]> {
  const eye = new THREE.Vector3(...cam).normalize();
  const all: Array<['X' | 'Y' | 'Z', 0 | 1 | 2]> = [['X', 0], ['Y', 2], ['Z', 1]];
  return all.filter(([name]) => Math.abs(eye.getComponent({ X: 0, Y: 1, Z: 2 }[name])) < 0.99);
}

const VIEWS: Array<[string, [number, number, number]]> = [
  ['superior', [0, 300, 0.3]],
  ['iso', [200, 170, 230]],
  ['desde atrás e izquierda', [-200, 120, -230]],
  ['desde abajo', [50, -300, 40]],
];

describe('gizmo: flechas hacia el lado positivo del usuario', () => {
  for (const [label, cam] of VIEWS) {
    it(`mover, vista ${label}: X+ derecha, Y+ fondo, Z+ arriba`, () => {
      const { gizmo } = setup(cam);
      // Eje interno X = usuario X; interno Y = usuario Z; interno Z = −usuario Y.
      for (const [name, user] of axesFor(cam)) {
        const side = arrowSide(gizmo, 'translate', name);
        expect(side.dot(userDir(user))).toBeGreaterThan(0);
        const tip = arrowTip(gizmo, name);
        expect(tip.dot(userDir(user))).toBeGreaterThan(side.dot(userDir(user)) - 1e-6);
      }
    });
    it(`escalar, vista ${label}: manijas en el lado positivo`, () => {
      const { gizmo } = setup(cam, 'scale');
      for (const [name, user] of axesFor(cam)) {
        expect(arrowSide(gizmo, 'scale', name).dot(userDir(user))).toBeGreaterThan(0);
      }
    });
  }

  it('sin el parche, en vista superior la flecha verde (Z interno) queda hacia el frente (−Y del usuario)', () => {
    const { gizmo } = setup([0, 300, 0.3], 'translate', false);
    expect(arrowSide(gizmo, 'translate', 'Z').dot(userDir(1))).toBeLessThan(0);
  });

  it('el parche es idempotente y deja el modo rotar intacto', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = new TransformControls(camera, undefined);
    expect(orientGizmoToUserAxes(controls)).toBe(true);
    expect(orientGizmoToUserAxes(controls)).toBe(true);
    controls.setMode('rotate');
    expect(() => controls.updateMatrixWorld()).not.toThrow();
    expect(orientGizmoToUserAxes(null)).toBe(false);
  });
});
