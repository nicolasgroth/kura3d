/**
 * @file src/utils/mcpBridgeHealth.ts
 * @description Diagnóstico del puente MCP para la interfaz: motivos de error (token corto, conexión
 * rechazada, contexto inseguro), sondeo HTTP del puerto local para distinguir "servidor apagado" de
 * "servidor que rechaza el token" (el navegador oculta el 401 del upgrade WebSocket) y la etiqueta
 * localizada del estado (Conectado / Esperando servidor / Error con motivo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../i18n';
import type { LanguageCode } from '../types/kura';

/** Motivos de error visibles del puente. */
export type McpBridgeErrorReason = 'token-too-short' | 'token-invalid-chars' | 'rejected' | 'insecure-context';

/** Fase visible del puente para Ajustes y barra superior. */
export type McpBridgePhase = 'off' | 'connecting' | 'waiting' | 'connected' | 'rotating' | 'reconnecting' | 'error';

const PROBE_TIMEOUT_MS = 1500;

/**
 * true si algo escucha en `127.0.0.1:port` (el servidor `ws` responde 426 a un GET normal; con
 * `no-cors` la respuesta es opaca pero la promesa se resuelve). false si nadie escucha.
 */
export async function probeBridgeServer(
  port: number,
  fetchImpl: typeof fetch | undefined = typeof fetch === 'function' ? fetch : undefined,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  if (!fetchImpl) return false;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    await fetchImpl(`http://127.0.0.1:${port}/`, { mode: 'no-cors', cache: 'no-store', signal: controller?.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Estado mínimo para describir el puente. */
export interface McpBridgeView {
  phase: McpBridgePhase;
  error: McpBridgeErrorReason | null;
}

/** Tono visual del indicador. */
export type McpBridgeTone = 'off' | 'online' | 'waiting' | 'error';

const REASON_KEYS = {
  'token-too-short': 'mcp.error.tokenTooShort',
  'token-invalid-chars': 'mcp.error.tokenInvalidChars',
  rejected: 'mcp.error.rejected',
  'insecure-context': 'mcp.error.insecureContext',
} as const;

/** Etiqueta localizada (larga para Ajustes, corta para la barra superior) y tono del estado. */
export function describeMcpBridge(
  lang: LanguageCode,
  enabled: boolean,
  view: McpBridgeView,
): { label: string; short: string; tone: McpBridgeTone } {
  if (!enabled || view.phase === 'off') {
    return { label: t(lang, 'topbar.mcpOff'), short: t(lang, 'topbar.mcpOff'), tone: 'off' };
  }
  switch (view.phase) {
    case 'connected':
      return { label: t(lang, 'mcp.status.connected'), short: t(lang, 'topbar.mcpConnected'), tone: 'online' };
    case 'rotating':
      return { label: t(lang, 'dialog.settings.mcpRotating'), short: t(lang, 'topbar.mcpWaiting'), tone: 'waiting' };
    case 'reconnecting':
      return { label: t(lang, 'dialog.settings.mcpReconnecting'), short: t(lang, 'topbar.mcpWaiting'), tone: 'waiting' };
    case 'error': {
      const reason = t(lang, REASON_KEYS[view.error ?? 'rejected']);
      return { label: t(lang, 'mcp.status.error', { reason }), short: t(lang, 'topbar.mcpError'), tone: 'error' };
    }
    default:
      return { label: t(lang, 'mcp.status.waiting'), short: t(lang, 'topbar.mcpWaiting'), tone: 'waiting' };
  }
}
