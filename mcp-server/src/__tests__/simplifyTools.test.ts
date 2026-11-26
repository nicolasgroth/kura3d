/**
 * @file mcp-server/src/__tests__/simplifyTools.test.ts
 * @description `kura_simplify_mesh` sin interfaz con los modos nuevos y el motor real: «Sin pérdida» con informe,
 * «Por cantidad» por porcentaje, sin reducción (`applied: false`, escena intacta), rangos del esquema y la misma
 * forma de informe que el Command Bus de la app (`simplifyReportToUser`).
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
  return { raw, call, headless };
}

/** Campos del informe: los mismos que devuelve `simplify_mesh` en la app. */
const REPORT_KEYS = [
  'id', 'mode', 'applied', 'appliedVariant', 'toleranceMm', 'trianglesBefore', 'trianglesAfter', 'volumeBeforeMm3', 'volumeAfterMm3',
  'volumeChangePct', 'genusBefore', 'genusAfter', 'maxDeviationMm', 'deviationSamples', 'checks', 'rejectedBy',
];

describe('MCP: kura_simplify_mesh con modos', () => {
  it('rechaza valores fuera de los rangos compartidos', async () => {
    const { raw, call } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', placement: 'origin' });
    expect((await raw('kura_simplify_mesh', { objectId: box.id, mode: 'otro' })).error).toBe(true);
    expect((await raw('kura_simplify_mesh', { objectId: box.id, targetPercent: 0 })).error).toBe(true);
    expect((await raw('kura_simplify_mesh', { objectId: box.id, targetTriangles: 2.5 })).error).toBe(true);
    expect((await raw('kura_simplify_mesh', { objectId: box.id, toleranceMm: 0.001 })).error).toBe(true);
  });

  it('«Sin pérdida» sobre un cubo refinado: aplica, conserva género y volumen, informe completo', async () => {
    const { call, headless } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 20, height: 20, depth: 20 }, placement: 'origin' });
    await call('kura_refine_mesh', { objectId: box.id, targetEdgeLengthMm: 2, smooth: false });
    const res = await call('kura_simplify_mesh', { objectId: box.id, mode: 'lossless' });
    for (const k of REPORT_KEYS) expect(res).toHaveProperty(k);
    expect(res).toMatchObject({ id: box.id, mode: 'lossless', applied: true, rejectedBy: [] });
    expect(res.trianglesAfter).toBeLessThan(res.trianglesBefore / 4);
    expect(res.genusAfter).toBe(res.genusBefore);
    expect(Math.abs(res.volumeChangePct)).toBeLessThan(engine.LOSSLESS_LIMITS.maxVolumePct);
    const stats = engine.computeMeshStats(headless.getObject(box.id).mesh);
    expect(stats.isManifold).toBe(true);
    expect(stats.triangles).toBe(res.trianglesAfter);
  });

  it('«Por cantidad» al 25 %: queda en el objetivo o apenas debajo', async () => {
    const { call } = await connect();
    const sphere = await call('kura_create_primitive', { primitiveType: 'sphere', params: { radius: 15, segments: 64 }, placement: 'origin' });
    const res = await call('kura_simplify_mesh', { objectId: sphere.id, targetPercent: 25 });
    expect(res.mode).toBe('target');
    expect(res.applied).toBe(true);
    expect(res.trianglesAfter).toBeLessThanOrEqual(res.target.triangles);
    expect(res.trianglesAfter).toBeGreaterThan(res.target.triangles * 0.8);
  });

  it('destructivo con onDestructive block: no aplica, trae safe y allowDestructive lo fuerza', async () => {
    const { call, headless } = await connect();
    const torus = await call('kura_create_primitive', { primitiveType: 'torus', params: { outerRadius: 14, tubeRadius: 4, segments: 48 }, placement: 'origin' });
    const positions = Array.from(headless.getObject(torus.id).mesh.positions);
    const res = await call('kura_simplify_mesh', { objectId: torus.id, targetPercent: 2, onDestructive: 'block' });
    expect(res.applied).toBe(false);
    expect(res.appliedVariant).toBe('none');
    expect(res.destructive.length).toBeGreaterThan(0);
    expect(res.safe).toMatchObject({ triangles: expect.any(Number), toleranceMm: expect.any(Number), maxDeviationMm: expect.any(Number) });
    expect(Array.from(headless.getObject(torus.id).mesh.positions)).toEqual(positions);
    // La alternativa segura se aplica con «tolerance» y su tolerancia.
    const safe = await call('kura_simplify_mesh', { objectId: torus.id, mode: 'tolerance', toleranceMm: res.safe.toleranceMm });
    expect(safe).toMatchObject({ applied: true, destructive: [], trianglesAfter: res.safe.triangles });
    const again = await call('kura_create_primitive', { primitiveType: 'torus', params: { outerRadius: 14, tubeRadius: 4, segments: 48 }, placement: 'origin' });
    const forced = await call('kura_simplify_mesh', { objectId: again.id, targetPercent: 2, allowDestructive: true });
    expect(forced).toMatchObject({ applied: true, forced: true });
  });

  it('por defecto aplica la versión segura; dryRun da el mismo informe sin tocar la escena', async () => {
    const { call, headless } = await connect();
    const torus = await call('kura_create_primitive', { primitiveType: 'torus', params: { outerRadius: 14, tubeRadius: 4, segments: 48 }, placement: 'origin' });
    const positions = Array.from(headless.getObject(torus.id).mesh.positions);
    const dry = await call('kura_simplify_mesh', { objectId: torus.id, targetPercent: 2, dryRun: true });
    expect(dry).toMatchObject({ dryRun: true, applied: true, appliedVariant: 'safe' });
    expect(Array.from(headless.getObject(torus.id).mesh.positions)).toEqual(positions);
    const res = await call('kura_simplify_mesh', { objectId: torus.id, targetPercent: 2 });
    expect(res).toMatchObject({ applied: true, appliedVariant: 'safe', trianglesAfter: dry.trianglesAfter });
    expect(res.dryRun).toBeUndefined();
    // Lo pedido queda aparte; Manifold no es monótono y la segura puede tener menos triángulos que lo pedido.
    expect(res.requested.triangles).not.toBe(res.trianglesAfter);
    expect(res.trianglesAfter).toBeLessThan(res.trianglesBefore);
    expect(res.trianglesAfter).toBe(res.safe.triangles);
    expect(headless.getObject(torus.id).stats.triangles).toBe(res.trianglesAfter);
  });

  it('sin reducción: applied false y la malla no cambia', async () => {
    const { call, headless } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', placement: 'origin' });
    const positions = Array.from(headless.getObject(box.id).mesh.positions);
    const res = await call('kura_simplify_mesh', { objectId: box.id, mode: 'lossless' });
    expect(res.applied).toBe(false);
    expect(res.checks).toContain('no_reduction');
    expect(Array.from(headless.getObject(box.id).mesh.positions)).toEqual(positions);
  });
});
