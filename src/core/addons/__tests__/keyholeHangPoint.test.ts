/**
 * @file src/core/addons/__tests__/keyholeHangPoint.test.ts
 * @description Punto de cuelgue de un ojo ya colocado con escala no uniforme y giro: coincide con llevar el extremo
 * de la ranura (local) por la transformación completa del objeto (posición · rotación · escala), espejo incluido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { SceneObject, Vec3 } from '../../../types/kura';
import { keyholeHangPoint } from '../keyhole';
import { KEYHOLE_DEFAULTS } from '../keyholePresets';

const posed = (position: Vec3, rotation: Vec3, scale: Vec3) => ({
  position, rotation, scale,
  metadata: { addon: { kind: 'keyhole', hostId: 'h', params: { ...KEYHOLE_DEFAULTS } } },
}) as unknown as SceneObject;

const viaMatrix = (o: SceneObject): Vec3 => {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation, 'XYZ')), new THREE.Vector3(...o.scale),
  );
  const v = new THREE.Vector3(KEYHOLE_DEFAULTS.slotLengthMm, 0, 0).applyMatrix4(m);
  return [v.x, v.y, v.z];
};

describe('punto de cuelgue con escala no uniforme', () => {
  const cases: [string, Vec3, Vec3][] = [
    ['escala distinta por eje, sin giro', [0, 0, 0], [2, 0.5, 3]],
    ['escala distinta por eje y giro', [0.4, -1.1, 0.7], [2, 0.5, 3]],
    ['espejo en X', [0, 0.3, 0], [-1.5, 1, 1]],
  ];
  it.each(cases)('%s: coincide con la transformación completa', (_label, rotation, scale) => {
    const o = posed([5, 20, -3], rotation, scale);
    const hang = keyholeHangPoint(o)!;
    viaMatrix(o).forEach((v, i) => expect(hang[i]).toBeCloseTo(v, 9));
  });

  it('no es un ojo: null', () => {
    expect(keyholeHangPoint({ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as unknown as SceneObject)).toBeNull();
  });
});
