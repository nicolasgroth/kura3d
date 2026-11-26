/**
 * @file mcp-server/src/__tests__/securityAttacks.test.ts
 * @description Pruebas adversariales (TRUST-02) que complementan `security.test.ts`: Origin/Host
 * con apariencia local, token por cabecera Bearer, bloqueo del cliente legítimo por inundación de 401
 * (límite aceptado y documentado) y rutas de exportación con flujos alternativos de NTFS.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { isAllowedLocalOrigin } from '../bridge.js';
import { ExportPathError, resolveExportPath } from '../exportPaths.js';
import { createKuraMcpServer } from '../index.js';

const TOKEN = 'q'.repeat(16) + 'A1b2C3d4E5f6G7h8';
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()?.();
});

function attempt(url: string, headers?: Record<string, string>): Promise<number | 'open'> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, headers ? { headers } : undefined);
    ws.once('open', () => {
      cleanup.push(async () => ws.terminate());
      resolve('open');
    });
    ws.once('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
    ws.once('error', () => resolve(0));
  });
}

async function start(authFailureLimitPerMin?: number) {
  const { bridge } = createKuraMcpServer({ bridgePort: 0, authToken: TOKEN, authFailureLimitPerMin });
  await bridge.start();
  cleanup.push(() => bridge.close());
  return { bridge, base: `ws://127.0.0.1:${bridge.getPort()}` };
}

describe('puente MCP: encabezados y token', () => {
  it.each([
    'http://127.0.0.1.evil.example', 'http://localhost.evil.example', 'http://localhost:80@evil.example',
    'https://localhost', 'null', 'file://', 'http://[::1]:5173', 'http://127.0.0.1:5173/path', 'HTTP://EVIL',
  ])('isAllowedLocalOrigin rechaza %j', (origin) => {
    expect(isAllowedLocalOrigin(origin)).toBe(false);
  });

  it('acepta el token por cabecera Authorization: Bearer y rechaza variantes', async () => {
    const { base } = await start();
    expect(await attempt(base, { authorization: `Bearer ${TOKEN}` })).toBe('open');
    expect(await attempt(base, { authorization: `Basic ${TOKEN}` })).toBe(401);
    expect(await attempt(base, { authorization: `Bearer ${TOKEN}x` })).toBe(401);
    expect(await attempt(`${base}/?token=${TOKEN.toUpperCase()}`)).toBe(401);
    expect(await attempt(`${base}/?token=${'q'.repeat(600)}`)).toBe(401);
  });

  it('Host con IPv6 o sin puerto se rechaza aunque el token sea válido', async () => {
    const { base, bridge } = await start();
    const url = `${base}/?token=${TOKEN}`;
    expect(await attempt(url, { host: `[::1]:${bridge.getPort()}` })).toBe(403);
    expect(await attempt(url, { host: '127.0.0.1' })).toBe(403);
    expect(await attempt(url, { host: `127.0.0.1:${bridge.getPort()}.evil.example` })).toBe(403);
  });

  it('LÍMITE ACEPTADO: un proceso local que inunda con 401 bloquea (429) al cliente legítimo', async () => {
    const { base } = await start(5);
    for (let i = 0; i < 5; i += 1) expect(await attempt(`${base}/?token=mal-${i}`)).toBe(401);
    expect(await attempt(`${base}/?token=${TOKEN}`)).toBe(429);
  });
});

describe('exportaciones', () => {
  it('rechaza flujos alternativos NTFS y nombres con espacios finales que cambian la extensión', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kura3d-qa-'));
    cleanup.push(() => rm(dir, { recursive: true, force: true }));
    for (const p of ['a.stl::$DATA', 'a.stl:stream', 'a.stl.', '.stl/..', '..', '.', 'a/.', 'a\..\..\b.stl']) {
      await expect(resolveExportPath(dir, p, '.stl')).rejects.toBeInstanceOf(ExportPathError);
    }
  });
});
