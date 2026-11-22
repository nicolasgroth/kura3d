/**
 * @file src/utils/mcpBridgeHealth.test.ts
 * @description Estado claro del puente MCP: token corto como error con motivo (sin reintentos
 * silenciosos), servidor apagado como "Esperando servidor", servidor que rechaza el token como
 * error, y etiquetas localizadas en vez de "MCP Local".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { startMcpBridgeClient, useMcpBridgeStatus } from './mcpBridgeClient';
import { describeMcpBridge, probeBridgeServer } from './mcpBridgeHealth';

const TOKEN = '0123456789abcdef0123456789abcdef';
const config = (authToken: string) => ({ enabled: true, port: 17432, requireAuth: true, authToken, readOnly: false });
const executeCommand = vi.fn(async () => ({ id: 'x', ok: true }));

/** WebSocket falso que se cierra sin abrir (servidor ausente o upgrade rechazado). */
class ClosingSocket {
  static OPEN = 1;
  readyState = 0;
  private listeners = new Map<string, (event: unknown) => void>();
  constructor() {
    setTimeout(() => this.listeners.get('close')?.({ code: 1006 }), 0);
  }
  addEventListener(type: string, fn: (event: unknown) => void) {
    this.listeners.set(type, fn);
  }
  close() {}
  send() {}
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

afterEach(() => {
  vi.unstubAllGlobals();
  useMcpBridgeStatus.setState({ phase: 'off', error: null });
});

describe('estado del puente MCP', () => {
  it('un token de menos de 16 caracteres es un error con motivo y no intenta conectar', () => {
    const ctor = vi.fn();
    vi.stubGlobal('WebSocket', ctor);
    const stop = startMcpBridgeClient({ config: config('corto-15-chars!'), executeCommand });
    expect(useMcpBridgeStatus.getState()).toMatchObject({ phase: 'error', error: 'token-too-short' });
    expect(ctor).not.toHaveBeenCalled();
    stop();
  });

  it('sin servidor escuchando queda "Esperando servidor"', async () => {
    vi.stubGlobal('WebSocket', ClosingSocket);
    const stop = startMcpBridgeClient({ config: config(TOKEN), executeCommand, probe: async () => false });
    await flush();
    expect(useMcpBridgeStatus.getState()).toMatchObject({ phase: 'waiting', error: null });
    stop();
  });

  it('con servidor escuchando que cierra sin abrir, informa conexión rechazada', async () => {
    vi.stubGlobal('WebSocket', ClosingSocket);
    const stop = startMcpBridgeClient({ config: config(TOKEN), executeCommand, probe: async () => true });
    await flush();
    expect(useMcpBridgeStatus.getState()).toMatchObject({ phase: 'error', error: 'rejected' });
    stop();
  });

  it('las etiquetas son Conectado / Esperando servidor / Error con motivo, nunca "MCP Local"', () => {
    expect(describeMcpBridge('es', true, { phase: 'connected', error: null }).label).toBe('Conectado');
    expect(describeMcpBridge('es', true, { phase: 'waiting', error: null }).label).toBe('Esperando servidor');
    const err = describeMcpBridge('en', true, { phase: 'error', error: 'token-too-short' });
    expect(err.label).toBe(t('en', 'mcp.status.error', { reason: t('en', 'mcp.error.tokenTooShort') }));
    expect(err.tone).toBe('error');
    for (const phase of ['connecting', 'waiting', 'error'] as const) {
      expect(describeMcpBridge('es', true, { phase, error: null }).short).not.toBe('MCP Local');
    }
  });

  it('el sondeo distingue puerto abierto de cerrado', async () => {
    await expect(probeBridgeServer(1, async () => new Response(null))).resolves.toBe(true);
    await expect(probeBridgeServer(1, async () => { throw new TypeError('down'); })).resolves.toBe(false);
  });
});
