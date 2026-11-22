/**
 * @file src/utils/mcpTokenStore.test.ts
 * @description Pruebas del almacén del token del puente MCP: llavero en escritorio (comandos
 * `mcp_token_*`), solo `sessionStorage`/memoria en web, migración del token antiguo guardado en
 * claro en `localStorage['kura3d-mcp-config']` (se borra) y validación de longitud mínima.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';
import {
  MCP_CONFIG_STORAGE_KEY,
  MCP_SESSION_TOKEN_KEY,
  MIN_MCP_TOKEN_LENGTH,
  createMcpTokenStore,
  maskToken,
  forgetLegacyMcpToken,
  readLegacyMcpToken,
  validateMcpToken,
} from './mcpTokenStore';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const TOKEN = '0123456789abcdef0123456789abcdef';

describe('validación del token', () => {
  it('exige al menos 16 caracteres sin espacios ni controles', () => {
    expect(MIN_MCP_TOKEN_LENGTH).toBe(16);
    expect(validateMcpToken('x'.repeat(15))).toBe('too-short');
    expect(validateMcpToken('x'.repeat(16))).toBe('ok');
    expect(validateMcpToken('abc def ghi jkl mno')).toBe('invalid-chars');
    expect(validateMcpToken(`${'x'.repeat(20)}\u0000`)).toBe('invalid-chars');
  });

  it('enmascara dejando solo los últimos 4 caracteres', () => {
    expect(maskToken(TOKEN)).toBe(`${'•'.repeat(12)}cdef`);
    expect(maskToken('')).toBe('');
  });
});

describe('migración del token antiguo de localStorage', () => {
  it('lee el token y luego lo borra de la configuración persistida', () => {
    const local = new MemoryStorage();
    local.setItem(MCP_CONFIG_STORAGE_KEY, JSON.stringify({ enabled: true, port: 17500, authToken: TOKEN }));
    expect(readLegacyMcpToken(local)).toBe(TOKEN);
    forgetLegacyMcpToken(local);
    const after = JSON.parse(local.getItem(MCP_CONFIG_STORAGE_KEY)!);
    expect(after).toEqual({ enabled: true, port: 17500 });
    expect(local.getItem(MCP_CONFIG_STORAGE_KEY)).not.toContain(TOKEN);
    expect(readLegacyMcpToken(local)).toBeNull();
  });

  it('descarta tokens antiguos demasiado cortos y los borra igual', () => {
    const local = new MemoryStorage();
    local.setItem(MCP_CONFIG_STORAGE_KEY, JSON.stringify({ authToken: 'corto' }));
    expect(readLegacyMcpToken(local)).toBeNull();
    forgetLegacyMcpToken(local);
    expect(local.getItem(MCP_CONFIG_STORAGE_KEY)).not.toContain('corto');
  });
});

describe('almacén web: solo sessionStorage', () => {
  it('guarda y recupera en sessionStorage, nunca en localStorage', async () => {
    const session = new MemoryStorage();
    const store = createMcpTokenStore({ desktop: false, session });
    await store.save(TOKEN);
    expect(session.getItem(MCP_SESSION_TOKEN_KEY)).toBe(TOKEN);
    const fresh = createMcpTokenStore({ desktop: false, session });
    await expect(fresh.load()).resolves.toBe(TOKEN);
  });

  it('rechaza guardar tokens inválidos', async () => {
    const store = createMcpTokenStore({ desktop: false, session: new MemoryStorage() });
    await expect(store.save('corto')).rejects.toThrow('mcp-token-invalid');
  });
});

describe('almacén de escritorio: llavero del sistema', () => {
  it('usa los comandos nativos mcp_token_get / mcp_token_set', async () => {
    let saved: string | null = null;
    const invoke = vi.fn(async (command: string, args: Record<string, unknown>) => {
      if (command === 'mcp_token_set') saved = args.token as string;
      if (command === 'mcp_token_get') return saved;
      return undefined;
    }) as unknown as <T>(command: string, args: Record<string, unknown>) => Promise<T>;
    const session = new MemoryStorage();
    const store = createMcpTokenStore({ desktop: true, invoke, session });
    await store.save(TOKEN);
    await expect(store.load()).resolves.toBe(TOKEN);
    expect(invoke).toHaveBeenCalledWith('mcp_token_set', { token: TOKEN });
    // En escritorio no se copia a sessionStorage.
    expect(session.data.size).toBe(0);
  });
});
