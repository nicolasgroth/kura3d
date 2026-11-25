/**
 * @file src/store/__tests__/mcpNewToolsParity.test.ts
 * @description Paridad Command Bus de la app ↔ MCP sin interfaz de los comandos nuevos, con el motor real y los
 * mismos parámetros: `smooth_mesh` (mismo informe), `orient_for_print` (mismos candidatos y medidas) y
 * `apply_orientation` (misma pose final), `add_magnet_pocket` y `add_screw_boss` (mismo lugar relativo a la pieza,
 * misma pared e informe), y la regla de los agregados: al mover y escalar la pieza el imán y la torreta quedan en la
 * misma pose relativa en los dos caminos. En la app, aplicar las restas con la torreta deja un solo cuerpo cerrado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { isClosedMesh } from '../../engine/meshClosure';
import { useKuraStore } from '../useKuraStore';
import type { KuraCommandRequest, SceneObject, Vec3 } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { bodyCount, byId, resetMagnetStore, store, worldOf } from './magnetTestKit';

type Params = Record<string, unknown>;
interface HeadlessLike {
  createPrimitive(input: Params): Promise<{ id: string }>;
  booleanOperation(input: Params): Promise<{ resultId: string | null }>;
  transformObject(id: string, patch: Params): unknown;
  getObject(id: string): SceneObject;
  smoothMesh(p: Params): any;
  orientForPrint(p: Params): any;
  applyOrientation(p: Params): any;
  addMagnetPocket(p: Params): Promise<any>;
  addScrewBoss(p: Params): Promise<any>;
}
const HEADLESS_PATH = ['..', '..', '..', 'mcp-server', 'src', 'headlessEngine'].join('/');
const newHeadless = async (): Promise<HeadlessLike> => {
  const mod = (await import(/* @vite-ignore */ HEADLESS_PATH)) as { KuraHeadlessEngine: new () => HeadlessLike };
  return new mod.KuraHeadlessEngine();
};

async function bus(command: string, params: Params): Promise<any> {
  const res = (await store().executeCommand({ id: 'p', command: command as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;
  expect(res.ok, `${command}: ${res.error}`).toBe(true);
  return res.result;
}

/** La misma pieza en los dos caminos (ejes del usuario, en el origen). */
async function boxBoth(h: HeadlessLike, size: { width: number; depth: number; height: number }, position?: Vec3) {
  const app = await bus('create_primitive', { type: 'box', ...size, placement: 'origin', ...(position ? { position } : {}) });
  const head = await h.createPrimitive({ primitiveType: 'box', params: size, placement: 'origin', ...(position ? { position } : {}) });
  return { app: app.id as string, head: head.id };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const expectVec = (a: readonly number[], b: readonly number[], digits = 5) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));
const strip = <T extends Record<string, unknown>>(o: T, ...keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

describe('paridad app ↔ sin interfaz de las herramientas nuevas', () => {
  beforeEach(async () => {
    await resetMagnetStore();
    useKuraStore.setState({ language: 'en' });
  });

  it('smooth_mesh da el mismo informe', async () => {
    const h = await newHeadless();
    const app = await bus('create_primitive', { type: 'sphere', radius: 12, placement: 'origin' });
    const head = await h.createPrimitive({ primitiveType: 'sphere', params: { radius: 12 }, placement: 'origin' });
    const params = { strength: 0.8, iterations: 6, preserveSharpEdges: false };
    const a = await bus('smooth_mesh', { objectId: app.id, ...params });
    const b = h.smoothMesh({ objectId: head.id, ...params });
    expect(strip(a, 'id', 'warnings')).toEqual(strip(b, 'id', 'warnings'));
    expect(Math.abs(a.volumeChangePct)).toBeLessThan(2);
    expect(isClosedMesh(byId(app.id).mesh)).toBe(true);
  }, 60_000);

  it('orient_for_print y apply_orientation dan los mismos candidatos y la misma pose', async () => {
    const h = await newHeadless();
    const stem = await boxBoth(h, { width: 10, depth: 10, height: 30 });
    const bar = await boxBoth(h, { width: 50, depth: 10, height: 8 }, [0, 0, 26]);
    const appT = (await bus('boolean_operation', { op: 'union', targetId: stem.app, toolIds: [bar.app] })).resultId as string;
    const headT = (await h.booleanOperation({ targetId: stem.head, toolIds: [bar.head], operation: 'union' })).resultId!;
    const a = await bus('orient_for_print', { objectId: appT, language: 'fr' });
    const b = h.orientForPrint({ objectId: headT, language: 'fr' });
    expect(strip(a, 'id')).toEqual(strip(b, 'id'));
    expect(a.recommendedId).not.toBeNull();
    const ra = await bus('apply_orientation', { objectId: appT, candidateId: a.recommendedId });
    const rb = h.applyOrientation({ objectId: headT, candidateId: b.recommendedId });
    expectVec(ra.position, rb.position);
    expectVec(ra.rotation, rb.rotation);
    expect(ra.followers).toEqual(rb.followers);
    expect(store().past.length).toBeGreaterThan(0);
  }, 120_000);

  it('add_magnet_pocket queda en el mismo lugar con la misma pared', async () => {
    const h = await newHeadless();
    const host = await boxBoth(h, { width: 30, depth: 20, height: 16 });
    const params = { face: 'top', faceOffsetMm: [6, -2], sizeMm: 6, heightMm: 3, hidden: true };
    const a = await bus('add_magnet_pocket', { hostId: host.app, ...params });
    const b = await h.addMagnetPocket({ hostId: host.head, ...params });
    expect(strip(a, 'id', 'hostId', 'placement')).toEqual(strip(b, 'id', 'hostId', 'placement'));
    expectVec(sub(a.placement.point, byId(host.app).position), sub(b.placement.point, h.getObject(host.head).position));
    const ma = byId(a.id), mb = h.getObject(b.id);
    expectVec(sub(ma.position, byId(host.app).position), sub(mb.position, h.getObject(host.head).position));
    expectVec(ma.rotation, mb.rotation);
    expect(ma.groupRef).toBeDefined();
  }, 60_000);

  it('add_screw_boss da el mismo informe y, al aplicar restas en la app, un solo cuerpo cerrado', async () => {
    const h = await newHeadless();
    const host = await boxBoth(h, { width: 40, depth: 40, height: 20 });
    const params = { face: 'top', type: 'insert', nominalMm: 3 };
    const a = await bus('add_screw_boss', { hostId: host.app, ...params });
    const b = await h.addScrewBoss({ hostId: host.head, ...params });
    expect(strip(a, 'post', 'hole', 'hostId', 'placement')).toEqual(strip(b, 'post', 'hole', 'hostId', 'placement'));
    expectVec(sub(byId(a.post.id).position, byId(host.app).position), sub(h.getObject(b.post.id).position, h.getObject(host.head).position));
    store().clearSelection();
    await store().applyHolesOnSolids();
    const merged = byId(host.app);
    expect(bodyCount(worldOf(merged))).toBe(1);
    expect(isClosedMesh(merged.mesh)).toBe(true);
    expect(store().objects.some((o) => o.id === a.post.id)).toBe(false);
  }, 60_000);

  it('al mover y escalar la pieza, imán y torreta quedan en la misma pose relativa en los dos caminos', async () => {
    const h = await newHeadless();
    const host = await boxBoth(h, { width: 40, depth: 30, height: 20 });
    const ma = await bus('add_magnet_pocket', { hostId: host.app, face: 'top', faceOffsetMm: [-10, 0] });
    const mb = await h.addMagnetPocket({ hostId: host.head, face: 'top', faceOffsetMm: [-10, 0] });
    const ba = await bus('add_screw_boss', { hostId: host.app, face: 'top', faceOffsetMm: [10, 0] });
    const bb = await h.addScrewBoss({ hostId: host.head, face: 'top', faceOffsetMm: [10, 0] });
    const move = { position: [12, 5, 0], rotation: [0, 0, 30], scale: [1.5, 1, 2] };
    await bus('transform_object', { id: host.app, ...move });
    h.transformObject(host.head, move);
    for (const [ida, idb] of [[ma.id, mb.id], [ba.post.id, bb.post.id], [ba.hole.id, bb.hole.id]]) {
      const oa = byId(ida), ob = h.getObject(idb);
      expect(oa.scale).toEqual([1, 1, 1]);
      expect(ob.scale).toEqual([1, 1, 1]);
      expectVec(sub(oa.position, byId(host.app).position), sub(ob.position, h.getObject(host.head).position), 4);
      expectVec(oa.rotation, ob.rotation, 5);
    }
  }, 60_000);
});
