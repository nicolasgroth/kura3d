/**
 * @file src/core/scene/cameraFraming.test.ts
 * @description Pruebas de la política de encuadre: distancia por caja, campo de visión y aspecto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  candidateViewDirs,
  chooseUnoccludedViewDir,
  fitDistance,
  framePose,
  isBoxInView,
  needsReframeAfterEdit,
  segmentHitsBox,
  type FrameBox,
  type Vec3,
} from './cameraFraming';

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
        // Ajustado: a un 60 % de la distancia ya no cabe.
        const near = framePose({ box, viewDir: iso, fovDeg: 42, aspect });
        const closer = {
          target: near.target,
          position: near.target.map((t, i) => t + (near.position[i] - t) * 0.6) as Vec3,
        };
        expect(isBoxInView(box, cameraAt(closer, 42, aspect), 0.99)).toBe(false);
      });
    }
  }
});

describe('isBoxInView', () => {
  it('con paneles encima, una caja tapada por el panel derecho no cuenta como visible', () => {
    const vp = cameraAt({ position: [0, 0, 100], target: [0, 0, 0] }, 42, 1);
    const atRight: FrameBox = { min: [25, -5, -5], max: [32, 5, 5] };
    expect(isBoxInView(atRight, vp)).toBe(true);
    const covered = { insets: { top: 0, bottom: 0, left: 0, right: 300 }, width: 1000, height: 1000 };
    expect(isBoxInView(atRight, vp, 0.96, covered)).toBe(false);
    expect(isBoxInView(cube10, vp, 0.96, covered)).toBe(true);
  });

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

describe('área libre (insets)', () => {
  it('con una franja inferior tapada, la caja queda dentro del área libre', () => {
    const insets = { top: 0, bottom: 0.3, left: 0, right: 0 };
    const pose = framePose({ box: cylinder1m, viewDir: iso, fovDeg: 42, aspect: 390 / 844, insets, margin: 1.1 });
    const vp = cameraAt(pose, 42, 390 / 844);
    const m = new THREE.Matrix4().fromArray(Array.from(vp));
    for (const x of [-50, 50]) for (const y of [0, 1000]) for (const z of [-50, 50]) {
      const v = new THREE.Vector4(x, y, z, 1).applyMatrix4(m);
      // NDC y = −1 es el borde inferior; la franja libre empieza en −1 + 2·0.3 = −0.4.
      expect(v.y / v.w).toBeGreaterThan(-0.4);
      expect(v.y / v.w).toBeLessThan(1);
    }
    expect(fitDistance({ box: cylinder1m, viewDir: iso, fovDeg: 42, aspect: 1, insets })).toBeGreaterThan(
      fitDistance({ box: cylinder1m, viewDir: iso, fovDeg: 42, aspect: 1 }),
    );
  });
});

describe('dirección sin oclusión', () => {
  it('segmentHitsBox detecta cruces', () => {
    expect(segmentHitsBox([-10, 5, 0], [10, 5, 0], cube10)).toBe(true);
    expect(segmentHitsBox([-10, 50, 0], [10, 50, 0], cube10)).toBe(false);
  });

  it('si la vista actual queda tapada por otro objeto, elige otra desde la que se ve', () => {
    const parts: FrameBox = { min: [-20, 0, -20], max: [20, 40, 20] };
    // Una pared alta entre las piezas y la cámara actual (que mira desde +Z).
    const wall: FrameBox = { min: [-200, 0, 60], max: [200, 1000, 80] };
    const current: Vec3 = [0, 0.3, 1];
    const dir = chooseUnoccludedViewDir({ box: parts, fovDeg: 42, aspect: 1.6, candidates: candidateViewDirs(current), blockers: [wall] });
    expect(dir).not.toEqual(current);
    expect(dir[2]).toBeLessThan(0.2);
  });

  it('sin obstáculos conserva la vista actual', () => {
    const current: Vec3 = [0, 0.3, 1];
    expect(chooseUnoccludedViewDir({ box: cube10, fovDeg: 42, aspect: 1, candidates: candidateViewDirs(current), blockers: [] })).toEqual(current);
  });
});

describe('needsReframeAfterEdit', () => {
  const pose = framePose({ box: cube10, viewDir: iso, fovDeg: 42, aspect: 1.6 });
  const vp = cameraAt(pose, 42, 1.6);
  it('no salta en una edición normal', () => {
    const slightlyBigger: FrameBox = { min: [-6, 0, -6], max: [6, 12, 6] };
    expect(needsReframeAfterEdit(slightlyBigger, pose.position, vp)).toBe(false);
  });
  it('reencuadra si la cámara queda dentro del objeto editado (escala Y × 27,78)', () => {
    const huge: FrameBox = { min: [-500, 0, -500], max: [500, 2778, 500] };
    expect(needsReframeAfterEdit(huge, pose.position, vp)).toBe(true);
  });
  it('reencuadra si ocupa más del 150 % del alto visible', () => {
    const tall: FrameBox = { min: [-5, -400, -5], max: [5, 400, 5] };
    expect(needsReframeAfterEdit(tall, pose.position, vp)).toBe(true);
  });
  it('reencuadra si queda diminuto (< 3 %)', () => {
    const tiny: FrameBox = { min: [-0.05, 5, -0.05], max: [0.05, 5.1, 0.05] };
    expect(needsReframeAfterEdit(tiny, pose.position, vp)).toBe(true);
  });
});
