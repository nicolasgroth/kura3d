/**
 * @file src/store/__tests__/simplifyModesBus.test.ts
 * @description `simplify_mesh` por el Command Bus con los modos nuevos: «Sin pérdida» aplica un paso de deshacer y
 * devuelve el informe; «Por cantidad» se acerca al objetivo; sin reducción devuelve `applied: false` sin tocar la
 * escena; parámetros inconsistentes se rechazan con `invalid-params`; el valor por defecto es 0,01 mm.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { parseSimplifyRequest } from '../../core/bus/simplifySchema';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { byId, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand(
    { id: `s_${command}`, command: command as KuraCommandRequest['command'], params },
    'mcp',
  ) as Promise<CommandBusResponse>;

type Report = { applied: boolean; mode: string; trianglesBefore: number; trianglesAfter: number; genusBefore: number;
  genusAfter: number; volumeChangePct: number; checks: string[]; rejectedBy: string[]; target?: { triangles: number; reached: boolean } };

describe('simplify_mesh con modos', () => {
  beforeEach(() => resetStore());

  it('sin modo ni tolerancia usa «Por tolerancia» a 0,01 mm', () => {
    expect(OPERATION_DEFAULTS.simplify.toleranceMm).toBe(0.01);
    expect(parseSimplifyRequest({})).toEqual({ mode: 'tolerance', toleranceMm: 0.01 });
    expect(parseSimplifyRequest({ targetPercent: 40 })).toEqual({ mode: 'target', targetPercent: 40 });
  });

  it('«Por cantidad» sin objetivo o con dos objetivos: invalid-params', async () => {
    const s = await store().createPrimitive('sphere', { radius: 10, segments: 32 });
    for (const params of [{ mode: 'target' }, { targetTriangles: 100, targetPercent: 20 }, { mode: 'otro' }]) {
      const res = await run('simplify_mesh', { id: s!.id, ...params });
      expect(res.ok).toBe(false);
      expect(res.errorCode).toBe('invalid-params');
    }
  });

  it('parámetros que no corresponden al modo: invalid-params (no se ignoran en silencio)', () => {
    for (const params of [
      { mode: 'lossless', toleranceMm: 0.5 },
      { mode: 'lossless', targetPercent: 30 },
      { mode: 'tolerance', targetTriangles: 100 },
      { mode: 'tolerance', targetPercent: 30 },
      { mode: 'target', targetPercent: 30, toleranceMm: 0.5 },
      { targetTriangles: 100, toleranceMm: 0.5 },
    ]) {
      expect(() => parseSimplifyRequest(params), JSON.stringify(params)).toThrow(expect.objectContaining({ code: 'invalid-params' }));
    }
    expect(parseSimplifyRequest({ mode: 'tolerance', toleranceMm: 0.5 })).toEqual({ mode: 'tolerance', toleranceMm: 0.5 });
  });

  it('«Sin pérdida» sobre un cubo sobre-teselado: un paso de deshacer e informe', async () => {
    const box = await store().createPrimitive('box', { width: 20, height: 20, depth: 20 });
    expect(await store().refineSelectedMesh(box!.id, 2)).toBe(true);
    const dense = byId(box!.id)!;
    const res = await run('simplify_mesh', { id: box!.id, mode: 'lossless' });
    expect(res.ok).toBe(true);
    const r = res.result as Report;
    expect(r.mode).toBe('lossless');
    expect(r.applied).toBe(true);
    expect(r.trianglesBefore).toBe(dense.stats.triangles);
    expect(r.trianglesAfter).toBeLessThan(dense.stats.triangles / 4);
    expect(r.genusAfter).toBe(r.genusBefore);
    expect(r.rejectedBy).toEqual([]);
    expect(byId(box!.id)!.stats.triangles).toBe(r.trianglesAfter);
    expect(byId(box!.id)!.stats.isManifold).toBe(true);
    store().undo();
    expect(byId(box!.id)!.mesh).toBe(dense.mesh);
  });

  it('«Por cantidad» al 30 %: queda en el objetivo o apenas debajo', async () => {
    const s = await store().createPrimitive('sphere', { radius: 10, segments: 64 });
    const before = byId(s!.id)!.stats.triangles;
    const res = await run('simplify_mesh', { id: s!.id, targetPercent: 30 });
    expect(res.ok).toBe(true);
    const r = res.result as Report;
    expect(r.applied).toBe(true);
    expect(r.target!.triangles).toBe(Math.round(before * 0.3));
    expect(r.trianglesAfter).toBeLessThanOrEqual(r.target!.triangles);
    expect(r.trianglesAfter).toBeGreaterThan(r.target!.triangles * 0.8);
  });

  it('sin reducción: applied false, informe y la escena intacta', async () => {
    const cyl = await store().createPrimitive('cylinder', { radius: 10, height: 20, segments: 64 });
    const mesh = byId(cyl!.id)!.mesh;
    const res = await run('simplify_mesh', { id: cyl!.id, mode: 'lossless' });
    expect(res.ok).toBe(true);
    const r = res.result as Report;
    expect(r.applied).toBe(false);
    expect(r.checks).toContain('no_reduction');
    expect(byId(cyl!.id)!.mesh).toBe(mesh);
  });
});
