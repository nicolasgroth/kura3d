/**
 * @file mcp-server/src/__tests__/keptHalfParity.test.ts
 * @description `kura_plane_cut` con `keptHalfPlacement`: el esquema anuncia el parámetro con `inPlace` por
 * defecto (contrato anterior) y el motor sin interfaz deja la mitad conservada en el mismo sitio que la app
 * (función compartida `resolveKeptHalf`): inPlace flota, dropToBed toca la cama en el mismo X/Y y freeSpot
 * la apoya sin pisar a otro objeto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { KEPT_HALF_PLACEMENTS } from '../../../src/core/scene/keptHalf';
import { KuraHeadlessEngine } from '../headlessEngine.js';
import { createKuraMcpServer } from '../index.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

const cut = { axis: 'z' as const, offset: 0, connectorType: 'none' as const, connectorSize: 4, connectorDepth: 5, tolerance: 0.25, connectorCount: 2, keepMode: 'positive' as const };

/** Altura de la base (Z del usuario) de un resumen de objeto: posición Z menos la mitad de la altura si está centrada. */
async function keptBase(placement: 'inPlace' | 'dropToBed' | 'freeSpot') {
  const h = new KuraHeadlessEngine();
  const box = await h.createPrimitive({ primitiveType: 'box', params: { width: 30, height: 30, depth: 30 }, position: [0, 0, 15] });
  const res = await h.planeCut(box.id, { ...cut, keptHalfPlacement: placement });
  expect(res.parts).toHaveLength(1);
  const half = h.getObject(res.parts[0].id);
  const ys = [];
  for (let i = 1; i < half.mesh.positions.length; i += 3) ys.push(half.mesh.positions[i]);
  return { base: half.position[1] + Math.min(...ys), x: half.position[0] };
}

describe('mitad conservada: MCP sin interfaz', () => {
  it('kura_plane_cut anuncia keptHalfPlacement con inPlace por defecto', async () => {
    const { server, bridge } = createKuraMcpServer({ bridgePort: 0 });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'qa', version: '1' });
    await Promise.all([server.connect(a), client.connect(b)]);
    open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
    const tool = (await client.listTools()).tools.find((t) => t.name === 'kura_plane_cut')!;
    const props = (tool.inputSchema as { properties: Record<string, { default?: unknown; enum?: string[] }> }).properties;
    expect(props.keptHalfPlacement.default).toBe('inPlace');
    expect(props.keptHalfPlacement.enum).toEqual([...KEPT_HALF_PLACEMENTS]);
  }, 30_000);

  it('inPlace la deja flotando; dropToBed y freeSpot la apoyan en la cama', async () => {
    expect((await keptBase('inPlace')).base).toBeGreaterThan(14);
    expect(Math.abs((await keptBase('dropToBed')).base)).toBeLessThan(1e-6);
    expect(Math.abs((await keptBase('freeSpot')).base)).toBeLessThan(1e-6);
  }, 60_000);
});
