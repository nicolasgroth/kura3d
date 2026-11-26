/**
 * @file src/engine/__tests__/splitMagnetPrincipalAngle.test.ts
 * @description Eje principal de la sección para orientar imanes rectangulares: el mismo ángulo con el contorno en
 * sentido antihorario u horario (normalizado por el signo del área), también con un agujero y en diagonal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { principalAngle } from '../split/splitMagnetBlock';

type Vec2 = [number, number];
/** Rectángulo `w × h` centrado en (cx, cy), antihorario, girado `ang` radianes. */
function rect(w: number, h: number, ang = 0, cx = 0, cy = 0): Vec2[] {
  const c = Math.cos(ang), s = Math.sin(ang);
  return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Vec2[])
    .map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c] as Vec2);
}
const cw = (p: Vec2[]) => [...p].reverse();
/** Ángulo de una dirección (sin sentido): módulo π, en [0, π). */
const axis = (a: number) => ((a % Math.PI) + Math.PI) % Math.PI;

describe('principalAngle: sentido del contorno', () => {
  it('rectángulo largo en X: 0 en antihorario y en horario', () => {
    expect(axis(principalAngle([rect(40, 10, 0, 5, 3)]))).toBeCloseTo(0, 6);
    expect(axis(principalAngle([cw(rect(40, 10, 0, 5, 3))]))).toBeCloseTo(0, 6);
  });

  it('rectángulo en diagonal (30°): mismo eje en los dos sentidos', () => {
    const a = Math.PI / 6;
    expect(axis(principalAngle([rect(40, 10, a)]))).toBeCloseTo(a, 6);
    expect(axis(principalAngle([cw(rect(40, 10, a))]))).toBeCloseTo(a, 6);
  });

  it('con agujero en sentido contrario al exterior, también con todo invertido', () => {
    const outer = rect(60, 20, 0);
    const hole = cw(rect(10, 10, 0));
    expect(axis(principalAngle([outer, hole]))).toBeCloseTo(0, 6);
    expect(axis(principalAngle([cw(outer), cw(hole)]))).toBeCloseTo(0, 6);
  });
});
