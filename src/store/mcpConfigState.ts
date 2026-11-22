/**
 * @file src/store/mcpConfigState.ts
 * @description Configuración del puente MCP sin secretos en `localStorage`: lectura de la parte
 * persistible (activado, puerto, solo lectura), serialización sin `authToken` e hidratación del
 * token desde su almacén seguro (`utils/mcpTokenStore`), migrando el token antiguo en claro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { McpConfig } from '../types/kura';
import {
  generateRandomTokenHex,
  type McpTokenStore,
} from '../utils/mcpTokenStore';

export const DEFAULT_MCP_PORT = 17432;

/** Configuración inicial sin token (el token llega con `hydrateMcpToken`). */
export function parseStoredMcpConfig(raw: string | null): McpConfig {
  const defaults: McpConfig = { enabled: false, port: DEFAULT_MCP_PORT, requireAuth: true, authToken: '', readOnly: false };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<McpConfig>;
    const port =
      typeof parsed.port === 'number' && parsed.port >= 1024 && parsed.port <= 65535
        ? Math.round(parsed.port)
        : defaults.port;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaults.enabled,
      port,
      // El puente exige token siempre (TRUST-02): se ignora cualquier `requireAuth: false` heredado.
      requireAuth: true,
      authToken: '',
      readOnly: typeof parsed.readOnly === 'boolean' ? parsed.readOnly : defaults.readOnly,
    };
  } catch {
    return defaults;
  }
}

/** JSON persistible en `localStorage`: nunca incluye el token. */
export function persistableMcpConfig(config: McpConfig): string {
  const { enabled, port, readOnly } = config;
  return JSON.stringify({ enabled, port, readOnly });
}

/**
 * Obtiene el token desde el almacén seguro. Si no hay, usa el token migrado de `localStorage` o
 * genera uno nuevo, y lo guarda. Devuelve el token y si quedó guardado.
 */
export async function hydrateMcpToken(
  store: McpTokenStore,
  legacyToken: string | null,
): Promise<{ token: string; saved: boolean }> {
  let stored: string | null = null;
  try {
    stored = await store.load();
  } catch {
    stored = null;
  }
  if (stored && !legacyToken) return { token: stored, saved: true };
  // El token migrado manda: es el que el usuario ya configuró en su cliente MCP.
  const token = legacyToken ?? stored ?? generateRandomTokenHex(32);
  if (token === stored) return { token, saved: true };
  try {
    await store.save(token);
    return { token, saved: true };
  } catch {
    return { token, saved: false };
  }
}
