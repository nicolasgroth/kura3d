/**
 * @file src/ai/apiKeyStore.test.ts
 * @description Pruebas del almacenamiento de claves IA (memoria, sesión web, comandos nativos simulados)
 * y de la migración desde `localStorage`. Solo usa valores ficticios.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';
import { createApiKeyStore, migrateLegacyApiKey, SESSION_KEYS_STORAGE } from './apiKeyStore';

const FAKE_KEY = 'fake-test-key-123456';
const CONFIG_KEY = 'kura3d-ai-config';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('web key store', () => {
  it('keeps keys only in memory by default', async () => {
    const session = memoryStorage();
    const store = createApiKeyStore({ desktop: false, session });
    await store.save('openai', FAKE_KEY);
    expect(await store.load('openai')).toBe(FAKE_KEY);
    expect(await store.load('gemini')).toBe('');
    expect(session.data.size).toBe(0);
    expect(createApiKeyStore({ desktop: false, session }).rememberInSession()).toBe(false);
  });

  it('copies keys to sessionStorage only when the user opts in, and forgets them on opt-out', async () => {
    const session = memoryStorage();
    const store = createApiKeyStore({ desktop: false, session });
    store.setRememberInSession(true);
    await store.save('anthropic', FAKE_KEY);
    expect(JSON.parse(session.data.get(SESSION_KEYS_STORAGE)!)).toEqual({ anthropic: FAKE_KEY });

    const reloaded = createApiKeyStore({ desktop: false, session });
    expect(reloaded.rememberInSession()).toBe(true);
    expect(await reloaded.load('anthropic')).toBe(FAKE_KEY);

    reloaded.setRememberInSession(false);
    expect(session.data.has(SESSION_KEYS_STORAGE)).toBe(false);
    expect(await reloaded.load('anthropic')).toBe(FAKE_KEY);
  });

  it('ignores corrupt session data and unknown providers in it', async () => {
    const session = memoryStorage({ [SESSION_KEYS_STORAGE]: '{"evil":"x","openai":42' });
    const store = createApiKeyStore({ desktop: false, session });
    expect(await store.load('openai')).toBe('');
    const tampered = memoryStorage({ [SESSION_KEYS_STORAGE]: '{"evil":"x","openai":42}' });
    expect(await createApiKeyStore({ desktop: false, session: tampered }).load('openai')).toBe('');
  });

  it('deletes a key when saved empty', async () => {
    const store = createApiKeyStore({ desktop: false, session: null });
    await store.save('gemini', FAKE_KEY);
    await store.save('gemini', '   ');
    expect(await store.load('gemini')).toBe('');
  });

  it('rejects providers outside the allowlist', async () => {
    const store = createApiKeyStore({ desktop: false, session: null });
    await expect(store.save('mcp' as never, FAKE_KEY)).rejects.toThrow('ai-provider-not-allowed');
  });
});

describe('desktop key store', () => {
  it('uses only the get/set/delete native commands and never touches sessionStorage', async () => {
    const native = new Map<string, string>();
    const invoke = vi.fn(async (command: string, args: Record<string, unknown>) => {
      const provider = String(args.provider);
      if (command === 'ai_key_set') native.set(provider, String(args.secret));
      else if (command === 'ai_key_delete') native.delete(provider);
      else if (command === 'ai_key_get') return native.get(provider) ?? null;
      else throw new Error(`unexpected ${command}`);
      return null;
    }) as never;
    const session = memoryStorage();
    const store = createApiKeyStore({ desktop: true, invoke, session });
    store.setRememberInSession(true);

    await store.save('openai', FAKE_KEY);
    expect(native.get('openai')).toBe(FAKE_KEY);
    expect(await createApiKeyStore({ desktop: true, invoke }).load('openai')).toBe(FAKE_KEY);
    await store.save('openai', '');
    expect(native.has('openai')).toBe(false);
    expect(session.data.size).toBe(0);
    const commands = (invoke as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([name]) => name);
    expect(new Set(commands)).toEqual(new Set(['ai_key_set', 'ai_key_get', 'ai_key_delete']));
  });
});

describe('legacy migration', () => {
  it('removes the key from localStorage synchronously and moves it to the desktop store', async () => {
    const local = memoryStorage({
      [CONFIG_KEY]: JSON.stringify({ provider: 'anthropic', apiKey: FAKE_KEY, model: 'm', baseUrl: '' }),
    });
    const native = new Map<string, string>();
    const invoke = vi.fn(async (_command: string, args: Record<string, unknown>) => {
      native.set(String(args.provider), String(args.secret));
      return null;
    }) as never;
    const store = createApiKeyStore({ desktop: true, invoke });

    const legacy = migrateLegacyApiKey(local, CONFIG_KEY, store);
    expect(local.data.get(CONFIG_KEY)).not.toContain(FAKE_KEY);
    expect(JSON.parse(local.data.get(CONFIG_KEY)!)).toEqual({ provider: 'anthropic', model: 'm', baseUrl: '' });
    expect(legacy?.provider).toBe('anthropic');
    expect(legacy?.apiKey).toBe(FAKE_KEY);
    expect(await legacy?.saved).toBe(true);
    expect(native.get('anthropic')).toBe(FAKE_KEY);
  });

  it('on the web keeps the migrated key for this session only', async () => {
    const local = memoryStorage({ [CONFIG_KEY]: JSON.stringify({ provider: 'openai', apiKey: FAKE_KEY }) });
    const session = memoryStorage();
    const store = createApiKeyStore({ desktop: false, session });
    const legacy = migrateLegacyApiKey(local, CONFIG_KEY, store);
    expect(await legacy?.saved).toBe(true);
    expect(local.data.get(CONFIG_KEY)).not.toContain(FAKE_KEY);
    expect(session.data.get(SESSION_KEYS_STORAGE)).toContain(FAKE_KEY);
    expect(store.rememberInSession()).toBe(true);
  });

  it('reports a failed move but still removes the key from localStorage', async () => {
    const local = memoryStorage({ [CONFIG_KEY]: JSON.stringify({ provider: 'gemini', apiKey: FAKE_KEY }) });
    const invoke = vi.fn(async () => {
      throw new Error('ai-key-store-unavailable');
    }) as never;
    const legacy = migrateLegacyApiKey(local, CONFIG_KEY, createApiKeyStore({ desktop: true, invoke }));
    expect(await legacy?.saved).toBe(false);
    expect(legacy?.apiKey).toBe(FAKE_KEY);
    expect(local.data.get(CONFIG_KEY)).not.toContain(FAKE_KEY);
  });

  it('does nothing without a stored key and drops empty keys', () => {
    const store = createApiKeyStore({ desktop: false, session: null });
    expect(migrateLegacyApiKey(memoryStorage(), CONFIG_KEY, store)).toBeNull();
    const local = memoryStorage({ [CONFIG_KEY]: JSON.stringify({ provider: 'gemini', apiKey: '' }) });
    expect(migrateLegacyApiKey(local, CONFIG_KEY, store)).toBeNull();
    expect(local.data.get(CONFIG_KEY)).toBe('{"provider":"gemini"}');
    const corrupt = memoryStorage({ [CONFIG_KEY]: '{not json' });
    expect(migrateLegacyApiKey(corrupt, CONFIG_KEY, store)).toBeNull();
  });

  it('falls back to gemini when the stored provider is unknown', async () => {
    const local = memoryStorage({ [CONFIG_KEY]: JSON.stringify({ provider: 'evil', apiKey: FAKE_KEY }) });
    const store = createApiKeyStore({ desktop: false, session: null });
    expect(migrateLegacyApiKey(local, CONFIG_KEY, store)?.provider).toBe('gemini');
  });
});
