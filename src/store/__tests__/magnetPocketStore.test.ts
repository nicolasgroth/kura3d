/**
 * @file src/store/__tests__/magnetPocketStore.test.ts
 * @description Alojamiento de imán en el store con el motor real: crear como pieza negativa (nombre, metadatos,
 * agrupado con su pieza), deshacer en un paso, aplicar restas y medir el resultado (sólido cerrado, volumen
 * removido = volumen del hueco ±1 %, caja del hueco) en cara superior, lateral, inclinada (pieza rotada y escalada) y
 * oculto; aviso de pared mínima; metadatos que viajan en el `.kura`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS, pocketDims, pocketSectionArea, worldFaceNormal, type MagnetParams } from '../../core/addons/magnetPocket';
import { applyTransformToMesh, computeMeshStats, initManifoldEngine } from '../../engine';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import type { SceneObject, Vec3 } from '../../types/kura';
import { useKuraStore } from '../useKuraStore';

async function reset() {
  await initManifoldEngine();
  useKuraStore.setState({
    engineReady: true, engineError: null, busyOperation: null, objects: [], groups: [], selectedIds: [], past: [], future: [],
    unitSystem: 'mm', language: 'es', toasts: [],
  });
}

const store = () => useKuraStore.getState();
const worldOf = (o: SceneObject) => applyTransformToMesh(o.mesh, o.position, o.rotation, o.scale);
const worldVolume = (o: SceneObject) => computeMeshStats(worldOf(o)).volumeMm3;

/** Esquinas de mundo de una caja paramétrica (para separar los vértices del hueco de los de la caja). */
function boxCorners(o: SceneObject): THREE.Vector3[] {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation, 'XYZ')), new THREE.Vector3(...o.scale),
  );
  const p = o.mesh.positions;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]); }
  const out: THREE.Vector3[] = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push(new THREE.Vector3(x, y, z).applyMatrix4(m));
  return out;
}

/** Vértices del resultado que no son esquinas de la caja original, expresados en la base del hueco (u, eje, w). */
function pocketExtent(result: SceneObject, corners: THREE.Vector3[], origin: Vec3, normal: Vec3) {
  const n = new THREE.Vector3(...normal).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const u = Math.abs(n.dot(up)) > 0.999 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3().crossVectors(up, n).normalize();
  const w = new THREE.Vector3().crossVectors(u, n).normalize();
  const p = worldOf(result).positions;
  const o = new THREE.Vector3(...origin);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    const v = new THREE.Vector3(p[i], p[i + 1], p[i + 2]);
    if (corners.some((c) => c.distanceTo(v) < 1e-3)) continue;
    const d = v.sub(o);
    const c = [d.dot(u), d.dot(n), d.dot(w)];
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], c[k]); max[k] = Math.max(max[k], c[k]); }
  }
  return { width: max[0] - min[0], depth: max[1] - min[1], length: max[2] - min[2], top: max[1], bottom: min[1] };
}

async function placeAndApply(host: SceneObject, point: Vec3, normal: Vec3, params: MagnetParams = MAGNET_DEFAULTS) {
  const before = worldVolume(host);
  const corners = boxCorners(host);
  const placed = await store().addMagnetPocket({ hostId: host.id, params, point, normal });
  expect(placed).not.toBeNull();
  store().clearSelection();
  await store().applyHolesOnSolids();
  const result = store().objects.find((o) => o.id === host.id)!;
  expect(store().objects.some((o) => o.role === 'negative')).toBe(false);
  expect(result.stats.isManifold).toBe(true);
  const removed = before - worldVolume(result);
  const dims = pocketDims(params);
  const expected = pocketSectionArea(dims) * dims.depthMm;
  return { removed, expected, extent: pocketExtent(result, corners, point, normal), wall: placed!.wall };
}

describe('alojamiento de imán (store + motor real)', () => {
  beforeEach(reset);

  it('crea un negativo «Imán 5 × 2» con metadatos, agrupado con la pieza, y se deshace en un paso', async () => {
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const steps = store().past.length;
    const placed = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [0, 30, 0], normal: [0, 1, 0] });
    const neg = placed!.obj;
    expect(neg.role).toBe('negative');
    expect(neg.name).toBe('Imán 5 × 2');
    expect(neg.metadata?.addon).toEqual({ kind: 'magnet_pocket', params: MAGNET_DEFAULTS, hostId: host.id });
    expect(store().objects).toHaveLength(2);
    const groupRef = store().objects.find((o) => o.id === neg.id)!.groupRef;
    expect(groupRef).toBeDefined();
    expect(store().objects.find((o) => o.id === host.id)!.groupRef).toBe(groupRef);
    expect(store().past.length).toBe(steps + 1);
    store().undo();
    expect(store().objects.map((o) => o.id)).toEqual([host.id]);
  });

  it('cara superior: volumen removido = hueco ±1 % y caja del hueco 5,2 × 2,2', async () => {
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const r = await placeAndApply(host, [0, 30, 0], [0, 1, 0]);
    expect(Math.abs(r.removed - r.expected) / r.expected).toBeLessThan(0.01);
    expect(r.extent.depth).toBeCloseTo(2.2, 3);
    expect(r.extent.top).toBeCloseTo(0, 3);
    expect(r.extent.width).toBeGreaterThanOrEqual(5.2 - 1e-3);
    expect(r.extent.width).toBeLessThan(5.22);
    expect(r.wall.minWallMm).toBeCloseTo(12.4, 2);
  });

  it('cara lateral (+X): mismo hueco, eje horizontal', async () => {
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const r = await placeAndApply(host, [15, 15, 0], [1, 0, 0], { ...MAGNET_DEFAULTS, sizeMm: 8, heightMm: 3 });
    expect(Math.abs(r.removed - r.expected) / r.expected).toBeLessThan(0.01);
    expect(r.extent.depth).toBeCloseTo(3.2, 3);
    expect(r.extent.width).toBeGreaterThanOrEqual(8.2 - 1e-3);
  });

  it('rectangular 10 × 5 × 2 en una cara lateral: volumen = hueco ±1 %, largo hacia arriba y, con giro, horizontal', async () => {
    const rect: MagnetParams = { ...MAGNET_DEFAULTS, shape: 'rect', sizeMm: 10, widthMm: 5, heightMm: 2 };
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const r = await placeAndApply(host, [15, 15, 0], [1, 0, 0], rect);
    expect(Math.abs(r.removed - r.expected) / r.expected).toBeLessThan(0.01);
    expect(r.extent.depth).toBeCloseTo(2.2, 3);
    // u = horizontal de la cara, w = vertical: el largo (10,2) va hacia arriba.
    expect(r.extent.width).toBeCloseTo(5.2, 2);
    expect(r.extent.length).toBeCloseTo(10.2, 2);
    await reset();
    const host2 = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const t90 = await placeAndApply(host2, [15, 15, 0], [1, 0, 0], { ...rect, turn90: true });
    expect(t90.extent.width).toBeCloseTo(10.2, 2);
    expect(t90.extent.length).toBeCloseTo(5.2, 2);
  });

  it('cara inclinada de una pieza rotada y escalada; cuadrado', async () => {
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0], rotation: [0, 0, Math.PI / 6], scale: [1.2, 1, 1] }))!;
    // Triángulo de la cara superior local (todos sus vértices en y = 30).
    const p = host.mesh.positions, idx = host.mesh.indices;
    let face = -1;
    for (let t = 0; t < idx.length / 3 && face < 0; t++) if ([0, 1, 2].every((k) => Math.abs(p[idx[t * 3 + k] * 3 + 1] - 30) < 1e-4)) face = t;
    const normal = worldFaceNormal(host.mesh, face, host.rotation, host.scale)!;
    expect(normal[1]).toBeCloseTo(Math.cos(Math.PI / 6), 6);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...host.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...host.rotation, 'XYZ')), new THREE.Vector3(...host.scale));
    const c = new THREE.Vector3(0, 30, 0).applyMatrix4(m);
    const params = { ...MAGNET_DEFAULTS, shape: 'square' as const };
    const r = await placeAndApply(host, [c.x, c.y, c.z], normal, params);
    expect(Math.abs(r.removed - r.expected) / r.expected).toBeLessThan(0.01);
    expect(r.extent.depth).toBeCloseTo(2.2, 3);
    expect(r.extent.width).toBeCloseTo(5.2, 3);
    expect(r.extent.length).toBeCloseTo(5.2, 3);
  });

  it('oculto: hueco cerrado bajo 0,6 mm de material; sólido cerrado con el mismo volumen removido', async () => {
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const r = await placeAndApply(host, [0, 30, 0], [0, 1, 0], { ...MAGNET_DEFAULTS, hidden: true });
    expect(Math.abs(r.removed - r.expected) / r.expected).toBeLessThan(0.01);
    expect(r.extent.top).toBeCloseTo(-0.6, 3);
    expect(r.extent.bottom).toBeCloseTo(-2.8, 3);
  });

  it('avisa si la pared queda bajo 1,2 mm o si atraviesa la pieza (sin bloquear)', async () => {
    const plate = (await store().createPrimitive('box', { width: 30, height: 2, depth: 30 }, { position: [0, 0, 0] }))!;
    const placed = await store().addMagnetPocket({ hostId: plate.id, params: MAGNET_DEFAULTS, point: [0, 2, 0], normal: [0, 1, 0] });
    expect(placed!.wall.through).toBe(true);
    expect(store().toasts.some((t) => /atraviesa/i.test(t.text))).toBe(true);
    const thick = (await store().createPrimitive('box', { width: 30, height: 3, depth: 30 }, { position: [60, 0, 0] }))!;
    const thin = await store().addMagnetPocket({ hostId: thick.id, params: MAGNET_DEFAULTS, point: [60, 3, 0], normal: [0, 1, 0] });
    expect(thin!.wall.minWallMm).toBeCloseTo(0.8, 3);
    expect(store().toasts.some((t) => t.text.includes('0,8'))).toBe(true);
  });

  it('sin pieza sólida no crea nada', async () => {
    expect(await store().addMagnetPocket({ hostId: 'nada', params: MAGNET_DEFAULTS, point: [0, 0, 0], normal: [0, 1, 0] })).toBeNull();
    expect(store().objects).toHaveLength(0);
  });

  it('los metadatos del imán viajan en el .kura', async () => {
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const placed = await store().addMagnetPocket({ hostId: host.id, params: { ...MAGNET_DEFAULTS, hidden: true }, point: [0, 30, 0], normal: [0, 1, 0] });
    const s = store();
    const bytes = encodeProject({
      objects: s.objects, groups: s.groups, selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: s.printerProfile,
      customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 1,
    });
    const back = decodeProject(bytes).objects.find((o) => o.id === placed!.obj.id)!;
    expect(back.metadata?.addon).toEqual({ kind: 'magnet_pocket', params: { ...MAGNET_DEFAULTS, hidden: true }, hostId: host.id });
  });
});
