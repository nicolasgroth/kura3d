/**
 * @file src/core/addons/__tests__/magnetFollow.test.ts
 * @description `followMagnetHosts` como función pura: el imán sigue a su pieza al escalarla, rotarla o moverla sola;
 * no se mueve dos veces si el grupo ya lo movió, respeta una edición propia del imán, deshacer y rehacer, una malla
 * nueva de la pieza y los imanes bloqueados; y sale sin trabajo si no hay imanes o ninguna pieza anfitriona cambió.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { MeshData, SceneObject, Vec3 } from '../../../types/kura';
import { followMagnetHosts } from '../magnetFollow';
import { MAGNET_DEFAULTS, placePocket, pocketDims } from '../magnetPocket';

const mesh: MeshData = { positions: new Float32Array(9), indices: new Uint32Array([0, 1, 2]) };
const bottom = pocketDims(MAGNET_DEFAULTS).bottomMm;

const piece = (id: string, extra: Partial<SceneObject> = {}): SceneObject => ({
  id, name: id, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], mesh, ...extra,
} as unknown as SceneObject);

/** Imán en el punto `point` (local = mundo con la pieza en el origen) de la cara de normal `normal`. */
function magnetOn(hostId: string, point: Vec3, normal: Vec3, id = 'm'): SceneObject {
  const plan = placePocket(MAGNET_DEFAULTS, point, normal)!;
  return piece(id, {
    position: plan.position, rotation: plan.rotation, mesh: { ...mesh },
    metadata: { addon: { kind: 'magnet_pocket', params: { ...MAGNET_DEFAULTS }, hostId } },
  } as Partial<SceneObject>);
}

const matrixOf = (o: SceneObject) => new THREE.Matrix4().compose(
  new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation, 'XYZ')), new THREE.Vector3(...o.scale),
);
const axisOf = (o: SceneObject) => new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...o.rotation, 'XYZ'));
const mouthOf = (o: SceneObject) => new THREE.Vector3(...o.position).addScaledVector(axisOf(o), bottom * o.scale[1]);
const byId = (list: SceneObject[], id: string) => list.find((o) => o.id === id)!;

function scene() {
  const host = piece('h');
  // Cara +X de un cubo de 30 (x = 15), a media altura.
  const magnet = magnetOn('h', [15, 15, 0], [1, 0, 0]);
  return { host, magnet, prev: [host, magnet, piece('other')] };
}

describe('followMagnetHosts', () => {
  it('escala de la pieza sola: el imán conserva su medida y queda en la cara escalada', () => {
    const { host, prev } = scene();
    const next = prev.map((o) => (o === host ? { ...o, scale: [2, 1, 1] as Vec3 } : o));
    const out = followMagnetHosts(prev, next);
    const m = byId(out, 'm');
    expect(m.scale).toEqual([1, 1, 1]);
    expect(mouthOf(m).distanceTo(new THREE.Vector3(30, 15, 0))).toBeLessThan(1e-9);
  });

  it('rotación de la pieza sola: el imán gira con ella (boca y eje)', () => {
    const { host, prev } = scene();
    const rotation: Vec3 = [0, Math.PI / 2, 0];
    const next = prev.map((o) => (o === host ? { ...o, rotation } : o));
    const out = followMagnetHosts(prev, next);
    const h = byId(out, 'h'), m = byId(out, 'm');
    const expected = new THREE.Vector3(15, 15, 0).applyMatrix4(matrixOf(h));
    expect(mouthOf(m).distanceTo(expected)).toBeLessThan(1e-9);
    const n = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(...rotation, 'XYZ'));
    expect(axisOf(m).distanceTo(n)).toBeLessThan(1e-9);
  });

  it('traslación de la pieza sola: el imán se mueve lo mismo', () => {
    const { host, magnet, prev } = scene();
    const next = prev.map((o) => (o === host ? { ...o, position: [10, 0, -5] as Vec3 } : o));
    const m = byId(followMagnetHosts(prev, next), 'm');
    m.position.forEach((v, i) => expect(v).toBeCloseTo(magnet.position[i] + [10, 0, -5][i], 9));
    m.rotation.forEach((v, i) => expect(v).toBeCloseTo(magnet.rotation[i], 9));
  });

  it('el grupo ya movió al imán: no se mueve dos veces', () => {
    const { prev } = scene();
    const shift = (o: SceneObject): SceneObject => ({ ...o, position: [o.position[0] + 10, o.position[1], o.position[2]] });
    const next = prev.map((o) => (o.id === 'other' ? o : shift(o)));
    expect(followMagnetHosts(prev, next)).toBe(next);
  });

  it('el imán editado a mano en el mismo cambio se respeta', () => {
    const { host, magnet, prev } = scene();
    const next = prev.map((o) => (o === host ? { ...o, position: [5, 0, 0] as Vec3 } : o === magnet ? { ...o, position: [0, 0, 0] as Vec3 } : o));
    expect(followMagnetHosts(prev, next)).toBe(next);
  });

  it('deshacer y rehacer (pieza e imán vuelven juntos, como en la instantánea) no se mueven de nuevo', () => {
    const { host, prev } = scene();
    const moved = followMagnetHosts(prev, prev.map((o) => (o === host ? { ...o, position: [10, 0, 0] as Vec3 } : o)));
    // Deshacer: la instantánea trae copias de pieza e imán en su pose anterior.
    const undone = prev.map((o) => ({ ...o }));
    expect(followMagnetHosts(moved, undone)).toBe(undone);
    // Rehacer: vuelve el estado movido (copias).
    const redone = moved.map((o) => ({ ...o }));
    expect(followMagnetHosts(undone, redone)).toBe(redone);
  });

  it('malla nueva de la pieza (resta, aplicar escala) o imán bloqueado: no se sigue', () => {
    const { host, magnet, prev } = scene();
    const remeshed = prev.map((o) => (o === host ? { ...o, mesh: { ...mesh }, position: [3, 0, 0] as Vec3 } : o));
    expect(followMagnetHosts(prev, remeshed)).toBe(remeshed);
    const locked = prev.map((o) => (o === magnet ? { ...o, locked: true } : o));
    const next = locked.map((o) => (o.id === 'h' ? { ...o, position: [3, 0, 0] as Vec3 } : o));
    expect(followMagnetHosts(locked, next)).toBe(next);
  });

  it('cambio que no mueve la pieza (color, nombre): no hay nada que seguir', () => {
    const { host, prev } = scene();
    const next = prev.map((o) => (o === host ? { ...o, name: 'otro' } : o));
    expect(followMagnetHosts(prev, next)).toBe(next);
  });

  it('salida temprana: sin imanes, o si solo cambian piezas que no son anfitrionas, no lee los demás objetos', () => {
    let reads = 0;
    const counted = (id: string) => {
      const o = piece(id);
      return new Proxy(o, { get: (t, k, r) => { if (k !== 'metadata') reads += 1; return Reflect.get(t, k, r); } });
    };
    const many = Array.from({ length: 5000 }, (_, i) => counted(`p${i}`));
    const { host, magnet } = scene();
    // Sin imanes: solo se miran los metadatos.
    const plain = [...many];
    const plainNext = [...plain];
    plainNext[10] = { ...piece('p10'), position: [1, 0, 0] };
    reads = 0;
    expect(followMagnetHosts(plain, plainNext)).toBe(plainNext);
    expect(reads).toBe(0);
    // Con imanes, cambia una pieza que no es anfitriona: no se leen las que no cambiaron ni se arma nada.
    const prev = [host, magnet, ...many];
    const next = [...prev];
    next[200] = { ...piece('p198'), position: [1, 0, 0] };
    reads = 0;
    expect(followMagnetHosts(prev, next)).toBe(next);
    expect(reads).toBe(0);
  });
});
