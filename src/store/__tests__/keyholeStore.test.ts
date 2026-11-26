/**
 * @file src/store/__tests__/keyholeStore.test.ts
 * @description Ojo de cerradura en el store con el motor real, sobre una placa vertical de 10 mm: un paso de
 * deshacer, negativo agrupado con su pieza; al aplicar las restas, un solo cuerpo cerrado con el volumen quitado
 * igual a la intersección del negativo con la placa; un cilindro del diámetro de la cabeza entra por la entrada y se
 * desliza por la cámara hasta el final de la ranura sin chocar, y NO pasa por la ranura del cuello. También: avisos
 * (pared detrás, cara no vertical, misma altura), no coloca si es más ancho que la cara, sigue a la pieza conservando
 * medidas, duplicar y borrar con ella, metadatos en el .kura y saneo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { keyholeDepthMm, placeKeyhole, type KeyholeParams } from '../../core/addons/keyhole';
import { KEYHOLE_DEFAULTS } from '../../core/addons/keyholePresets';
import { isClosedMesh } from '../../engine/meshClosure';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import type { SceneObject, Vec3 } from '../../types/kura';
import { keyholeWarnings } from '../keyholeWarnings';
import { applyAllHoles, docOf, intersectionVolume, probeCylinder } from './addonMeasureKit';
import { bodyCount, byId, resetMagnetStore, store, worldOf, worldVolume } from './magnetTestKit';

const P = KEYHOLE_DEFAULTS;
const keyholes = () => store().objects.filter((o) => o.metadata?.addon?.kind === 'keyhole');
/** Placa vertical 60 × 60 de `t` mm (z de −t/2 a t/2): la cara posterior (+Z) mira al muro. */
const plate = (t = 10) => store().createPrimitive('box', { width: 60, height: 60, depth: t }, { position: [0, 0, 0] }).then((o) => o!);
const BACK: Vec3 = [0, 0, 1];

describe('ojo de cerradura: colocar y aplicar con el motor real', () => {
  beforeEach(resetMagnetStore);

  it('un paso de deshacer; negativo agrupado con la placa', async () => {
    const host = await plate();
    const steps = store().past.length;
    const placed = (await store().addKeyhole({ hostId: host.id, params: P, point: [0, 30, 5], normal: BACK }))!;
    expect(store().past.length).toBe(steps + 1);
    expect(placed.object.role).toBe('negative');
    expect(placed.object.metadata?.addon).toEqual({ kind: 'keyhole', params: P, anchorMm: 0, hostId: host.id });
    expect(byId(placed.object.id).groupRef).toBe(byId(host.id).groupRef);
    expect(keyholeWarnings(placed.report, 'es')).toEqual([]);
    expect(placed.report.wallBehindMm).toBeCloseTo(10 - keyholeDepthMm(P), 3);
    store().undo();
    expect(keyholes()).toHaveLength(0);
  });

  it('resultado: un cuerpo cerrado; la cabeza entra, se desliza hasta el fondo de la ranura y no pasa por el cuello', async () => {
    const host = await plate();
    const point: Vec3 = [0, 30, 5];
    const placed = (await store().addKeyhole({ hostId: host.id, params: P, point, normal: BACK }))!;
    const removed = await intersectionVolume(byId(host.id), byId(placed.object.id));
    const before = worldVolume(host);
    const after = await applyAllHoles(host.id);
    expect(keyholes()).toHaveLength(0);
    const world = worldOf(after);
    expect(isClosedMesh(world)).toBe(true);
    expect(after.stats.isManifold).toBe(true);
    expect(bodyCount(world)).toBe(1);
    expect(Math.abs(before - worldVolume(after) - removed) / removed).toBeLessThan(0.01);
    // Volumen quitado ≈ entrada + cuello + cámara (cota inferior: la cámara sola).
    expect(removed).toBeGreaterThan(P.headDiameterMm * P.slotLengthMm * P.chamberDepthMm);

    const frame = placeKeyhole(P, point, BACK)!.frame;
    const depth = keyholeDepthMm(P);
    const head = P.headDiameterMm / 2 - 0.05;
    // Entra por la entrada desde afuera hasta el fondo de la cámara.
    expect(await intersectionVolume(after, probeCylinder(frame, point, 0, -depth + 0.05, 2, head))).toBeLessThan(1e-3);
    // Se desliza por la cámara hasta el final de la ranura (donde cuelga).
    for (const x of [P.slotLengthMm / 4, P.slotLengthMm / 2, P.slotLengthMm]) {
      expect(await intersectionVolume(after, probeCylinder(frame, point, x, -depth + 0.05, -P.lipMm - 0.05, head))).toBeLessThan(1e-3);
    }
    // El cuello: la caña pasa; la cabeza no pasa por la ranura (choca con el labio).
    expect(await intersectionVolume(after, probeCylinder(frame, point, P.slotLengthMm, -P.lipMm + 0.05, 1, P.neckWidthMm / 2 - 0.05))).toBeLessThan(1e-3);
    const blocked = await intersectionVolume(after, probeCylinder(frame, point, P.slotLengthMm, -P.lipMm + 0.05, -0.05, P.headDiameterMm / 2));
    expect(blocked).toBeGreaterThan(20);
  });

  it('placa de 5 mm: la pared detrás de la cámara queda bajo 1,2 mm y se avisa', async () => {
    const host = await plate(5.5);
    const placed = (await store().addKeyhole({ hostId: host.id, params: P, point: [0, 30, 2.75], normal: BACK }))!;
    expect(placed.report.wallBehindMm).toBeCloseTo(1, 3);
    expect(keyholeWarnings(placed.report, 'es').map((w) => w.kind)).toEqual(['wall']);
  });

  it('cara superior (horizontal): aviso suave de que normalmente va en la cara que mira al muro', async () => {
    const host = (await store().createPrimitive('box', { width: 40, height: 20, depth: 40 }, { position: [0, 0, 0] }))!;
    const placed = (await store().addKeyhole({ hostId: host.id, params: P, point: [0, 20, 0], normal: [0, 1, 0] }))!;
    expect(keyholeWarnings(placed.report, 'es').map((w) => w.kind)).toContain('face');
  });

  it('dos ojos en la misma cara: avisa si no están a la misma altura (> 0,2 mm)', async () => {
    const host = await plate();
    await store().addKeyhole({ hostId: host.id, params: P, point: [-18, 30, 5], normal: BACK });
    const level = (await store().addKeyhole({ hostId: host.id, params: P, point: [18, 30.1, 5], normal: BACK }))!;
    expect(level.report.levelOffsetMm).toBeCloseTo(0.1, 4);
    expect(keyholeWarnings(level.report, 'es').map((w) => w.kind)).not.toContain('level');
    const crooked = (await store().addKeyhole({ hostId: host.id, params: P, point: [0, 34, 5], normal: BACK }))!;
    expect(keyholeWarnings(crooked.report, 'es').map((w) => w.kind)).toContain('level');
  });

  it('más ancho que la cara: no se coloca y lo dice', async () => {
    const narrow = (await store().createPrimitive('box', { width: 7, height: 60, depth: 10 }, { position: [0, 0, 0] }))!;
    store().dismissAllToasts();
    const count = store().objects.length;
    expect(await store().addKeyhole({ hostId: narrow.id, params: P, point: [0, 30, 5], normal: BACK })).toBeNull();
    expect(store().objects).toHaveLength(count);
    expect(store().toasts.some((x) => /no cabe/.test(x.text))).toBe(true);
  });
});

describe('ojo de cerradura: ciclo de vida con su pieza', () => {
  beforeEach(resetMagnetStore);

  it('mover y escalar la placa lo lleva a su cara sin cambiar sus medidas ni el sentido de la ranura', async () => {
    const host = await plate();
    const placed = (await store().addKeyhole({ hostId: host.id, params: P, point: [0, 30, 5], normal: BACK }))!;
    store().setObjectTransform(host.id, { position: [20, 0, 10] }, true);
    let k = byId(placed.object.id);
    expect(k.position[2]).toBeCloseTo(15, 6);
    expect(k.position[0]).toBeCloseTo(20, 6);
    store().setObjectTransform(host.id, { scale: [1, 1, 2] }, true);
    k = byId(placed.object.id);
    expect(k.scale).toEqual([1, 1, 1]);
    expect(k.position[2]).toBeCloseTo(20, 4);
    expect(k.rotation).toEqual(expect.arrayContaining([expect.any(Number)]));
    const frame = placeKeyhole(P, k.position, BACK)!;
    frame.rotation.forEach((v, i) => expect(v).toBeCloseTo(k.rotation[i], 6));
  });

  it('duplicar la placa copia el ojo ligado a la copia; borrarla lo borra', async () => {
    const host = await plate();
    await store().addKeyhole({ hostId: host.id, params: P, point: [0, 30, 5], normal: BACK });
    const copies = store().duplicateObjects([host.id]);
    expect(copies).toHaveLength(2);
    const hostCopy = copies.find((c) => !c.metadata?.addon)!;
    expect(keyholes().filter((o) => o.metadata!.addon!.hostId === hostCopy.id)).toHaveLength(1);
    store().deleteObjects([host.id]);
    expect(keyholes().filter((o) => o.metadata!.addon!.hostId === host.id)).toHaveLength(0);
    expect(keyholes()).toHaveLength(1);
  });

  it('los metadatos viajan en el .kura; medidas fuera de rango se rechazan', async () => {
    const host = await plate();
    const placed = (await store().addKeyhole({ hostId: host.id, params: P, point: [0, 30, 5], normal: BACK }))!;
    const back = decodeProject(encodeProject(docOf())).objects;
    expect(back.find((o) => o.id === placed.object.id)!.metadata?.addon).toEqual(placed.object.metadata?.addon);
    const badParams: KeyholeParams = { ...P, neckWidthMm: 9 };
    const bad = { ...placed.object, metadata: { addon: { ...placed.object.metadata!.addon!, params: badParams } } } as SceneObject;
    expect(() => decodeProject(encodeProject(docOf([byId(host.id), bad])))).toThrow();
  });
});
