/**
 * @file src/store/__tests__/cablePassStore.test.ts
 * @description Paso de cable en el store con el motor real, sobre una placa vertical de 4 mm: un paso de deshacer,
 * negativo agrupado con su pieza; al aplicar las restas, sólido cerrado de un cuerpo, el género sube en 1 por cada
 * paso (agujero pasante real), el volumen quitado es la intersección del negativo con la placa y la sección libre a
 * media pared mide lo pedido (redondo y ranura). También: pared demasiado gruesa (ciego, género igual), cerca de otro
 * agregado, más ancho que la cara (no se coloca), sigue a la pieza, duplicar y borrar, metadatos en el .kura y saneo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { cablePassFrame, type CablePassParams } from '../../core/addons/cablePass';
import { CABLE_PASS_DEFAULTS, CABLE_SLOT_DEFAULTS } from '../../core/addons/cablePassPresets';
import { fromLocal } from '../../core/addons/faceFrame';
import { rayHits } from '../../core/addons/meshRays';
import { isClosedMesh } from '../../engine/meshClosure';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import type { SceneObject, Vec3 } from '../../types/kura';
import { cablePassWarnings } from '../cablePassWarnings';
import { applyAllHoles, docOf, genusOf, intersectionVolume } from './addonMeasureKit';
import { bodyCount, byId, resetMagnetStore, store, worldOf, worldVolume } from './magnetTestKit';

const R5 = CABLE_PASS_DEFAULTS;
const passes = () => store().objects.filter((o) => o.metadata?.addon?.kind === 'cable_pass');
/** Placa vertical 60 × 60 de `t` mm (z de −t/2 a t/2). */
const plate = (t = 4) => store().createPrimitive('box', { width: 60, height: 60, depth: t }, { position: [0, 0, 0] }).then((o) => o!);
const FRONT: Vec3 = [0, 0, 1];
const vertexRadius = (r: number) => r / Math.cos(Math.PI / 64);

/** Sección libre a media pared: distancia del eje al material en ± X local (lado largo) y ± Z local. */
function freeSection(host: SceneObject, point: Vec3, p: CablePassParams, t: number) {
  const f = cablePassFrame(FRONT, p.angleDeg)!;
  const mid = fromLocal(f, point, [0, -t / 2, 0]);
  const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]];
  const world = worldOf(host);
  const hit = (d: Vec3) => rayHits(world, mid, d)[0];
  return { long: Math.min(hit(f.x), hit(neg(f.x))), short: Math.min(hit(f.z), hit(neg(f.z))) };
}

describe('paso de cable: colocar y aplicar con el motor real', () => {
  beforeEach(resetMagnetStore);

  it('un paso de deshacer; negativo agrupado con la placa y largo medido = espesor', async () => {
    const host = await plate();
    const steps = store().past.length;
    const placed = (await store().addCablePass({ hostId: host.id, params: R5, point: [0, 30, 2], normal: FRONT }))!;
    expect(store().past.length).toBe(steps + 1);
    expect(placed.object.role).toBe('negative');
    expect(placed.object.metadata?.addon).toMatchObject({ kind: 'cable_pass', params: R5, anchorMm: 0, hostId: host.id });
    expect(placed.report.boreMm).toBeCloseTo(4, 4);
    expect(cablePassWarnings(placed.report, 'es')).toEqual([]);
    expect(byId(placed.object.id).groupRef).toBe(byId(host.id).groupRef);
    store().undo();
    expect(passes()).toHaveLength(0);
  });

  it('redondo Ø 5 y ranura 8 × 4: cuerpo cerrado, género +1 por paso, sección libre la pedida', async () => {
    const host = await plate();
    expect(genusOf(worldOf(host))).toBe(0);
    const round = (await store().addCablePass({ hostId: host.id, params: R5, point: [-15, 30, 2], normal: FRONT }))!;
    const slot = (await store().addCablePass({ hostId: host.id, params: CABLE_SLOT_DEFAULTS, point: [15, 30, 2], normal: FRONT }))!;
    const removed = (await intersectionVolume(byId(host.id), byId(round.object.id))) + (await intersectionVolume(byId(host.id), byId(slot.object.id)));
    const before = worldVolume(host);
    const after = await applyAllHoles(host.id);
    expect(passes()).toHaveLength(0);
    const world = worldOf(after);
    expect(isClosedMesh(world)).toBe(true);
    expect(after.stats.isManifold).toBe(true);
    expect(bodyCount(world)).toBe(1);
    expect(genusOf(world)).toBe(2);
    expect(Math.abs(before - worldVolume(after) - removed) / removed).toBeLessThan(0.01);
    const r = freeSection(after, [-15, 30, 2], R5, 4);
    for (const d of [r.long, r.short]) {
      expect(d).toBeGreaterThan(2.5 - 0.02);
      expect(d).toBeLessThan(vertexRadius(2.5) + 0.02);
    }
    const s = freeSection(after, [15, 30, 2], CABLE_SLOT_DEFAULTS, 4);
    expect(s.long).toBeGreaterThan(4 - 0.02);
    expect(s.long).toBeLessThan(2 + vertexRadius(2) + 0.02);
    expect(s.short).toBeGreaterThan(2 - 0.02);
    expect(s.short).toBeLessThan(vertexRadius(2) + 0.02);
  });

  it('pared más gruesa que el tope: avisa, usa la profundidad a mano y no atraviesa (género igual)', async () => {
    const block = await plate(50);
    const placed = (await store().addCablePass({ hostId: block.id, params: R5, point: [0, 30, 25], normal: FRONT }))!;
    expect(cablePassWarnings(placed.report, 'es').map((w) => w.kind)).toEqual(['noExit']);
    expect(placed.report.boreMm).toBe(R5.depthMm);
    const after = await applyAllHoles(block.id);
    expect(isClosedMesh(worldOf(after))).toBe(true);
    expect(genusOf(worldOf(after))).toBe(0);
  });

  it('a menos de 1,2 mm de otro paso pendiente: avisa', async () => {
    const host = await plate();
    await store().addCablePass({ hostId: host.id, params: R5, point: [0, 30, 2], normal: FRONT });
    const near = (await store().addCablePass({ hostId: host.id, params: R5, point: [6, 30, 2], normal: FRONT }))!;
    expect(cablePassWarnings(near.report, 'es').map((w) => w.kind)).toContain('addon');
    const far = (await store().addCablePass({ hostId: host.id, params: R5, point: [-20, 30, 2], normal: FRONT }))!;
    expect(far.report.nearAddon).toBe(false);
  });

  it('más ancho que la cara (canto de 4 mm): no se coloca y lo dice', async () => {
    const host = await plate();
    store().dismissAllToasts();
    const count = store().objects.length;
    expect(await store().addCablePass({ hostId: host.id, params: R5, point: [0, 60, 0], normal: [0, 1, 0] })).toBeNull();
    expect(store().objects).toHaveLength(count);
    expect(store().toasts.some((x) => /no cabe/.test(x.text))).toBe(true);
  });
});

describe('paso de cable: ciclo de vida con su pieza', () => {
  beforeEach(resetMagnetStore);

  it('mover la placa lo lleva con ella; duplicar lo copia; borrar lo borra', async () => {
    const host = await plate();
    const placed = (await store().addCablePass({ hostId: host.id, params: R5, point: [0, 30, 2], normal: FRONT }))!;
    store().setObjectTransform(host.id, { position: [10, 0, 5] }, true);
    const moved = byId(placed.object.id);
    expect(moved.position[0]).toBeCloseTo(10, 6);
    expect(moved.position[2]).toBeCloseTo(7, 6);
    expect(moved.scale).toEqual([1, 1, 1]);
    const copies = store().duplicateObjects([host.id]);
    expect(copies).toHaveLength(2);
    const hostCopy = copies.find((c) => !c.metadata?.addon)!;
    expect(passes().filter((o) => o.metadata!.addon!.hostId === hostCopy.id)).toHaveLength(1);
    store().deleteObjects([host.id]);
    expect(passes()).toHaveLength(1);
  });

  it('los metadatos viajan en el .kura; medidas fuera de rango se rechazan', async () => {
    const host = await plate();
    const placed = (await store().addCablePass({ hostId: host.id, params: CABLE_SLOT_DEFAULTS, point: [0, 30, 2], normal: FRONT }))!;
    const back = decodeProject(encodeProject(docOf())).objects;
    expect(back.find((o) => o.id === placed.object.id)!.metadata?.addon).toEqual(placed.object.metadata?.addon);
    const bad = { ...placed.object, metadata: { addon: { ...placed.object.metadata!.addon!, params: { ...CABLE_SLOT_DEFAULTS, lengthMm: 2 } } } } as SceneObject;
    expect(() => decodeProject(encodeProject(docOf([byId(host.id), bad])))).toThrow();
  });
});
