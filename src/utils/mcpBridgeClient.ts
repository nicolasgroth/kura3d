/**
 * @file src/utils/mcpBridgeClient.ts
 * @description Cliente WebSocket controlado por el usuario para conectar Kura3D con el servidor MCP local.
 * Cuando `mcpConfig.enabled` es false, no realiza ningún intento de conexión ni reconexión.
 * Cuando está activo, usa `ws://127.0.0.1:${port}` y token opcional `?token=...`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect } from 'react';
import type {
  KuraCommandRequest,
  KuraCommandResponse,
  McpConfig,
} from '../types/kura';

/** Callback registrado por Viewport3D para capturar el canvas WebGL en PNG base64. */
type ViewportCaptureFn = () => string | null;

let registeredCaptureFn: ViewportCaptureFn | null = null;

/**
 * Registra o limpia la función de captura de pantalla del visor 3D activo.
 */
export function registerViewportCapture(fn: ViewportCaptureFn | null): void {
  registeredCaptureFn = fn;
}

/**
 * Captura el fotograma actual del viewport 3D como Data URL PNG (o null si no está montado).
 */
export function captureViewportPng(): string | null {
  if (!registeredCaptureFn) {
    return null;
  }
  try {
    return registeredCaptureFn();
  } catch {
    return null;
  }
}

export interface McpBridgeOptions {
  url?: string;
  config?: McpConfig;
  executeCommand: (
    req: KuraCommandRequest,
    source?: 'ui' | 'mcp' | 'ai',
  ) => Promise<KuraCommandResponse>;
  onStatusChange?: (connected: boolean) => void;
}

const MIN_RECONNECT_MS = 3000;
const MAX_RECONNECT_MS = 20000;

/** Construye la URL local del puente WebSocket MCP respetando puerto y autenticación Bearer. */
export function buildMcpWsUrl(config?: McpConfig, explicitUrl?: string): string {
  if (explicitUrl) return explicitUrl;
  const port = config?.port ?? 17432;
  const base = `ws://127.0.0.1:${port}`;
  if (config?.requireAuth && config.authToken.trim()) {
    return `${base}?token=${encodeURIComponent(config.authToken.trim())}`;
  }
  return base;
}

/**
 * Inicia una conexión WebSocket resiliente hacia el puente MCP local con backoff silencioso.
 * Si `config.enabled === false`, permanece completamente inactivo sin intentos de red.
 */
export function startMcpBridgeClient(options: McpBridgeOptions): () => void {
  if (options.config && !options.config.enabled) {
    options.onStatusChange?.(false);
    return () => {};
  }

  const targetUrl = buildMcpWsUrl(options.config, options.url);
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let backoffMs = MIN_RECONNECT_MS;
  let disposed = false;

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer !== null) {
      return;
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, backoffMs);
    backoffMs = Math.min(MAX_RECONNECT_MS, Math.round(backoffMs * 1.6));
  };

  const connect = () => {
    if (disposed || typeof WebSocket === 'undefined') {
      return;
    }

    // Evita SecurityError si la app web se sirve bajo HTTPS remoto sin localhost.
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      options.onStatusChange?.(false);
      return;
    }

    try {
      socket = new WebSocket(targetUrl);
    } catch {
      options.onStatusChange?.(false);
      scheduleReconnect();
      return;
    }

    socket.addEventListener('open', () => {
      if (disposed) {
        socket?.close();
        return;
      }
      backoffMs = MIN_RECONNECT_MS;
      options.onStatusChange?.(true);
    });

    socket.addEventListener('message', async (event) => {
      if (typeof event.data !== 'string') {
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }

      if (parsed.type === 'ping') {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
        return;
      }

      if (typeof parsed.id !== 'string' || typeof parsed.command !== 'string') {
        return;
      }

      const req: KuraCommandRequest = {
        id: parsed.id,
        command: parsed.command as KuraCommandRequest['command'],
        params:
          parsed.params && typeof parsed.params === 'object'
            ? (parsed.params as Record<string, unknown>)
            : {},
      };

      let response: KuraCommandResponse;
      try {
        response = await options.executeCommand(req, 'mcp');
      } catch (err) {
        response = {
          id: req.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(response));
      }
    });

    socket.addEventListener('close', () => {
      socket = null;
      options.onStatusChange?.(false);
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    });
  };

  connect();

  return () => {
    disposed = true;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      try {
        socket.close();
      } catch {
        // Ignorar errores al cerrar durante el desmontaje.
      }
      socket = null;
    }
  };
}

/**
 * Hook React que observa `mcpConfig` y mantiene conectado/desconectado el puente MCP
 * según la preferencia del usuario.
 */
export function useMcpBridgeClient(
  mcpConfig: McpConfig,
  executeCommand: (
    req: KuraCommandRequest,
    source?: 'ui' | 'mcp' | 'ai',
  ) => Promise<KuraCommandResponse>,
  onStatusChange: (connected: boolean) => void,
): void {
  const { enabled, port, requireAuth, authToken } = mcpConfig;

  useEffect(() => {
    if (!enabled) {
      onStatusChange(false);
      return;
    }

    return startMcpBridgeClient({
      config: { enabled, port, requireAuth, authToken, readOnly: mcpConfig.readOnly },
      executeCommand,
      onStatusChange,
    });
  }, [enabled, port, requireAuth, authToken, mcpConfig.readOnly, executeCommand, onStatusChange]);
}
