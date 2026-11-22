/**
 * @file src/core/scene/cameraFraming.test.ts
 * @description Pruebas de la política de encuadre: distancia por caja, campo de visión y aspecto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitDistance, framePose, isBoxInView, type FrameBox, type Vec3 } from './cameraFraming';

function cameraAt(pose: { position: Vec3; target: Vec3 }, fov: number, aspect: number) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100000);
  cam.position.set(...pose.position);
  cam.lookAt(new THREE.Vector3(...pose.target));
  cam.updateMatrixWorld();
  return new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements;
}

const cube10: FrameBox = { min: [-5, 0, -5], max: [5, 10, 5] };
const cylinder1m: FrameBox = { min: [-50, 0, -50], max: [50, 1000, 50] };
const iso: Vec3 = [0.72, 0.62, 0.85];

describe('fitDistance', () => {
  it('crece linealmente con el tamaño de la caja', () => {
    const small = fitDistance({ box: cube10, viewDir: iso, fovDeg: 42, aspect: 1.6 });
    const big = fitDistance({
      box: { min: [-500, 0, -500], max: [500, 1000, 500] },
      viewDir: iso,
      fovDeg: 42,
      aspect: 1.6,
    });
    expect(big / small).toBeCloseTo(100, 5);
  });

  it('un aspecto vertical (móvil) exige más distancia que uno apaisado', () => {
    const wide = fitDistance({ box: { min: [-500, 0, -10], max: [500, 20, 10] }, viewDir: [0, 0, 1], fovDeg: 42, aspect: 1.78 });
    const tall = fitDistance({ box: { min: [-500, 0, -10], max: [500, 20, 10] }, viewDir: [0, 0, 1], fovDeg: 42, aspect: 390 / 844 });
    expect(tall).toBeGreaterThan(wide * 3);
  });

  it('un campo de visión más estrecho exige más distancia', () => {
    const a = fitDistance({ box: cube10, viewDir: iso, fovDeg: 60, aspect: 1 });
    const b = fitDistance({ box: cube10, viewDir: iso, fovDeg: 30, aspect: 1 });
    expect(b).toBeGreaterThan(a);
  });

  for (const [label, aspect] of [['escritorio', 1440 / 860], ['390×844', 390 / 760]] as const) {
    for (const [name, box] of [['cubo 10 mm', cube10], ['cilindro 1000 mm', cylinder1m]] as const) {
      it(`${name} queda entero y sin sobrar demasiado en ${label}`, () => {
        const pose = framePose({ box, viewDir: iso, fovDeg: 42, aspect });
        const vp = cameraAt(pose, 42, aspect);
        expect(isBoxInView(box, vp, 0.99)).toBe(true);
        // Ajustado: a un 70 % de la distancia ya no cabe.
        const near = framePose({ box, viewDir: iso, fovDeg: 42, aspect });
        const closer = {
          target: near.target,
          position: near.target.map((t, i) => t + (near.position[i] - t) * 0.7) as Vec3,
        };
        expect(isBoxInView(box, cameraAt(closer, 42, aspect), 0.99)).toBe(false);
      });
    }
  }
});

describe('isBoxInView', () => {
  it('detecta una caja fuera de cuadro y una detrás de la cámara', () => {
    const vp = cameraAt({ position: [0, 0, 100], target: [0, 0, 0] }, 42, 1);
    expect(isBoxInView(cube10, vp)).toBe(true);
    expect(isBoxInView({ min: [300, 0, 0], max: [310, 10, 10] }, vp)).toBe(false);
    expect(isBoxInView({ min: [0, 0, 200], max: [10, 10, 210] }, vp)).toBe(false);
  });
});

describe('framePose', () => {
  it('respeta los límites de distancia y apunta al centro', () => {
    const pose = framePose({ box: cube10, viewDir: [0, 0, 1], fovDeg: 42, aspect: 1, minDistance: 18, maxDistance: 50 });
    expect(pose.distance).toBeGreaterThanOrEqual(18);
    expect(pose.target).toEqual([0, 5, 0]);
    expect(pose.position[2]).toBeCloseTo(pose.distance, 6);
  });
});
