/**
 * @file src/store/__tests__/simplifyDestructiveBus.test.ts
 * @description `simplify_mesh` por el Command Bus con un resultado destructivo (toro al 2 %, motor real): no se
 * aplica con `onDestructive: 'block'` (devuelve `destructive` y `safe`); por defecto aplica la versión segura en un
 * paso y dice `appliedVariant: 'safe'` con lo pedido en `requested`; la segura y `allowDestructive` aplican cada una
 * en un solo paso de deshacer. `dryRun` devuelve el mismo informe sin tocar escena ni historial, y aplicar después
 * reutiliza el cálculo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { parseSimplifyRequest } from '../../core/bus/simplifySchema';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { byId, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand(
    { id: `s_${command}`, command: command as KuraCommandRequest['command'], params },
    'mcp',
  ) as Promise<CommandBusResponse>;

type Result = {
  applied: boolean; appliedVariant: string; trianglesAfter: number; destructive: string[]; forced?: boolean; dryRun?: boolean;
  safe?: { triangles: number; toleranceMm: number } | null; requested?: { triangles: number };
};

describe('simplify_mesh destructivo', () => {
  beforeEach(() => resetStore());

  it('allowDestructive se lee como booleano estricto y no vale en «Sin pérdida»', () => {
    expect(parseSimplifyRequest({ targetPercent: 2, allowDestructive: true })).toEqual({ mode: 'target', targetPercent: 2, allowDestructive: true });
    expect(parseSimplifyRequest({ toleranceMm: 1, allowDestructive: false })).toEqual({ mode: 'tolerance', toleranceMm: 1 });
    expect(() => parseSimplifyRequest({ mode: 'lossless', allowDestructive: true })).toThrow(expect.objectContaining({ code: 'invalid-params' }));
    expect(() => parseSimplifyRequest({ toleranceMm: 1, allowDestructive: 'yes' })).toThrow(expect.objectContaining({ code: 'invalid-params' }));
  });

  it('onDestructive: enum estricto, no en «Sin pérdida» y sin contradecir a allowDestructive', () => {
    expect(parseSimplifyRequest({ targetPercent: 2, onDestructive: 'block' })).toEqual({ mode: 'target', targetPercent: 2, onDestructive: 'block' });
    expect(() => parseSimplifyRequest({ targetPercent: 2, onDestructive: 'maybe' })).toThrow(expect.objectContaining({ code: 'invalid-params' }));
    expect(() => parseSimplifyRequest({ mode: 'lossless', onDestructive: 'force' })).toThrow(expect.objectContaining({ code: 'invalid-params' }));
    expect(() => parseSimplifyRequest({ targetPercent: 2, allowDestructive: true, onDestructive: 'block' })).toThrow(expect.objectContaining({ code: 'invalid-params' }));
  });

  it('por defecto aplica la versión segura en un paso; dryRun no toca nada y aplicar reutiliza su cálculo', async () => {
    const torus = await store().createPrimitive('torus', { outerRadius: 14, tubeRadius: 4, segments: 48 });
    const id = torus!.id;
    const mesh = byId(id)!.mesh;
    const byTris0 = byId(id)!.stats.triangles;
    const past = store().past.length;
    const dry = await run('simplify_mesh', { id, targetPercent: 2, dryRun: true });
    const d = dry.result as Result;
    expect(d.dryRun).toBe(true);
    expect(d.appliedVariant).toBe('safe');
    expect(byId(id)!.mesh).toBe(mesh);
    expect(store().past.length).toBe(past);

    const applied = await run('simplify_mesh', { id, targetPercent: 2 });
    const r = applied.result as Result;
    expect(r.applied).toBe(true);
    expect(r.appliedVariant).toBe('safe');
    expect(r.trianglesAfter).toBe(d.trianglesAfter);
    // Lo pedido (destructivo: −53 % de volumen) queda guardado aparte; Manifold no es monótono y la segura puede
    // incluso tener menos triángulos que lo pedido (278 contra 372 en este toro).
    expect(r.requested!.triangles).not.toBe(r.trianglesAfter);
    expect(r.trianglesAfter).toBeLessThan(byTris0 * 0.9);
    expect(byId(id)!.stats.triangles).toBe(r.safe!.triangles);
    expect(store().past.length).toBe(past + 1);
    store().undo();
    expect(byId(id)!.mesh).toBe(mesh);
  });

  it('toro al 2 %: no se aplica; la segura y la forzada aplican en un paso de deshacer cada una', async () => {
    const torus = await store().createPrimitive('torus', { outerRadius: 14, tubeRadius: 4, segments: 48 });
    const id = torus!.id;
    const mesh = byId(id)!.mesh;
    const byTris0 = byId(id)!.stats.triangles;
    const past = store().past.length;
    const blocked = await run('simplify_mesh', { id, targetPercent: 2, onDestructive: 'block' });
    expect(blocked.ok).toBe(true);
    const r = blocked.result as Result;
    expect(r.applied).toBe(false);
    expect(r.destructive.length).toBeGreaterThan(0);
    expect(r.safe?.triangles).toBeLessThan(byTris0 * 0.9);
    expect(byId(id)!.mesh).toBe(mesh);
    expect(store().past.length).toBe(past);

    const safe = await run('simplify_mesh', { id, mode: 'tolerance', toleranceMm: r.safe!.toleranceMm });
    expect((safe.result as Result).applied).toBe(true);
    expect(byId(id)!.stats.triangles).toBe(r.safe!.triangles);
    expect(store().past.length).toBe(past + 1);
    store().undo();
    expect(byId(id)!.mesh).toBe(mesh);

    const forced = await run('simplify_mesh', { id, targetPercent: 2, allowDestructive: true });
    expect(forced.result as Result).toMatchObject({ applied: true, forced: true });
    expect(store().past.length).toBe(past + 1);
    store().undo();
    expect(byId(id)!.mesh).toBe(mesh);
  });
});
