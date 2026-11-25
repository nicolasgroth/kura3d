/**
 * @file src/core/scene/__tests__/rigidFollow.test.ts
 * @description Los negativos pendientes del grupo acompañan a su pieza con la misma transformación rígida (posición
 * y giro relativos intactos), y solo se eligen los que nadie más mueve.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fakeBox } from '../../../test/fakeObjects';
import type { SceneObject, Vec3 } from '../../../types/kura';
import { plainGroupNegatives, rigidFollowPatches } from '../rigidFollow';

const obj = (id: string, extra: Partial<SceneObject>): SceneObject => ({ ...fakeBox(id, id), ...extra }) as SceneObject;
const m = (p: { position: Vec3; rotation: Vec3; scale: Vec3 }) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...p.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rotation)), new THREE.Vector3(...p.scale));

describe('rigidFollow', () => {
  it('elige solo negativos del mismo grupo, sin agregado propio y sin bloquear', () => {
    const host = obj('pieza', { groupRef: 'g1' });
    const scene = [
      host,
      obj('hueco', { groupRef: 'g1', role: 'negative' }),
      obj('iman', { groupRef: 'g1', role: 'negative', metadata: { addon: { kind: 'magnet_pocket' } } as never }),
      obj('otroGrupo', { groupRef: 'g2', role: 'negative' }),
      obj('solido', { groupRef: 'g1' }),
      obj('bloqueado', { groupRef: 'g1', role: 'negative', locked: true }),
    ];
    expect(plainGroupNegatives(scene, host).map((o) => o.id)).toEqual(['hueco']);
    expect(plainGroupNegatives(scene, obj('suelta', {}))).toEqual([]);
  });

  it('el negativo conserva su pose relativa a la pieza tras girarla y moverla', () => {
    const from = { position: [10, 5, -3] as Vec3, rotation: [0, 0, 0] as Vec3, scale: [1, 1, 1] as Vec3 };
    const to = { position: [40, 12, 7] as Vec3, rotation: [Math.PI / 2, 0.3, 0] as Vec3, scale: [1, 1, 1] as Vec3 };
    const hueco = obj('hueco', { position: [14, 9, -3], rotation: [0, 0.5, 0], scale: [1, 1, 1] });
    const relBefore = m(from).invert().multiply(m(hueco));
    const [{ patch }] = rigidFollowPatches([hueco], from, to);
    const relAfter = m(to).invert().multiply(m({ ...hueco, ...patch }));
    relBefore.elements.forEach((v, i) => expect(relAfter.elements[i]).toBeCloseTo(v, 6));
    // De verdad se movió: no es el mismo lugar de antes.
    expect(Math.hypot(patch.position[0] - 14, patch.position[1] - 9, patch.position[2] + 3)).toBeGreaterThan(10);
  });

  it('si la pieza no cambió, el negativo tampoco', () => {
    const pose = { position: [1, 2, 3] as Vec3, rotation: [0.1, 0.2, 0.3] as Vec3, scale: [2, 1, 1] as Vec3 };
    const hueco = obj('hueco', { position: [4, 5, 6], rotation: [0, 0, 0.4], scale: [1, 1, 1] });
    const [{ patch }] = rigidFollowPatches([hueco], pose, pose);
    patch.position.forEach((v, i) => expect(v).toBeCloseTo(hueco.position[i], 6));
    patch.rotation.forEach((v, i) => expect(v).toBeCloseTo(hueco.rotation[i], 6));
  });
});
