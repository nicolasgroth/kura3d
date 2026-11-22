/**
 * @file src/__tests__/secretStorage.test.tsx
 * @description Ninguna clave de IA ni token MCP termina en `localStorage` ni en la consola: se usan
 * los flujos reales del store (guardar clave, fijar y regenerar token, migrar claves antiguas) y de
 * los módulos de `src/ai` y `src/utils` que sí escriben en `localStorage` (hosts permitidos,
 * proyectos recientes); al final se revisa cada valor guardado y cada mensaje de consola.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiKeyStore, migrateLegacyApiKey, SESSION_KEYS_STORAGE } from '../ai/apiKeyStore';
import { saveAllowedHosts } from '../ai/allowedHosts';
import { persistableAiConfig } from '../ai/aiConfigState';
import { useKuraStore } from '../store/useKuraStore';
import { STORAGE_AI_CONFIG_KEY, STORAGE_MCP_CONFIG_KEY } from '../store/preferencesStorage';
import { createMcpTokenStore, forgetLegacyMcpToken, MCP_SESSION_TOKEN_KEY } from '../utils/mcpTokenStore';
import { addRecentProject } from '../utils/recentProjects';

const AI_KEY = 'sk-test-SECRETKEY0123456789abcdefABCDEF';
const MCP_TOKEN = 'mcptoken-SECRET-0123456789abcdef';

const consoleSpies: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(() => {
  sessionStorage.clear();
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    consoleSpies.push(vi.spyOn(console, method).mockImplementation(() => undefined));
  }
});
afterEach(() => {
  consoleSpies.splice(0).forEach((s) => s.mockRestore());
});

/** Todo lo que quedó en `localStorage` (claves y valores) en un solo texto. */
function localStorageDump(): string {
  const parts: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    parts.push(key, localStorage.getItem(key) ?? '');
  }
  return parts.join('\n');
}

function consoleDump(): string {
  return consoleSpies.flatMap((s) => s.mock.calls.flat()).map(String).join('\n');
}

const secretFragments = (secret: string) => [secret, secret.slice(0, 16), secret.slice(-16)];

function expectNoSecrets(text: string) {
  for (const secret of [AI_KEY, MCP_TOKEN]) {
    for (const fragment of secretFragments(secret)) expect(text).not.toContain(fragment);
  }
}

describe('secretos fuera de localStorage y de los logs', () => {
  it('flujos del store: clave de IA, token MCP fijado y regenerado', async () => {
    const s = useKuraStore.getState();
    s.setAiConfig({ apiKey: AI_KEY, model: 'gpt-test' });
    s.setMcpConfig({ authToken: MCP_TOKEN, port: 3333 });
    s.regenerateMcpToken();
    await new Promise((r) => setTimeout(r, 0));
    // Lo no sensible sí se guarda
    expect(localStorage.getItem(STORAGE_AI_CONFIG_KEY)).toContain('gpt-test');
    expect(localStorage.getItem(STORAGE_MCP_CONFIG_KEY)).toContain('3333');
    const regenerated = useKuraStore.getState().mcpConfig.authToken;
    expect(regenerated).toBeTruthy();
    const dump = localStorageDump();
    expectNoSecrets(dump);
    expect(dump).not.toContain(regenerated);
    expectNoSecrets(consoleDump());
  });

  it('clave de IA en web: memoria por omisión, sessionStorage solo con «recordar en esta sesión»', async () => {
    const store = createApiKeyStore({ desktop: false, session: sessionStorage });
    await store.save('openai', AI_KEY);
    expect(sessionStorage.getItem(SESSION_KEYS_STORAGE)).toBeNull();
    expect(await store.load('openai')).toBe(AI_KEY);
    store.setRememberInSession(true);
    expect(sessionStorage.getItem(SESSION_KEYS_STORAGE)).toContain(AI_KEY);
    store.setRememberInSession(false);
    expect(sessionStorage.getItem(SESSION_KEYS_STORAGE)).toBeNull();
    expectNoSecrets(localStorageDump());
  });

  it('escritorio: clave y token van al llavero (comando nativo), nunca al webview', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const invoke = async <T,>(cmd: string, args: Record<string, unknown>) => {
      calls.push([cmd, args]);
      return null as T;
    };
    const keys = createApiKeyStore({ desktop: true, invoke, session: sessionStorage });
    await keys.save('anthropic', AI_KEY);
    keys.setRememberInSession(true);
    expect(await keys.load('anthropic')).toBe('');
    const tokens = createMcpTokenStore({ desktop: true, invoke, session: sessionStorage });
    await tokens.save(MCP_TOKEN);
    expect(calls.map(([c]) => c)).toEqual(['ai_key_set', 'mcp_token_set']);
    expectNoSecrets(localStorageDump());
    expect(sessionStorage.length).toBe(0);
  });

  it('token MCP en web: sessionStorage, no localStorage', async () => {
    const tokens = createMcpTokenStore({ desktop: false, session: sessionStorage });
    await tokens.save(MCP_TOKEN);
    expect(sessionStorage.getItem(MCP_SESSION_TOKEN_KEY)).toBe(MCP_TOKEN);
    expectNoSecrets(localStorageDump());
  });

  it('migración: la clave y el token antiguos en claro salen de localStorage', () => {
    localStorage.setItem(STORAGE_AI_CONFIG_KEY, JSON.stringify({ provider: 'openai', apiKey: AI_KEY, model: 'm' }));
    localStorage.setItem(STORAGE_MCP_CONFIG_KEY, JSON.stringify({ port: 3333, authToken: MCP_TOKEN }));
    const store = createApiKeyStore({ desktop: false, session: sessionStorage });
    expect(migrateLegacyApiKey(localStorage, STORAGE_AI_CONFIG_KEY, store)?.apiKey).toBe(AI_KEY);
    forgetLegacyMcpToken(localStorage);
    expect(JSON.parse(localStorage.getItem(STORAGE_AI_CONFIG_KEY)!)).toEqual({ provider: 'openai', model: 'm' });
    expect(JSON.parse(localStorage.getItem(STORAGE_MCP_CONFIG_KEY)!)).toEqual({ port: 3333 });
    expectNoSecrets(localStorageDump());
  });

  it('lo que src/ai y src/utils sí guardan en localStorage no es secreto', async () => {
    await saveAllowedHosts(['api.example.com']);
    addRecentProject('pieza.kura');
    const persisted = persistableAiConfig({ ...useKuraStore.getState().aiConfig, apiKey: AI_KEY, keyStored: true });
    expect(Object.keys(persisted)).not.toContain('apiKey');
    expect(Object.keys(persisted)).not.toContain('keyStored');
    expect(localStorage.getItem('kura3d-ai-allowed-hosts')).toBe('["api.example.com"]');
    expect(localStorage.getItem('kura3d-recent-projects')).toContain('pieza.kura');
    expectNoSecrets(localStorageDump());
  });
});
