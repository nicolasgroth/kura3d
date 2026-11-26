/**
 * @file src/core/scene/displayAxes.test.ts
 * @description Pruebas de la capa de conversión de ejes interno (Y arriba) ↔ usuario (Z arriba).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Vec3 } from '../../types/kura';
import {
  faceOfInternalDirection,
  fromUserBox,
  fromUserRotation,
  fromUserSize,
  fromUserVector,
  internalDirectionOfUser,
  toUserBox,
  toUserRotation,
  toUserSize,
  toUserVector,
  userAxisLabel,
  userDirectionOfInternal,
} from './displayAxes';

const deg = THREE.MathUtils.degToRad;

function rotate(rotation: Vec3, v: Vec3): Vec3 {
  const r = new THREE.Vector3(...v).applyEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
  return [r.x, r.y, r.z];
}

function expectVec(actual: Vec3, expected: Vec3, digits = 9) {
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], digits));
}

describe('displayAxes: vectores y tamaños', () => {
  it('Z del usuario es la altura interna (Y) e Y del usuario es el fondo (−Z interno)', () => {
    expect(toUserVector([1, 2, 3])).toEqual([1, -3, 2]);
    expect(fromUserVector([0, 0, 10])).toEqual([0, 10, 0]);
    expect(fromUserVector([0, 30, 0])).toEqual([0, 0, -30]);
  });

  it('ida y vuelta de vectores, tamaños y cajas', () => {
    const v: Vec3 = [4.5, -7, 12];
    expect(fromUserVector(toUserVector(v))).toEqual(v);
    expect(toUserVector(fromUserVector(v))).toEqual(v);
    expect(fromUserSize(toUserSize([10, 30, 20]))).toEqual([10, 30, 20]);
    const box = { min: [-5, 0, -10] as Vec3, max: [5, 30, 10] as Vec3 };
    expect(fromUserBox(toUserBox(box))).toEqual(box);
  });

  it('un cubo interno de 10 × 30 × 20 (alto 30) se lee 10 × 20 × 30 con Z = alto', () => {
    expect(toUserSize([10, 30, 20])).toEqual([10, 20, 30]);
    const ub = toUserBox({ min: [0, 0, 0], max: [10, 30, 20] });
    expect(ub).toEqual({ min: [0, -20, 0], max: [10, 0, 30] });
    ub.min.forEach((m, i) => expect(m).toBeLessThanOrEqual(ub.max[i]));
  });

  it('rótulos y direcciones', () => {
    expect(userAxisLabel('y')).toBe('Z');
    expect(userAxisLabel('z')).toBe('Y');
    expect(internalDirectionOfUser('+z')).toBe('+y');
    expect(internalDirectionOfUser('+y')).toBe('-z');
    expect(internalDirectionOfUser('-y')).toBe('+z');
    expect(userDirectionOfInternal('+z')).toBe('-y');
    expect(faceOfInternalDirection('+y')).toBe('top');
    expect(faceOfInternalDirection('+z')).toBe('front');
    expect(faceOfInternalDirection('-z')).toBe('back');
  });
});

describe('displayAxes: rotaciones', () => {
  it('girar 90° en Z del usuario es girar alrededor de la vertical interna', () => {
    expectVec(fromUserRotation([0, 0, deg(90)]), [0, deg(90), 0]);
    expectVec(toUserRotation([0, deg(90), 0]), [0, 0, deg(90)]);
  });

  it('girar en Y del usuario es girar en −Z interno', () => {
    expectVec(fromUserRotation([0, deg(30), 0]), [0, 0, deg(-30)]);
  });

  it('la rotación convertida mueve los vectores igual que en el sistema del usuario', () => {
    const userRot: Vec3 = [deg(20), deg(-35), deg(70)];
    const internalRot = fromUserRotation(userRot);
    const p: Vec3 = [3, -2, 5];
    // Rotar en el sistema del usuario y convertir = convertir y rotar en el sistema interno.
    expectVec(toUserVector(rotate(internalRot, fromUserVector(p))), rotate(userRot, p));
  });

  it('ida y vuelta de rotaciones compuestas', () => {
    const samples: Vec3[] = [
      [deg(10), deg(20), deg(30)],
      [deg(-45), deg(60), deg(-120)],
      [deg(90), 0, deg(90)],
      [0, deg(-80), deg(15)],
    ];
    for (const r of samples) {
      expectVec(fromUserRotation(toUserRotation(r)), r);
      expectVec(toUserRotation(fromUserRotation(r)), r);
    }
  });

  it('composición: dos giros sobre la cama suman el ángulo en Z', () => {
    const first = fromUserRotation([0, 0, deg(30)]);
    const user = toUserRotation(first);
    const second = fromUserRotation([user[0], user[1], user[2] + deg(45)]);
    expectVec(second, [0, deg(75), 0]);
  });
});
