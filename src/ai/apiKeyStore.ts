/**
 * @file src/ai/apiKeyStore.ts
 * @description Almacenamiento de claves API de proveedores IA fuera de `localStorage`.
 * - Escritorio (Tauri): almacén de credenciales del sistema operativo mediante los comandos Rust
 *   `ai_key_get` / `ai_key_set` / `ai_key_delete` (crate `keyring`).
 * - Web: solo en memoria; con la opción explícita "recordar en esta sesión" se copia a `sessionStorage`,
 *   que el navegador borra al cerrar la pestaña.
 * Incluye la migración de claves antiguas guardadas en la configuración IA de `localStorage`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AiProviderType } from '../types/kura';
import { isTauriRuntime } from '../utils/platformBridge';

export const AI_PROVIDERS: readonly AiProviderType[] = ['gemini', 'openai', 'anthropic', 'ollama'];
export const SESSION_KEYS_STORAGE = 'kura3d-ai-session-keys';

type Invoke = <T>(command: string, args: Record<string, unknown>) => Promise<T>;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface ApiKeyStoreDeps {
  desktop: boolean;
  invoke?: Invoke;
  session?: StorageLike | null;
}

export interface ApiKeyStore {
  readonly desktop: boolean;
  load(provider: AiProviderType): Promise<string>;
  save(provider: AiProviderType, key: string): Promise<void>;
  rememberInSession(): boolean;
  setRememberInSession(remember: boolean): void;
}

function assertProvider(provider: string): asserts provider is AiProviderType {
  if (!AI_PROVIDERS.includes(provider as AiProviderType)) throw new Error('ai-provider-not-allowed');
}

function readSession(session: StorageLike | null | undefined): Partial<Record<AiProviderType, string>> | null {
  try {
    const raw = session?.getItem(SESSION_KEYS_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const keys: Partial<Record<AiProviderType, string>> = {};
    for (const provider of AI_PROVIDERS) {
      if (typeof parsed[provider] === 'string') keys[provider] = parsed[provider] as string;
    }
    return keys;
  } catch {
    return null;
  }
}

function writeSession(session: StorageLike | null | undefined, keys: Map<AiProviderType, string> | null) {
  try {
    if (!session) return;
    if (keys === null) session.removeItem(SESSION_KEYS_STORAGE);
    else session.setItem(SESSION_KEYS_STORAGE, JSON.stringify(Object.fromEntries(keys)));
  } catch {
    // sessionStorage bloqueado: la clave sigue en memoria.
  }
}

/** Crea un almacén con dependencias explícitas (inyectables en pruebas). */
export function createApiKeyStore({ desktop, invoke, session }: ApiKeyStoreDeps): ApiKeyStore {
  const memory = new Map<AiProviderType, string>();
  let remember = !desktop && readSession(session) !== null;
  for (const [provider, key] of Object.entries(readSession(session) ?? {})) {
    if (key) memory.set(provider as AiProviderType, key);
  }

  const callNative = async <T>(command: string, args: Record<string, unknown>): Promise<T> => {
    const run = invoke ?? (await import('@tauri-apps/api/core')).invoke;
    return run<T>(command, args);
  };

  return {
    desktop,
    async load(provider) {
      assertProvider(provider);
      const cached = memory.get(provider);
      if (cached !== undefined || !desktop) return cached ?? '';
      const stored = await callNative<string | null>('ai_key_get', { provider });
      if (stored) memory.set(provider, stored);
      return stored ?? '';
    },
    async save(provider, key) {
      assertProvider(provider);
      const value = key.trim();
      if (value) memory.set(provider, value);
      else memory.delete(provider);
      if (desktop) {
        await (value
          ? callNative<void>('ai_key_set', { provider, secret: value })
          : callNative<void>('ai_key_delete', { provider }));
      } else if (remember) {
        writeSession(session, memory);
      }
    },
    rememberInSession: () => remember,
    setRememberInSession(next) {
      if (desktop) return;
      remember = next;
      writeSession(session, next ? memory : null);
    },
  };
}

function browserSession(): StorageLike | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** `localStorage` del navegador o `null` si no existe o está bloqueado. */
export function browserLocalStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

let defaultStore: ApiKeyStore | null = null;

/** Almacén de la aplicación según la plataforma en ejecución. */
export function getApiKeyStore(): ApiKeyStore {
  defaultStore ??= createApiKeyStore({ desktop: isTauriRuntime(), session: browserSession() });
  return defaultStore;
}

export interface LegacyAiKey {
  provider: AiProviderType;
  apiKey: string;
  /** Resuelve `true` si la clave quedó en el nuevo almacén; `false` si solo queda en memoria. */
  saved: Promise<boolean>;
}

/**
 * Si la configuración IA de `localStorage` aún contiene `apiKey`, la quita de inmediato (de forma
 * síncrona, antes de que nada más lea la configuración) y la mueve al almacén nuevo. En web la clave
 * migrada se marca como "recordar en esta sesión" para no perderla en la pestaña actual.
 */
export function migrateLegacyApiKey(
  local: StorageLike | null,
  configKey: string,
  store: ApiKeyStore,
): LegacyAiKey | null {
  let parsed: Record<string, unknown>;
  try {
    const raw = local?.getItem(configKey);
    if (!raw) return null;
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || !('apiKey' in parsed)) return null;

  const { apiKey, ...rest } = parsed;
  try {
    local?.setItem(configKey, JSON.stringify(rest));
  } catch {
    try {
      local?.removeItem(configKey);
    } catch {
      // Sin acceso de escritura no hay nada más que hacer.
    }
  }
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) return null;
  const provider = AI_PROVIDERS.includes(rest.provider as AiProviderType)
    ? (rest.provider as AiProviderType)
    : 'gemini';
  if (!store.desktop) store.setRememberInSession(true);
  const saved = store.save(provider, key).then(() => true, () => false);
  return { provider, apiKey: key, saved };
}
