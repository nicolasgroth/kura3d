/**
 * @file src/store/__tests__/mcpModesParity.test.ts
 * @description Paridad Command Bus de la app ↔ MCP sin interfaz por modos, con el motor real y los mismos
 * parámetros: `smooth_mesh` con aristas vivas protegidas, `orient_for_print` con cama y en una pieza sin base estable
 * (mismo `baseStatus` y aviso), `simplify_mesh` en «Sin pérdida», «Por tolerancia» y «Por cantidad» (mismo informe y
 * mismos avisos visibles, incluido `SIMPLIFY_GENUS_CHANGED`) y la torreta por cara sobre una esfera (misma normal de
 * superficie).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useKuraStore } from '../useKuraStore';
import type { KuraCommandRequest, SceneObject } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { resetMagnetStore, store } from './magnetTestKit';

type Params = Record<string, unknown>;
interface HeadlessLike {
  createPrimitive(input: Params): Promise<{ id: string }>;
  getObject(id: string): SceneObject;
  smoothMesh(p: Params): any;
  orientForPrint(p: Params): any;
  simplifyMeshParams(p: Params): Promise<any>;
  addScrewBoss(p: Params): Promise<any>;
}
const HEADLESS_PATH = ['..', '..', '..', 'mcp-server', 'src', 'headlessEngine'].join('/');
const newHeadless = async (): Promise<HeadlessLike> => {
  const mod = (await import(/* @vite-ignore */ HEADLESS_PATH)) as { KuraHeadlessEngine: new () => HeadlessLike };
  return new mod.KuraHeadlessEngine();
};

async function busRaw(command: string, params: Params): Promise<CommandBusResponse> {
  const res = (await store().executeCommand({ id: 'p', command: command as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;
  expect(res.ok, `${command}: ${res.error}`).toBe(true);
  return res;
}
const bus = async (command: string, params: Params): Promise<any> => (await busRaw(command, params)).result;

const strip = <T extends Record<string, unknown>>(o: T, ...keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const codes = (w: ReadonlyArray<{ code: string }> | undefined) => (w ?? []).map((x) => x.code);

/** La misma primitiva en los dos caminos, en el origen. */
async function both(h: HeadlessLike, type: string, params: Params) {
  const app = await bus('create_primitive', { type, ...params, placement: 'origin' });
  const head = await h.createPrimitive({ primitiveType: type, params, placement: 'origin' });
  return { app: app.id as string, head: head.id };
}

describe('paridad app ↔ sin interfaz por modos', () => {
  beforeEach(async () => {
    await resetMagnetStore();
    useKuraStore.setState({ language: 'en' });
  });

  it('smooth_mesh con aristas vivas protegidas da el mismo informe', async () => {
    const h = await newHeadless();
    const ids = await both(h, 'cylinder', { radius: 10, height: 20 });
    const params = { strength: 0.6, iterations: 4, preserveSharpEdges: true, sharpAngleDeg: 40 };
    const a = await bus('smooth_mesh', { objectId: ids.app, ...params });
    const b = h.smoothMesh({ objectId: ids.head, ...params });
    expect(strip(a, 'id', 'warnings')).toEqual(strip(b, 'id', 'warnings'));
  }, 60_000);

  it('orient_for_print con cama y en una esfera sin base estable: mismos candidatos, estado y aviso', async () => {
    const h = await newHeadless();
    const box = await both(h, 'box', { width: 60, depth: 10, height: 20 });
    const bed = { bedWidthMm: 50, bedDepthMm: 50, bedHeightMm: 80 };
    const a = await bus('orient_for_print', { objectId: box.app, overhangAngleDeg: 50, ...bed, language: 'de' });
    const b = h.orientForPrint({ objectId: box.head, overhangAngleDeg: 50, ...bed, language: 'de' });
    expect(strip(a, 'id')).toEqual(strip(b, 'id'));
    expect(a.baseStatus).toBe('ok');

    const ball = await both(h, 'sphere', { radius: 15 });
    const sa = await bus('orient_for_print', { objectId: ball.app, language: 'es' });
    const sb = h.orientForPrint({ objectId: ball.head, language: 'es' });
    expect(strip(sa, 'id')).toEqual(strip(sb, 'id'));
    expect(sa.baseStatus).toBe('noStableBase');
    expect(sa.currentIsBest).toBe(false);
    expect(sa.warnings.map((w: { key: string }) => w.key)).toEqual(['noStableBase']);
  }, 120_000);

  for (const [mode, params] of [
    ['lossless', { mode: 'lossless' }],
    ['tolerance', { mode: 'tolerance', toleranceMm: 0.5 }],
    ['target', { mode: 'target', targetPercent: 30 }],
  ] as const) {
    it(`simplify_mesh «${mode}»: mismo informe y mismos avisos visibles`, async () => {
      const h = await newHeadless();
      const ids = await both(h, 'torus', { outerRadius: 14, tubeRadius: 4, segments: 48 });
      const a = await busRaw('simplify_mesh', { id: ids.app, ...params });
      const b = await h.simplifyMeshParams({ objectId: ids.head, ...params });
      expect(strip(a.result as Params, 'id')).toEqual(strip(b, 'id', 'object', 'warnings'));
      expect(codes(a.warnings)).toEqual(codes(b.warnings));
    }, 60_000);
  }

  it('simplify_mesh que cierra el agujero: SIMPLIFY_GENUS_CHANGED en los dos caminos', async () => {
    const h = await newHeadless();
    const ids = await both(h, 'torus', { outerRadius: 6, tubeRadius: 4, segments: 24 });
    const params = { mode: 'tolerance', toleranceMm: 6 };
    const a = await busRaw('simplify_mesh', { id: ids.app, ...params });
    const b = await h.simplifyMeshParams({ objectId: ids.head, ...params });
    const r = a.result as { applied: boolean; genusBefore: number; genusAfter: number };
    expect(strip(a.result as Params, 'id')).toEqual(strip(b, 'id', 'object', 'warnings'));
    expect(codes(a.warnings)).toEqual(codes(b.warnings));
    if (r.applied && r.genusAfter !== r.genusBefore) {
      expect(codes(a.warnings)).toContain('SIMPLIFY_GENUS_CHANGED');
      expect(r.genusAfter).toBeGreaterThanOrEqual(0);
    }
  }, 60_000);

  it('add_screw_boss por cara sobre una esfera: misma normal de superficie (vertical en la cima)', async () => {
    const h = await newHeadless();
    const ids = await both(h, 'sphere', { radius: 20 });
    const params = { face: 'top', type: 'screw', nominalMm: 3 };
    const a = await bus('add_screw_boss', { hostId: ids.app, ...params });
    const b = await h.addScrewBoss({ hostId: ids.head, ...params });
    expect(a.placement.normal).toEqual(b.placement.normal);
    expect(a.placement.normal[2]).toBeGreaterThan(Math.cos((0.5 * Math.PI) / 180));
  }, 60_000);
});
