/**
 * @file src/__tests__/freePlacementScene.e2e.test.ts
 * @description Escena con varias piezas: importar, molde, corte por plano y primitivas del chat
 * no dejan piezas encimadas (huellas XZ sin solapar).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withFreePlacement } from '../ai/aiClient';
import { footprintOf } from '../core/scene/freeSpot';
import { cubeMeshXml, modelXml, pack3mf, translate } from '../engine/__tests__/ioFixtures';
import { useKuraStore } from '../store/useKuraStore';
import type { SceneObject } from '../types/kura';

const s = () => useKuraStore.getState();
const fp = (o: SceneObject) => footprintOf(o.mesh, o.position, o.rotation, o.scale)!;
const overlap = (a: SceneObject, b: SceneObject) => {
  const fa = fp(a);
  const fb = fp(b);
  const e = 1e-6;
  return fa.minX < fb.maxX - e && fa.maxX > fb.minX + e && fa.minZ < fb.maxZ - e && fa.maxZ > fb.minZ + e;
};
const assertNoOverlaps = () => {
  const objs = s().objects;
  for (let i = 0; i < objs.length; i += 1) {
    for (let j = i + 1; j < objs.length; j += 1) {
      expect(overlap(objs[i], objs[j]), `${objs[i].name} / ${objs[j].name}`).toBe(false);
    }
  }
};
const cut = { connectorType: 'none', connectorSize: 4, connectorDepth: 6, connectorCount: 0, tolerance: 0.25, keepMode: 'both', offset: 0 } as const;

async function sceneOfThree() {
  await s().createPrimitive('box', { width: 40, height: 20, depth: 40 }, { placement: 'free' });
  await s().createPrimitive('cylinder', { radius: 10, height: 20 }, { placement: 'free' });
  return s().createPrimitive('box', { width: 10, height: 10, depth: 10 }, { placement: 'free' });
}

describe('colocación en espacio libre en una escena con piezas', () => {
  beforeEach(() => {
    useKuraStore.setState({ objects: [], selectedIds: [], past: [], future: [] });
  });

  it('importar un 3MF de varias piezas en una escena no ocupada pisa nada', async () => {
    await sceneOfThree();
    const data = pack3mf({
      '3D/3dmodel.model': modelXml(
        `<object id="1" name="A">${cubeMeshXml(20)}</object><object id="2" name="B">${cubeMeshXml(10)}</object>`,
        `<item objectid="1" transform="${translate(0, 0, 0)}"/><item objectid="2" transform="${translate(40, 0, 0)}"/>`,
      ),
    });
    const ok = await s().importModelFiles([{ name: 'inst.3mf', read: async () => data }], { placement: 'bed' });
    expect(ok).toBe(true);
    assertNoOverlaps();
  });

  it('el molde no queda sobre otras piezas ni sus partes unas sobre otras', async () => {
    const small = await sceneOfThree();
    await s().generateMoldForObject(small!.id, {
      mode: 'silicone_master', wallMarginMm: 6, boxWallMm: 3, splitAxis: 'x', pourSpout: true,
      pourSpoutRadiusMm: 5, keyToleranceMm: 0.25, cavityWallMm: 3,
    } as never);
    expect(s().objects.length).toBeGreaterThan(3);
    assertNoOverlaps();
  });

  it('cortar por X separa las mitades unos milímetros; por Y apoya la superior junto a la otra', async () => {
    const big = (await s().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { placement: 'free' }))!;
    const halves = await s().planeCutObject(big.id, { ...cut, axis: 'x' } as never);
    expect(halves).toHaveLength(2);
    const [a, b] = halves.map(fp);
    expect(Math.max(a.minX - b.maxX, b.minX - a.maxX)).toBeGreaterThanOrEqual(3.9);

    useKuraStore.setState({ objects: [], selectedIds: [] });
    const tall = (await s().createPrimitive('box', { width: 20, height: 40, depth: 20 }, { placement: 'free' }))!;
    const parts = await s().planeCutObject(tall.id, { ...cut, axis: 'y' } as never);
    expect(parts).toHaveLength(2);
    assertNoOverlaps();
    for (const p of s().objects) {
      const minY = Math.min(...Array.from(p.mesh.positions).filter((_, i) => i % 3 === 1)) + p.position[1];
      expect(minY).toBeCloseTo(0, 4);
    }
  });

  it('el chat crea primitivas en el primer hueco libre si no indica posición', async () => {
    const exec = vi.fn(async () => ({ id: '1', ok: true }));
    const wrapped = withFreePlacement(exec);
    await wrapped({ id: '1', command: 'create_primitive', params: { type: 'box' } });
    await wrapped({ id: '2', command: 'create_primitive', params: { type: 'box', position: [1, 0, 1] } });
    await wrapped({ id: '3', command: 'create_primitive', params: { type: 'box', placement: 'origin' } });
    expect(exec.mock.calls.map((c) => (c as unknown as [{ params: { placement?: string } }])[0].params.placement))
      .toEqual(['free', undefined, 'origin']);
  });
});
