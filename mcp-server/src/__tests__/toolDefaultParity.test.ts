/**
 * @file mcp-server/src/__tests__/toolDefaultParity.test.ts
 * @description Valores por defecto del MCP iguales a los de la app: `kura_plane_cut` anuncia en
 * `tools/list` el conector por defecto de `OPERATION_DEFAULTS.cut` (el mismo que usa el Command Bus), y
 * `paint_object` del objeto entero cambia el color base según `OPERATION_DEFAULTS.paint`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { OPERATION_DEFAULTS } from '../../../src/engine/operationLimits';
import { KuraHeadlessEngine } from '../headlessEngine.js';
import { createKuraMcpServer } from '../index.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

describe('valores por defecto app ↔ MCP', () => {
  it('kura_plane_cut anuncia el conector por defecto compartido', async () => {
    const { server, bridge } = createKuraMcpServer({ bridgePort: 0 });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'qa', version: '1' });
    await Promise.all([server.connect(a), client.connect(b)]);
    open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
    const tool = (await client.listTools()).tools.find((t) => t.name === 'kura_plane_cut')!;
    const props = (tool.inputSchema as { properties: Record<string, { default?: unknown }> }).properties;
    const d = OPERATION_DEFAULTS.cut;
    expect(props.connectorType.default).toBe(d.connectorType);
    expect(props.connectorSize.default).toBe(d.connectorSize);
    expect(props.connectorDepth.default).toBe(d.connectorDepth);
    expect(props.tolerance.default).toBe(d.tolerance);
    expect(props.connectorCount.default).toBe(d.connectorCount);
  });

  it('paint_object del objeto entero sigue OPERATION_DEFAULTS.paint para el color base', async () => {
    const h = new KuraHeadlessEngine();
    const { id } = await h.createPrimitive({ primitiveType: 'box', color: '#112233', placement: 'origin' });
    h.paintObject(id, '#ff0000');
    expect(h.getObject(id).color).toBe(OPERATION_DEFAULTS.paint.wholeSetsBaseColor ? '#ff0000' : '#112233');
  });
});
