/**
 * @file src/utils/mcpTokenStore.ts
 * @description Almacén del token del puente MCP fuera de `localStorage`:
 * - Escritorio (Tauri): llavero del sistema operativo vía `mcp_token_get` / `mcp_token_set`
 *   (`src-tauri/src/mcp_credentials.rs`, ranura `mcp-bridge`).
 * - Web: `sessionStorage` (se borra al cerrar la pestaña) o memoria si está bloqueado.
 * Incluye la migración del token antiguo guardado en claro en `localStorage['kura3d-mcp-config']`,
 * la validación de longitud mínima (la misma que exige el servidor) y el enmascarado para la UI.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isTauriRuntime } from './platformBridge';

/** Clave de la configuración MCP persistida (sin token desde la migración). */
export const MCP_CONFIG_STORAGE_KEY = 'kura3d-mcp-config';
/** Clave del token en `sessionStorage` (solo web). */
export const MCP_SESSION_TOKEN_KEY = 'kura3d-mcp-session-token';
/** Longitud mínima del token: debe coincidir con `MIN_TOKEN_LENGTH` de `mcp-server/src/config.ts`. */
export const MIN_MCP_TOKEN_LENGTH = 16;
const MAX_MCP_TOKEN_LENGTH = 512;

type Invoke = <T>(command: string, args: Record<string, unknown>) => Promise<T>;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type McpTokenValidation = 'ok' | 'too-short' | 'too-long' | 'invalid-chars';

/** Valida un token escrito a mano antes de aceptarlo (el servidor rechaza los cortos en silencio). */
export function validateMcpToken(token: string): McpTokenValidation {
  if (/[\s\u0000-\u001f\u007f]/.test(token)) return 'invalid-chars';
  if (token.length < MIN_MCP_TOKEN_LENGTH) return 'too-short';
  if (token.length > MAX_MCP_TOKEN_LENGTH) return 'too-long';
  return 'ok';
}

/** Token enmascarado de largo fijo (no revela la longitud): 12 puntos y los últimos 4 caracteres. */
export function maskToken(token: string): string {
  if (!token) return '';
  return '•'.repeat(12) + (token.length > 8 ? token.slice(-4) : '');
}

/** Token aleatorio hexadecimal con `crypto.getRandomValues`. */
export function generateRandomTokenHex(length = 32): string {
  const byteCount = Math.max(8, Math.ceil(length / 2));
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

function readStoredConfig(local: StorageLike | null): Record<string, unknown> | null {
  try {
    const raw = local?.getItem(MCP_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Token antiguo guardado en claro en `localStorage['kura3d-mcp-config']` (si es válido), sin borrarlo. */
export function readLegacyMcpToken(local: StorageLike | null): string | null {
  const parsed = readStoredConfig(local);
  const token = typeof parsed?.authToken === 'string' ? parsed.authToken.trim() : '';
  return validateMcpToken(token) === 'ok' ? token : null;
}

/** Borra el token antiguo de la configuración en `localStorage`, conservando el resto. */
export function forgetLegacyMcpToken(local: StorageLike | null): void {
  const parsed = readStoredConfig(local);
  if (!parsed || !('authToken' in parsed)) return;
  const { authToken: _removed, ...rest } = parsed;
  try {
    local!.setItem(MCP_CONFIG_STORAGE_KEY, JSON.stringify(rest));
  } catch {
    // Almacenamiento bloqueado: nada que borrar.
  }
}

export interface McpTokenStore {
  readonly desktop: boolean;
  /** Token guardado o null si no hay. */
  load(): Promise<string | null>;
  /** Guarda un token válido (lanza `mcp-token-invalid` si no lo es). */
  save(token: string): Promise<void>;
}

export interface McpTokenStoreDeps {
  desktop: boolean;
  invoke?: Invoke;
  session?: StorageLike | null;
}

/** Crea el almacén con dependencias explícitas (inyectables en pruebas). */
export function createMcpTokenStore({ desktop, invoke, session }: McpTokenStoreDeps): McpTokenStore {
  let memory: string | null = null;
  const callNative = async <T>(command: string, args: Record<string, unknown> = {}): Promise<T> => {
    const run = invoke ?? (await import('@tauri-apps/api/core')).invoke;
    return run<T>(command, args);
  };
  return {
    desktop,
    async load() {
      if (desktop) {
        const token = await callNative<string | null>('mcp_token_get');
        return typeof token === 'string' && validateMcpToken(token) === 'ok' ? token : null;
      }
      try {
        const stored = session?.getItem(MCP_SESSION_TOKEN_KEY);
        if (stored && validateMcpToken(stored) === 'ok') memory = stored;
      } catch {
        // sessionStorage bloqueado: queda la memoria.
      }
      return memory;
    },
    async save(token) {
      if (validateMcpToken(token) !== 'ok') throw new Error('mcp-token-invalid');
      if (desktop) {
        await callNative<void>('mcp_token_set', { token });
        return;
      }
      memory = token;
      try {
        session?.setItem(MCP_SESSION_TOKEN_KEY, token);
      } catch {
        // sessionStorage bloqueado: el token vive solo en memoria.
      }
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

let defaultStore: McpTokenStore | null = null;

/** Almacén de la aplicación según la plataforma en ejecución. */
export function getMcpTokenStore(): McpTokenStore {
  defaultStore ??= createMcpTokenStore({ desktop: isTauriRuntime(), session: browserSession() });
  return defaultStore;
}
