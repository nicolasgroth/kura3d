/**
 * @file src/store/__tests__/mcpConfigState.test.ts
 * @description La configuración MCP persistida nunca contiene el token y la hidratación lo obtiene
 * del almacén seguro, migrando el token antiguo de `localStorage` o generando uno válido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { createMcpTokenStore, validateMcpToken } from '../../utils/mcpTokenStore';
import { hydrateMcpToken, parseStoredMcpConfig, persistableMcpConfig } from '../mcpConfigState';

const memorySession = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

const TOKEN = 'legacy-token-0123456789abcdef';

describe('configuración MCP persistida sin secretos', () => {
  it('serializa sin authToken e ignora un token en el JSON leído', () => {
    const json = persistableMcpConfig({ enabled: true, port: 17500, requireAuth: true, authToken: TOKEN, readOnly: true });
    expect(json).not.toContain(TOKEN);
    expect(JSON.parse(json)).toEqual({ enabled: true, port: 17500, readOnly: true });
    expect(parseStoredMcpConfig(JSON.stringify({ authToken: TOKEN, port: 17500 })).authToken).toBe('');
  });
});

describe('hidratación del token', () => {
  it('migra el token antiguo al almacén seguro', async () => {
    const store = createMcpTokenStore({ desktop: false, session: memorySession() });
    await expect(hydrateMcpToken(store, TOKEN)).resolves.toEqual({ token: TOKEN, saved: true });
    await expect(store.load()).resolves.toBe(TOKEN);
  });

  it('reutiliza el token guardado y genera uno válido si no hay ninguno', async () => {
    const session = memorySession();
    const store = createMcpTokenStore({ desktop: false, session });
    const first = await hydrateMcpToken(store, null);
    expect(validateMcpToken(first.token)).toBe('ok');
    const again = await hydrateMcpToken(createMcpTokenStore({ desktop: false, session }), null);
    expect(again.token).toBe(first.token);
  });
});
