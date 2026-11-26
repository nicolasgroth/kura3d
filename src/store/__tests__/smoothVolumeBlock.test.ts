/**
 * @file src/store/__tests__/smoothVolumeBlock.test.ts
 * @description Suavizar en una malla muy gruesa (esfera de pocos triángulos escalada ×2, motor real): el cambio de
 * volumen supera el tope y no se aplica en silencio (`applied: false`, `blockedBy: volume_changed`, sin paso de
 * historial, el panel lo dice); con `allowVolumeChange` se aplica en un solo paso de deshacer. Igual sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SMOOTH_BLOCK_VOLUME_PCT } from '../../core/operations/smoothOperations';
import type { KuraCommandRequest, SceneObject } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { byId, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 's', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

interface HeadlessLike {
  createPrimitive(input: Record<string, unknown>): Promise<{ id: string }>;
  transformObject(id: string, patch: Record<string, unknown>): unknown;
  getObject(id: string): SceneObject;
  smoothMesh(p: Record<string, unknown>): any;
}
const HEADLESS_PATH = ['..', '..', '..', 'mcp-server', 'src', 'headlessEngine'].join('/');

describe('Suavizar: cambio de volumen sobre el tope', () => {
  beforeEach(() => resetStore());

  it('esfera gruesa ×2: no se aplica; allowVolumeChange la aplica en un paso', async () => {
    const sphere = (await store().createPrimitive('sphere', { radius: 10, segments: 8 }))!;
    await run('transform_object', { id: sphere.id, scale: [2, 2, 2] });
    const mesh = byId(sphere.id)!.mesh;
    const steps = store().past.length;
    const params = { id: sphere.id, strength: 1, iterations: 10, preserveSharpEdges: false };
    const blocked = (await run('smooth_mesh', params)).result as { applied: boolean; blockedBy?: string; volumeChangePct: number };
    expect(Math.abs(blocked.volumeChangePct)).toBeGreaterThan(SMOOTH_BLOCK_VOLUME_PCT);
    expect(blocked).toMatchObject({ applied: false, blockedBy: 'volume_changed', volumeLimitPct: SMOOTH_BLOCK_VOLUME_PCT });
    expect(byId(sphere.id)!.mesh).toBe(mesh);
    expect(store().past.length).toBe(steps);
    expect(store().smoothSession?.volumeBlocked).toBe(true);

    const forced = (await run('smooth_mesh', { ...params, allowVolumeChange: true })).result as { applied: boolean; forced?: boolean };
    expect(forced).toMatchObject({ applied: true, forced: true });
    expect(store().past.length).toBe(steps + 1);
    store().undo();
    expect(byId(sphere.id)!.mesh).toBe(mesh);
  }, 60_000);

  it('sin interfaz: misma regla', async () => {
    const mod = (await import(/* @vite-ignore */ HEADLESS_PATH)) as { KuraHeadlessEngine: new () => HeadlessLike };
    const h = new mod.KuraHeadlessEngine();
    const s = await h.createPrimitive({ primitiveType: 'sphere', params: { radius: 10, segments: 8 }, placement: 'origin' });
    h.transformObject(s.id, { scale: [2, 2, 2] });
    const positions = Array.from(h.getObject(s.id).mesh.positions);
    const params = { objectId: s.id, strength: 1, iterations: 10, preserveSharpEdges: false };
    expect(h.smoothMesh(params)).toMatchObject({ applied: false, blockedBy: 'volume_changed' });
    expect(Array.from(h.getObject(s.id).mesh.positions)).toEqual(positions);
    expect(h.smoothMesh({ ...params, allowVolumeChange: true })).toMatchObject({ applied: true, forced: true });
  }, 60_000);
});
