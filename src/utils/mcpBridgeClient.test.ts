/**
 * @file src/utils/mcpBridgeClient.test.ts
 * @description Pruebas del cliente del puente MCP: URL con token obligatorio y preferencia de solo
 * lectura, y política lectura/escritura compartida con el servidor (`src/core/commands/commandPolicy.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { READ_COMMANDS } from '../core/commands/commandPolicy';
import { buildMcpWsUrl, isMcpCommandAllowed, rotateMcpBridgeToken } from './mcpBridgeClient';

const config = { enabled: true, port: 17432, requireAuth: true, authToken: 'abc def', readOnly: false };

describe('mcpBridgeClient', () => {
  it('incluye siempre el token (codificado) y declara solo lectura en el handshake', () => {
    expect(buildMcpWsUrl(config)).toBe('ws://127.0.0.1:17432/?token=abc+def');
    expect(buildMcpWsUrl({ ...config, requireAuth: false, readOnly: true })).toBe(
      'ws://127.0.0.1:17432/?token=abc+def&readOnly=1',
    );
  });

  it('aplica la misma política que el servidor y rechaza comandos desconocidos', () => {
    for (const cmd of READ_COMMANDS) expect(isMcpCommandAllowed(cmd, true)).toBe(true);
    expect(isMcpCommandAllowed('create_primitive', true)).toBe(false);
    expect(isMcpCommandAllowed('export_stl', true)).toBe(false);
    expect(isMcpCommandAllowed('create_primitive', false)).toBe(true);
    expect(isMcpCommandAllowed('rm_rf', false)).toBe(false);
  });

  it('informa "offline" al rotar sin sesión autenticada (el servidor no se entera)', async () => {
    await expect(rotateMcpBridgeToken('x'.repeat(32))).resolves.toBe('offline');
  });
});
