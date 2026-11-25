/**
 * @file src/store/__tests__/screwBossStore.test.ts
 * @description Torreta para tornillo en el store con el motor real: colocar en cara superior, lateral e inclinada y
 * sobre una pieza escalada; al aplicar las restas el poste se une a la pieza y el agujero la corta: un solo cuerpo
 * cerrado, volumen agregado y removido según poste y agujero (± 1 %) y agujero del diámetro y la profundidad
 * pedidos. También: un solo paso de deshacer, seguir a la pieza al moverla y escalarla conservando medidas,
 * duplicar y borrar con la pieza, metadatos en el .kura y no colocar si el poste es más ancho que la cara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { pocketFrame } from '../../core/addons/magnetPocket';
import { rayHits } from '../../core/addons/meshRays';
import { bossHoleVolumeMm3, bossPostVolumeAboveMm3, type ScrewBossParams } from '../../core/addons/screwBoss';
import { SCREW_BOSS_DEFAULTS } from '../../core/addons/screwBossPresets';
import { isClosedMesh } from '../../engine/meshClosure';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import type { SceneObject, Vec3 } from '../../types/kura';
import { bodyCount, byId, pickFace, resetMagnetStore, store, worldOf, worldVolume } from './magnetTestKit';

const M3 = SCREW_BOSS_DEFAULTS;
const bosses = () => store().objects.filter((o) => o.metadata?.addon?.kind === 'screw_boss');
const box30 = (position: Vec3 = [0, 0, 0]) =>
  store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position }).then((o) => o!);
const axisOf = (o: SceneObject) => new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...o.rotation, 'XYZ'));
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

/** Aplica las restas sobre toda la escena y devuelve la pieza resultante. */
async function applyAll(hostId: string): Promise<SceneObject> {
  store().clearSelection();
  await store().applyHolesOnSolids();
  return byId(hostId);
}

/** Mide el agujero en la pieza ya restada: profundidad desde la boca y radio libre a media profundidad. */
function measureHole(host: SceneObject, point: Vec3, normal: Vec3, p: ScrewBossParams) {
  const world = worldOf(host);
  const f = pocketFrame(normal)!;
  const at = (k: number): Vec3 => [0, 1, 2].map((i) => point[i] + f.axis[i] * k) as Vec3;
  const down: Vec3 = [-f.axis[0], -f.axis[1], -f.axis[2]];
  const lift = p.heightMm + 1;
  const depth = rayHits(world, at(lift), down)[0] - 1;
  const mid = at(p.heightMm - p.holeDepthMm / 2);
  const radius = Math.min(...[f.u, f.w, [-f.u[0], -f.u[1], -f.u[2]] as Vec3].map((d) => rayHits(world, mid, d)[0]));
  return { depth, radius };
}

async function checkResult(host: SceneObject, point: Vec3, normal: Vec3, p: ScrewBossParams = M3) {
  const before = worldVolume(host);
  const placed = await store().addScrewBoss({ hostId: host.id, params: p, point, normal });
  expect(placed).not.toBeNull();
  const after = await applyAll(host.id);
  expect(bosses()).toHaveLength(0);
  const world = worldOf(after);
  expect(isClosedMesh(world)).toBe(true);
  expect(after.stats.isManifold).toBe(true);
  expect(bodyCount(world)).toBe(1);
  const expected = before + bossPostVolumeAboveMm3(p) - bossHoleVolumeMm3(p);
  expect(rel(worldVolume(after), expected)).toBeLessThan(0.01);
  const hole = measureHole(after, point, normal, p);
  expect(hole.depth).toBeCloseTo(p.holeDepthMm, 1);
  expect(hole.radius).toBeGreaterThan(p.holeDiameterMm / 2 - 0.02);
  expect(hole.radius).toBeLessThan(p.holeDiameterMm / 2 / Math.cos(Math.PI / 64) + 0.02);
  return { placed: placed!, after };
}

describe('torreta: colocar y aplicar con el motor real', () => {
  beforeEach(resetMagnetStore);

  it('cara superior: poste sólido y agujero negativo agrupados con la pieza, en un paso de deshacer', async () => {
    const host = await box30();
    const steps = store().past.length;
    const placed = (await store().addScrewBoss({ hostId: host.id, params: M3, point: [0, 30, 0], normal: [0, 1, 0] }))!;
    expect(store().past.length).toBe(steps + 1);
    expect(placed.post.role).toBe('solid');
    expect(placed.hole.role).toBe('negative');
    expect(placed.post.metadata?.addon).toMatchObject({ kind: 'screw_boss', part: 'post', hostId: host.id, params: M3 });
    expect(placed.hole.metadata?.addon).toMatchObject({ kind: 'screw_boss', part: 'hole', hostId: host.id });
    const group = byId(host.id).groupRef;
    expect(group).toBeTruthy();
    expect(byId(placed.post.id).groupRef).toBe(group);
    expect(byId(placed.hole.id).groupRef).toBe(group);
    store().undo();
    expect(bosses()).toHaveLength(0);
  });

  it('cara superior: un cuerpo cerrado, volumen y agujero medidos; deshacer devuelve todo', async () => {
    const host = await box30();
    const volume = worldVolume(host);
    await checkResult(host, [0, 30, 0], [0, 1, 0]);
    store().undo();
    expect(bosses()).toHaveLength(2);
    expect(worldVolume(byId(host.id))).toBeCloseTo(volume, 3);
  });

  it('cara lateral (+X)', async () => {
    const host = await box30();
    await checkResult(host, [15, 15, 0], [1, 0, 0]);
  });

  it('cara inclinada (pieza rotada 30°)', async () => {
    const host = await box30();
    store().setObjectTransform(host.id, { rotation: [0, 0, Math.PI / 6] }, true);
    const h = byId(host.id);
    const hit = pickFace(worldOf(h), [0, 80, 0], [0, -1, 0]);
    // Cara inclinada: ni horizontal ni vertical.
    expect(Math.abs(hit.normal[1])).toBeGreaterThan(0.4);
    expect(Math.abs(hit.normal[1])).toBeLessThan(0.9);
    await checkResult(h, hit.point, hit.normal);
  });

  it('pieza escalada (2 × 1 × 1) e inserto M3', async () => {
    const host = await box30();
    store().setObjectTransform(host.id, { scale: [2, 1, 1] }, true);
    const insert: ScrewBossParams = { type: 'insert', nominalMm: 3, holeDiameterMm: 4, holeDepthMm: 6.7, heightMm: 8.7, outerDiameterMm: 7.5 };
    await checkResult(byId(host.id), [10, 30, 0], [0, 1, 0], insert);
  });

  it('cara curva (costado de un cilindro): el poste se hunde y queda un solo cuerpo cerrado', async () => {
    const host = (await store().createPrimitive('cylinder', { radius: 12, height: 30, segments: 96 }, { position: [0, 0, 0] }))!;
    const hit = pickFace(worldOf(host), [40, 15, 0.01], [-1, 0, 0]);
    const placed = (await store().addScrewBoss({ hostId: host.id, params: M3, point: hit.point, normal: hit.normal }))!;
    expect(placed.report.seatMm).toBeGreaterThan(0.5);
    const after = await applyAll(host.id);
    expect(isClosedMesh(worldOf(after))).toBe(true);
    expect(bodyCount(worldOf(after))).toBe(1);
  });

  it('poste más ancho que la cara: no se coloca y lo dice', async () => {
    const thin = (await store().createPrimitive('box', { width: 30, height: 30, depth: 5 }, { position: [0, 0, 0] }))!;
    store().dismissAllToasts();
    const count = store().objects.length;
    expect(await store().addScrewBoss({ hostId: thin.id, params: M3, point: [0, 30, 0], normal: [0, 1, 0] })).toBeNull();
    expect(store().objects).toHaveLength(count);
    expect(store().toasts.some((x) => /no cabe/.test(x.text))).toBe(true);
  });

  it('avisa si choca con otra torreta pendiente', async () => {
    const host = await box30();
    await store().addScrewBoss({ hostId: host.id, params: M3, point: [0, 30, 0], normal: [0, 1, 0] });
    const second = await store().addScrewBoss({ hostId: host.id, params: M3, point: [4, 30, 0], normal: [0, 1, 0] });
    expect(second!.report.collides).toBe(true);
    const far = await store().addScrewBoss({ hostId: host.id, params: M3, point: [-10, 30, -10], normal: [0, 1, 0] });
    expect(far!.report.collides).toBe(false);
  });
});

describe('torreta: ciclo de vida con su pieza', () => {
  beforeEach(resetMagnetStore);

  it('mover y escalar la pieza lleva la torreta a su cara sin cambiar sus medidas', async () => {
    const host = await box30();
    const placed = (await store().addScrewBoss({ hostId: host.id, params: M3, point: [15, 15, 0], normal: [1, 0, 0] }))!;
    store().setObjectTransform(host.id, { position: [20, 0, 10] }, true);
    let post = byId(placed.post.id);
    // Punto de la cara (ancla) sobre la cara +X de la pieza movida: x = 35.
    const face = new THREE.Vector3(...post.position).addScaledVector(axisOf(post), 0.3);
    expect(face.x).toBeCloseTo(35, 6);
    store().setObjectTransform(host.id, { scale: [2, 1, 1] }, true);
    post = byId(placed.post.id);
    const hole = byId(placed.hole.id);
    expect(post.scale).toEqual([1, 1, 1]);
    expect(hole.scale).toEqual([1, 1, 1]);
    const anchor = (o: SceneObject) => (o.metadata!.addon as { anchorMm: number }).anchorMm;
    const postFace = new THREE.Vector3(...post.position).addScaledVector(axisOf(post), anchor(post));
    const holeFace = new THREE.Vector3(...hole.position).addScaledVector(axisOf(hole), anchor(hole));
    // La pieza 30 mm de ancho escalada ×2 alrededor de su centro: la cara +X queda en x = 20 + 30.
    expect(postFace.x).toBeCloseTo(50, 4);
    expect(holeFace.distanceTo(postFace)).toBeLessThan(1e-6);
  });

  it('duplicar la pieza copia poste y agujero ligados a la copia; borrarla los borra', async () => {
    const host = await box30();
    await store().addScrewBoss({ hostId: host.id, params: M3, point: [0, 30, 0], normal: [0, 1, 0] });
    const copies = store().duplicateObjects([host.id]);
    expect(copies).toHaveLength(3);
    const hostCopy = copies.find((c) => !c.metadata?.addon)!;
    expect(bosses().filter((b) => b.metadata!.addon!.hostId === hostCopy.id)).toHaveLength(2);
    store().deleteObjects([host.id]);
    expect(bosses().filter((b) => b.metadata!.addon!.hostId === host.id)).toHaveLength(0);
    expect(bosses()).toHaveLength(2);
  });

  it('los metadatos viajan en el .kura', async () => {
    const host = await box30();
    const placed = (await store().addScrewBoss({ hostId: host.id, params: M3, point: [0, 30, 0], normal: [0, 1, 0] }))!;
    const s = store();
    const bytes = encodeProject({
      objects: s.objects, groups: s.groups, selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: s.printerProfile,
      customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 1,
    });
    const back = decodeProject(bytes).objects;
    expect(back.find((o) => o.id === placed.post.id)!.metadata?.addon).toEqual(placed.post.metadata?.addon);
    expect(back.find((o) => o.id === placed.hole.id)!.metadata?.addon).toEqual(placed.hole.metadata?.addon);
  });

  it('un .kura con medidas de torreta fuera de rango se rechaza', async () => {
    const host = await box30();
    const placed = (await store().addScrewBoss({ hostId: host.id, params: M3, point: [0, 30, 0], normal: [0, 1, 0] }))!;
    const bad = { ...placed.post, metadata: { addon: { ...placed.post.metadata!.addon!, params: { ...M3, outerDiameterMm: 2 } } } } as SceneObject;
    const s = store();
    expect(() => decodeProject(encodeProject({
      objects: [byId(host.id), bad], groups: [], selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: s.printerProfile,
      customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 1,
    }))).toThrow();
  });
});
