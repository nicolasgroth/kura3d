/**
 * @file mcp-server/src/__tests__/smoothOrientTools.test.ts
 * @description `kura_smooth_mesh`, `kura_orient_for_print` y `kura_apply_orientation` sin interfaz, con el motor real:
 * acceso anotado (orientar es lectura), rangos del esquema, suavizado de una esfera con cambio de volumen bajo 2 % y
 * malla cerrada, zona por un color que la pieza no tiene (error tipado), una «T» de pie que necesita soporte y deja de
 * necesitarlo al aplicar la recomendada (por id) y la aplicación por cuaternión.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import * as engine from '../../../src/engine/index';
import { createKuraMcpServer } from '../index.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function connect() {
  const { server, bridge, headless } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  const raw = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    return { error: Boolean(r.isError), text: (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('') };
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await raw(name, args);
    expect(r.error, r.text).toBe(false);
    return JSON.parse(r.text);
  };
  return { client, raw, call, headless };
}

/** «T» de pie: tronco 10 × 10 × 30 y barra 50 × 10 × 8 arriba (la barra vuela a los lados). */
async function standingT(call: (n: string, a: Record<string, unknown>) => Promise<any>) {
  const stem = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 10, depth: 10, height: 30 }, placement: 'origin' });
  const bar = await call('kura_create_primitive', {
    primitiveType: 'box', params: { width: 50, depth: 10, height: 8 }, placement: 'origin', position: [0, 0, 26],
  });
  const t = await call('kura_boolean_operation', { targetId: stem.id, toolIds: [bar.id], operation: 'union' });
  return t.resultId as string;
}

describe('MCP: suavizar y orientar sin interfaz', () => {
  it('anota el acceso: orientar es lectura, suavizar y aplicar son escritura', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const hint = (name: string) => tools.find((t) => t.name === name)?.annotations?.readOnlyHint;
    expect(hint('kura_orient_for_print')).toBe(true);
    expect(hint('kura_smooth_mesh')).toBe(false);
    expect(hint('kura_apply_orientation')).toBe(false);
  });

  it('rechaza valores fuera de los rangos compartidos', async () => {
    const { raw, call } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', placement: 'origin' });
    expect((await raw('kura_smooth_mesh', { objectId: box.id, strength: 2 })).error).toBe(true);
    expect((await raw('kura_smooth_mesh', { objectId: box.id, iterations: 1.5 })).error).toBe(true);
    expect((await raw('kura_orient_for_print', { objectId: box.id, overhangAngleDeg: 80 })).error).toBe(true);
  });

  it('suaviza una esfera con menos de 2 % de cambio de volumen y la deja cerrada', async () => {
    const { call, headless } = await connect();
    const sphere = await call('kura_create_primitive', { primitiveType: 'sphere', params: { radius: 15 }, placement: 'origin' });
    const res = await call('kura_smooth_mesh', { objectId: sphere.id, strength: 1, iterations: 10, preserveSharpEdges: false });
    expect(res).toMatchObject({ id: sphere.id, applied: true, iterations: 10, requestedStrength: 1 });
    expect(res.movedVertices).toBeGreaterThan(0);
    expect(Math.abs(res.volumeChangePct)).toBeLessThan(2);
    expect(res.appliedStrength).toBeGreaterThan(0);
    const after = headless.getObject(sphere.id);
    const stats = engine.computeMeshStats(after.mesh);
    expect(stats.isManifold).toBe(true);
    expect(stats.volumeMm3).toBeCloseTo(res.volumeAfterMm3, 0);
  }, 60_000);

  it('con la pieza escalada, el volumen del informe es el de mundo (cilindro ×2 en altura → doble)', async () => {
    const { call, headless } = await connect();
    const cyl = await call('kura_create_primitive', { primitiveType: 'cylinder', placement: 'origin' });
    const local = engine.computeMeshStats(headless.getObject(cyl.id).mesh).volumeMm3;
    await call('kura_transform_object', { objectId: cyl.id, scale: [1, 1, 2] });
    const res = await call('kura_smooth_mesh', { objectId: cyl.id, strength: 0.5, iterations: 3, preserveSharpEdges: false });
    expect(res.volumeBeforeMm3).toBeCloseTo(2 * local, 1);
    expect(res.volumeAfterMm3 / res.volumeBeforeMm3).toBeCloseTo(1 + res.volumeChangePct / 100, 6);
    expect(res).toHaveProperty('damageProtectedVertices');
    expect(res.strengthCoveragePct).toBeGreaterThan(0);
  }, 60_000);

  it('una zona por un color que la pieza no tiene es un error tipado', async () => {
    const { raw, call } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', placement: 'origin' });
    const r = await raw('kura_smooth_mesh', { objectId: box.id, zoneColor: '#ff00ff' });
    expect(r.error).toBe(true);
    expect(r.text).toContain('[invalid-params]');
    expect(r.text).toContain('zoneColor');
  });

  it('la «T» de pie deja de necesitar soporte al aplicar la orientación recomendada', async () => {
    const { call } = await connect();
    const id = await standingT(call);
    const analysis = await call('kura_orient_for_print', { objectId: id, language: 'es' });
    expect(analysis.currentIsBest).toBe(false);
    expect(analysis.allEquivalent).toBe(false);
    const current = analysis.candidates.find((c: { id: string }) => c.id === analysis.currentId);
    expect(current.measures.supportVolumeMm3).toBeGreaterThan(100);
    expect(analysis.recommendedId).toBe(analysis.candidates[0].id);
    const best = analysis.candidates[0];
    expect(best.measures.supportVolumeMm3).toBeLessThan(1);
    // Motivos como clave + parámetros y como frase en el idioma pedido.
    expect(best.reasons.length).toBeGreaterThan(0);
    for (const r of best.reasons) expect(typeof r.text).toBe('string');
    expect(best.reasons.map((r: { text: string }) => r.text).join(' ')).toMatch(/soporte|voladizo|base|apoyo/i);

    const applied = await call('kura_apply_orientation', { objectId: id, candidateId: best.id });
    expect(applied).toMatchObject({ id, applied: best.id, keepXY: true });
    expect(applied.followers).toEqual([]);
    const again = await call('kura_orient_for_print', { objectId: id });
    const now = again.candidates.find((c: { id: string }) => c.id === again.currentId);
    expect(now.measures.supportVolumeMm3).toBeLessThan(1);
    expect(again.currentIsBest).toBe(true);
    expect(again.recommendedId).toBeNull();
    // Apoyada en la cama: la base queda en Z = 0.
    const state = await call('kura_get_scene_state', {});
    const obj = state.objects.find((o: { id: string }) => o.id === id);
    expect(obj.stats.dimensionsMm[2]).toBeCloseTo(best.measures.heightMm, 1);
  }, 120_000);

  it('aplica por cuaternión del usuario y avisa de un candidato inexistente', async () => {
    const { call, raw } = await connect();
    const id = await standingT(call);
    const analysis = await call('kura_orient_for_print', { objectId: id });
    const best = analysis.candidates[0];
    const byQ = await call('kura_apply_orientation', { objectId: id, quaternion: best.quaternion, keepXY: false });
    expect(byQ.applied).toBe('quaternion');
    const again = await call('kura_orient_for_print', { objectId: id });
    expect(again.candidates.find((c: { id: string }) => c.id === again.currentId).measures.supportVolumeMm3).toBeLessThan(1);
    const missing = await raw('kura_apply_orientation', { objectId: id, candidateId: 'nope' });
    expect(missing.error).toBe(true);
    expect(missing.text).toContain('[not-found]');
    const both = await raw('kura_apply_orientation', { objectId: id, candidateId: best.id, quaternion: best.quaternion });
    expect(both.text).toContain('[invalid-params]');
  }, 120_000);
});
