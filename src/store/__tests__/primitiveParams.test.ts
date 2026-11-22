/**
 * @file src/store/__tests__/primitiveParams.test.ts
 * @description Primitivas y roscas paramétricas en el store y el Command Bus: regenerar con
 * parámetros nuevos (malla cerrada, volumen y medidas esperados) conservando identidad y
 * transformación, un solo paso de deshacer, fin de la parametría tras una operación que cambia la
 * malla, y colocación en espacio libre con `placement`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { parametricStateOf } from '../../core/scene/parametric';
import { footprintOf } from '../../core/scene/freeSpot';
import type { KuraCommandRequest } from '../../types/kura';
import { byId, resetStore, store } from './storeTestUtils';

const run = (command: KuraCommandRequest['command'], params: Record<string, unknown>) =>
  store().executeCommand({ id: `t_${command}`, command, params }, 'ai');

beforeEach(async () => {
  await resetStore();
});

async function cylinder() {
  const obj = await store().createPrimitive('cylinder', { radius: 5, height: 10, segments: 64 }, { color: '#123456', name: 'Eje' });
  if (!obj) throw new Error('sin cilindro');
  return obj;
}

describe('updatePrimitiveParams', () => {
  it('regenera conservando id, nombre, color, material y transformación; volumen y medidas calzan', async () => {
    const obj = await cylinder();
    store().setObjectTransform(obj.id, { position: [12, 0, -4], rotation: [0, 0.5, 0], scale: [2, 1, 1] }, true);
    const pastBefore = store().past.length;
    const updated = await store().updatePrimitiveParams(obj.id, { kind: 'primitive', params: { radius: 8, height: 20 } });
    expect(updated).not.toBeNull();
    const now = byId(obj.id)!;
    expect(now).toMatchObject({ id: obj.id, name: 'Eje', color: '#123456', position: [12, 0, -4], rotation: [0, 0.5, 0], scale: [2, 1, 1] });
    expect(now.primitiveParams).toMatchObject({ radius: 8, height: 20, segments: 64 });
    expect(now.stats.isManifold).toBe(true);
    // Polígono de 64 lados inscrito: área = ½·n·r²·sin(2π/n).
    const area = 0.5 * 64 * 64 * Math.sin((2 * Math.PI) / 64);
    expect(now.stats.volumeMm3).toBeCloseTo(area * 20, 0);
    expect(now.stats.dimensionsMm[1]).toBeCloseTo(20, 4);
    expect(parametricStateOf(now).status).toBe('primitive');
    expect(store().past.length).toBe(pastBefore + 1);

    store().undo();
    expect(byId(obj.id)!.primitiveParams).toMatchObject({ radius: 5, height: 10 });
    expect(parametricStateOf(byId(obj.id)!).status).toBe('primitive');
    store().redo();
    expect(byId(obj.id)!.primitiveParams).toMatchObject({ radius: 8, height: 20 });
  });

  it('deja de ser paramétrico tras una operación que cambia la malla y rechaza editar', async () => {
    const obj = await cylinder();
    expect(await store().simplifySelectedMesh(obj.id, 0.5)).toBe(true);
    expect(parametricStateOf(byId(obj.id)!).status).toBe('modified');
    expect(await store().updatePrimitiveParams(obj.id, { kind: 'primitive', params: { radius: 3 } })).toBeNull();
  });

  it('regenera una rosca con sus opciones', async () => {
    const bolt = await store().createThreadObject({ kind: 'bolt', diameterMm: 6, pitchMm: 1, lengthMm: 10, includeHead: false });
    expect(parametricStateOf(bolt!).status).toBe('thread');
    await store().updatePrimitiveParams(bolt!.id, { kind: 'thread', options: { lengthMm: 20 } as never });
    const now = byId(bolt!.id)!;
    expect(now.parametric?.thread).toMatchObject({ diameterMm: 6, lengthMm: 20 });
    expect(now.stats.isManifold).toBe(true);
    expect(now.stats.dimensionsMm[1]).toBeGreaterThan(19);
  });

  it('Command Bus: update_primitive_params valida rangos y devuelve los parámetros', async () => {
    const obj = await cylinder();
    const ok = await run('update_primitive_params', { id: obj.id, params: { height: 30 } });
    expect(ok.ok).toBe(true);
    expect(ok.result).toMatchObject({ id: obj.id, primitiveParams: { height: 30 } });
    const bad = await run('update_primitive_params', { id: obj.id, params: { height: -1 } });
    expect(bad.ok).toBe(false);
  });
});

describe('placement', () => {
  it("bus create_primitive: por defecto 'origin'; con 'free' no se solapa y devuelve la posición", async () => {
    const a = await run('create_primitive', { type: 'box', width: 30, height: 30, depth: 30 });
    expect(a.result).toMatchObject({ position: [0, 0, 0] });
    const b = await run('create_primitive', { type: 'box', width: 30, height: 30, depth: 30, placement: 'free' });
    const pos = (b.result as { position: number[] }).position;
    expect(Math.hypot(pos[0], pos[2])).toBeGreaterThanOrEqual(35 - 1e-6);
    const [first, second] = store().objects;
    const fa = footprintOf(first.mesh, first.position, first.rotation, first.scale)!;
    const fb = footprintOf(second.mesh, second.position, second.rotation, second.scale)!;
    expect(fa.maxX <= fb.minX || fb.maxX <= fa.minX || fa.maxZ <= fb.minZ || fb.maxZ <= fa.minZ).toBe(true);
    expect(store().selectedIds).toEqual([second.id]);
  });
});
