/**
 * @file src/store/__tests__/simplifyDestructiveBus.test.ts
 * @description `simplify_mesh` por el Command Bus con un resultado destructivo (toro al 2 %, motor real): no se
 * aplica ni deja paso de historial, devuelve `destructive` y `safe`; la versión segura y `allowDestructive` aplican
 * cada una en un solo paso de deshacer. «Repetir» no hereda `allowDestructive`.
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

type Result = { applied: boolean; trianglesAfter: number; destructive: string[]; forced?: boolean; safe?: { triangles: number; toleranceMm: number } | null };

describe('simplify_mesh destructivo', () => {
  beforeEach(() => resetStore());

  it('allowDestructive se lee como booleano estricto y no vale en «Sin pérdida»', () => {
    expect(parseSimplifyRequest({ targetPercent: 2, allowDestructive: true })).toEqual({ mode: 'target', targetPercent: 2, allowDestructive: true });
    expect(parseSimplifyRequest({ toleranceMm: 1, allowDestructive: false })).toEqual({ mode: 'tolerance', toleranceMm: 1 });
    expect(() => parseSimplifyRequest({ mode: 'lossless', allowDestructive: true })).toThrow(expect.objectContaining({ code: 'invalid-params' }));
    expect(() => parseSimplifyRequest({ toleranceMm: 1, allowDestructive: 'yes' })).toThrow(expect.objectContaining({ code: 'invalid-params' }));
  });

  it('toro al 2 %: no se aplica; la segura y la forzada aplican en un paso de deshacer cada una', async () => {
    const torus = await store().createPrimitive('torus', { outerRadius: 14, tubeRadius: 4, segments: 48 });
    const id = torus!.id;
    const mesh = byId(id)!.mesh;
    const past = store().past.length;
    const blocked = await run('simplify_mesh', { id, targetPercent: 2 });
    expect(blocked.ok).toBe(true);
    const r = blocked.result as Result;
    expect(r.applied).toBe(false);
    expect(r.destructive.length).toBeGreaterThan(0);
    expect(r.safe?.triangles).toBeGreaterThan(r.trianglesAfter);
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
