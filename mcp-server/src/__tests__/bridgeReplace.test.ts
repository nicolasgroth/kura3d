/**
 * @file mcp-server/src/__tests__/bridgeReplace.test.ts
 * @description Puente MCP: cuando otra instancia de Kura3D reemplaza al cliente activo, las
 * solicitudes en vuelo del cliente anterior se rechazan de inmediato en vez de esperar el timeout.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { KuraBridgeServer } from '../bridge.js';

const TOKEN = 'r'.repeat(16) + '0123456789abcdef';
const cleanup: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()?.();
});

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?token=${TOKEN}`);
    ws.once('open', () => {
      cleanup.push(() => ws.terminate());
      resolve(ws);
    });
    ws.once('error', reject);
  });
}

describe('puente: reemplazo del cliente activo', () => {
  it('rechaza las solicitudes pendientes del cliente anterior sin esperar 15 s', async () => {
    const bridge = new KuraBridgeServer({ port: 0, authToken: TOKEN, defaultTimeoutMs: 15_000 });
    cleanup.push(() => bridge.close());
    expect(await bridge.start()).toBe(true);
    const first = await connect(bridge.getPort());
    await new Promise<void>((r) => {
      const tick = () => (bridge.isConnected() ? r() : setTimeout(tick, 5));
      tick();
    });
    // El primer cliente nunca responde.
    const outcome = bridge.sendCommand('get_scene_state', {}).then(() => null, (err: Error) => err);
    await connect(bridge.getPort());
    const err = await outcome;
    expect(err?.message).toMatch(/replaced/);
    // Que la promesa se resuelva (sin esperar el tiempo de la orden) es el criterio; el timeout de la prueba lo acota.
    expect(first.readyState).not.toBe(WebSocket.CONNECTING);
  });
});
