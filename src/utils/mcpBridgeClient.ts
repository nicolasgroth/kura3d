/**
 * @file src/utils/mcpBridgeClient.ts
 * @description Cliente WebSocket controlado por el usuario para conectar Kurra3D Studio con el servidor MCP local.
 * Cuando `mcpConfig.enabled` es false, no realiza ningún intento de conexión ni reconexión.
 * Cuando está activo, usa `ws://127.0.0.1:${port}` con token obligatorio y declara su preferencia de
 * solo lectura en el handshake. La política lectura/escritura se importa de `src/core/commands/commandPolicy.ts`
 * (fuente única). Expone el estado del puente y la rotación efectiva del token en el servidor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { isKnownCommand, isReadCommand } from '../core/commands/commandPolicy';
import type {
  KuraCommandRequest,
  KuraCommandResponse,
  McpConfig,
} from '../types/kura';
import { probeBridgeServer, type McpBridgeErrorReason, type McpBridgePhase } from './mcpBridgeHealth';
import { validateMcpToken } from './mcpTokenStore';

export type { McpBridgeErrorReason, McpBridgePhase } from './mcpBridgeHealth';

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

/**
 * Indica si un comando llegado por MCP puede ejecutarse con la preferencia de solo lectura dada.
 * Usa la misma política que el servidor (`src/core/commands/commandPolicy.ts`); comandos desconocidos se rechazan.
 */
export function isMcpCommandAllowed(command: string, readOnly: boolean): boolean {
  if (!isKnownCommand(command)) return false;
  return !readOnly || isReadCommand(command);
}

/** Estado observable del puente (no persistido; nunca contiene el token). */
export interface McpBridgeStatus {
  phase: McpBridgePhase;
  /** Solo lectura efectivo informado por el servidor en el saludo. */
  effectiveReadOnly: boolean;
  /** Solo lectura impuesto por el servidor (CLI/env), que la UI no puede desactivar. */
  serverReadOnly: boolean;
  /** Si la última rotación sobrevive a reinicios del servidor (archivo de token). */
  rotationPersistent: boolean;
  /** Motivo cuando `phase === 'error'`. */
  error: McpBridgeErrorReason | null;
}

const INITIAL_STATUS: McpBridgeStatus = {
  phase: 'off',
  effectiveReadOnly: false,
  serverReadOnly: false,
  rotationPersistent: false,
  error: null,
};

/** Store mínimo del estado del puente MCP (separado de `useKuraStore` para no agrandarlo). */
export const useMcpBridgeStatus = create<McpBridgeStatus>(() => ({ ...INITIAL_STATUS }));

function setStatus(patch: Partial<McpBridgeStatus>): void {
  useMcpBridgeStatus.setState(patch);
}

export interface McpBridgeOptions {
  url?: string;
  config?: McpConfig;
  executeCommand: (
    req: KuraCommandRequest,
    source?: 'ui' | 'mcp' | 'ai',
  ) => Promise<KuraCommandResponse>;
  onStatusChange?: (connected: boolean) => void;
  /** Sondeo del puerto local tras un cierre sin abrir (inyectable en pruebas). */
  probe?: (port: number) => Promise<boolean>;
}

const MIN_RECONNECT_MS = 5000;
const MAX_RECONNECT_MS = 60000;
const RECONNECT_FACTOR = 2;

/** Siguiente espera de reconexión: crece de forma exponencial hasta el tope (menos ruido en consola). */
export function nextReconnectDelay(currentMs: number): number {
  return Math.min(MAX_RECONNECT_MS, Math.round(currentMs * RECONNECT_FACTOR));
}
export const RECONNECT_DELAYS = { min: MIN_RECONNECT_MS, max: MAX_RECONNECT_MS } as const;
/** Reconexión rápida tras una rotación de token (código de cierre 4001 del servidor). */
const ROTATION_RECONNECT_MS = 300;
const CLOSE_TOKEN_ROTATED = 4001;
const ROTATION_TIMEOUT_MS = 5000;

/** Socket autenticado vigente (para enviar la rotación por el canal ya autenticado). */
let activeSocket: WebSocket | null = null;

interface PendingRotation {
  resolve: (result: McpTokenRotationResult) => void;
  timer: ReturnType<typeof setTimeout>;
}
let pendingRotation: PendingRotation | null = null;

/** Resultado de solicitar la rotación del token al servidor. */
export type McpTokenRotationResult =
  /** Rotado y persistido en el servidor (archivo de token). */
  | 'rotated'
  /** Rotado en el servidor solo hasta su reinicio: hay que actualizar la configuración del cliente MCP. */
  | 'rotated_volatile'
  /** Sin conexión: el servidor no se enteró; el token nuevo solo vale tras configurarlo y reiniciarlo. */
  | 'offline'
  /** El servidor rechazó la rotación o no respondió: se conserva el token vigente. */
  | 'failed';

function settleRotation(result: McpTokenRotationResult): void {
  if (!pendingRotation) return;
  clearTimeout(pendingRotation.timer);
  pendingRotation.resolve(result);
  pendingRotation = null;
}

/**
 * Pide al servidor que rote su token por `newToken` usando la sesión autenticada vigente.
 * El servidor revoca el token anterior y cierra la sesión; el cliente se reconecta con el nuevo
 * cuando el llamador guarda `newToken` en `mcpConfig`. Solo guarda el token si el resultado no es `failed`.
 */
export function rotateMcpBridgeToken(newToken: string): Promise<McpTokenRotationResult> {
  const socket = activeSocket;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return Promise.resolve('offline');
  }
  settleRotation('failed');
  setStatus({ phase: 'rotating' });
  return new Promise<McpTokenRotationResult>((resolve) => {
    const timer = setTimeout(() => {
      setStatus({ phase: 'connected' });
      settleRotation('failed');
    }, ROTATION_TIMEOUT_MS);
    pendingRotation = { resolve, timer };
    socket.send(JSON.stringify({ type: 'rotate_token', token: newToken }));
  });
}

/** Construye la URL local del puente WebSocket MCP con token obligatorio y preferencia de solo lectura. */
export function buildMcpWsUrl(config?: McpConfig, explicitUrl?: string): string {
  if (explicitUrl) return explicitUrl;
  const port = config?.port ?? 17432;
  const params = new URLSearchParams();
  const token = config?.authToken.trim() ?? '';
  if (token) params.set('token', token);
  if (config?.readOnly) params.set('readOnly', '1');
  const query = params.toString();
  return `ws://127.0.0.1:${port}${query ? `/?${query}` : ''}`;
}

/** Procesa mensajes de control del servidor (`hello`, `token_rotated`, `token_rotation_failed`). */
function handleControlMessage(message: Record<string, unknown>): void {
  switch (message.type) {
    case 'hello':
      setStatus({
        phase: 'connected',
        error: null,
        effectiveReadOnly: message.readOnly === true,
        serverReadOnly: message.serverReadOnly === true,
        rotationPersistent: message.rotationPersistent === true,
      });
      break;
    case 'token_rotated':
      setStatus({ phase: 'reconnecting', rotationPersistent: message.persistent === true });
      settleRotation(message.persistent === true ? 'rotated' : 'rotated_volatile');
      break;
    case 'token_rotation_failed':
      setStatus({ phase: 'connected' });
      settleRotation('failed');
      break;
    default:
      break;
  }
}

/**
 * Inicia una conexión WebSocket resiliente hacia el puente MCP local con backoff silencioso.
 * Si `config.enabled === false`, permanece completamente inactivo sin intentos de red.
 */
export function startMcpBridgeClient(options: McpBridgeOptions): () => void {
  if (options.config && !options.config.enabled) {
    options.onStatusChange?.(false);
    setStatus({ ...INITIAL_STATUS });
    return () => {};
  }

  // Token aún cargándose desde el almacén seguro: se espera sin conectar.
  const token = options.config?.authToken.trim() ?? '';
  if (options.config && !options.url && !token) {
    options.onStatusChange?.(false);
    setStatus({ ...INITIAL_STATUS, phase: 'connecting' });
    return () => {};
  }
  // Un token que el servidor rechazaría en silencio se informa en vez de reintentar sin fin.
  const tokenCheck = options.config && !options.url ? validateMcpToken(token) : 'ok';
  if (tokenCheck !== 'ok') {
    options.onStatusChange?.(false);
    setStatus({ ...INITIAL_STATUS, phase: 'error', error: tokenCheck === 'too-short' ? 'token-too-short' : 'token-invalid-chars' });
    return () => {};
  }

  const targetUrl = buildMcpWsUrl(options.config, options.url);
  const readOnly = options.config?.readOnly ?? false;
  const port = options.config?.port ?? 17432;
  const probe = options.probe ?? ((p: number) => probeBridgeServer(p));
  let opened = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let backoffMs = MIN_RECONNECT_MS;
  /** Un solo sondeo por caída: los siguientes fallos no repiten la petición (ni su error en consola). */
  let probedOutage = false;
  let disposed = false;

  const scheduleReconnect = (delayMs = backoffMs) => {
    if (disposed || reconnectTimer !== null) {
      return;
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delayMs);
    backoffMs = nextReconnectDelay(backoffMs);
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
      setStatus({ phase: 'error', error: 'insecure-context' });
      return;
    }

    const phase = useMcpBridgeStatus.getState().phase;
    if (phase !== 'reconnecting' && phase !== 'waiting' && phase !== 'error') {
      setStatus({ phase: 'connecting', error: null });
    }
    opened = false;

    try {
      socket = new WebSocket(targetUrl);
    } catch {
      options.onStatusChange?.(false);
      scheduleReconnect();
      return;
    }
    const current = socket;

    current.addEventListener('open', () => {
      if (disposed) {
        current.close();
        return;
      }
      backoffMs = MIN_RECONNECT_MS;
      probedOutage = false;
      opened = true;
      activeSocket = current;
      options.onStatusChange?.(true);
    });

    current.addEventListener('message', async (event) => {
      if (typeof event.data !== 'string') {
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      if (parsed.type === 'ping') {
        if (current.readyState === WebSocket.OPEN) {
          current.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
        return;
      }
      if (typeof parsed.type === 'string') {
        handleControlMessage(parsed);
        return;
      }

      if (
        typeof parsed.id !== 'string' ||
        parsed.id.length === 0 ||
        parsed.id.length > 128 ||
        typeof parsed.command !== 'string'
      ) {
        return;
      }

      let response: KuraCommandResponse;
      if (!isMcpCommandAllowed(parsed.command, readOnly)) {
        response = {
          id: parsed.id,
          ok: false,
          error: isKnownCommand(parsed.command)
            ? 'MCP en modo solo lectura.'
            : 'Comando MCP desconocido.',
        };
      } else {
        const req: KuraCommandRequest = {
          id: parsed.id,
          command: parsed.command as KuraCommandRequest['command'],
          params:
            parsed.params && typeof parsed.params === 'object' && !Array.isArray(parsed.params)
              ? (parsed.params as Record<string, unknown>)
              : {},
        };
        try {
          response = await options.executeCommand(req, 'mcp');
        } catch (err) {
          response = {
            id: req.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      if (current.readyState === WebSocket.OPEN) {
        current.send(JSON.stringify(response));
      }
    });

    current.addEventListener('close', (event) => {
      if (activeSocket === current) activeSocket = null;
      socket = null;
      options.onStatusChange?.(false);
      if (disposed) return;
      if (event.code === CLOSE_TOKEN_ROTATED) {
        setStatus({ phase: 'reconnecting' });
        backoffMs = MIN_RECONNECT_MS;
        scheduleReconnect(ROTATION_RECONNECT_MS);
        return;
      }
      settleRotation('failed');
      if (opened) {
        setStatus({ phase: 'connecting', error: null });
      } else if (!probedOutage) {
        probedOutage = true;
        // Sin apertura: o no hay servidor, o rechazó el token/origen (el navegador oculta el 401).
        void probe(port).then((listening) => {
          if (disposed) return;
          setStatus(listening ? { phase: 'error', error: 'rejected' } : { phase: 'waiting', error: null });
        });
      }
      scheduleReconnect();
    });

    current.addEventListener('error', () => {
      if (current.readyState === WebSocket.OPEN) {
        current.close();
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
      if (activeSocket === socket) activeSocket = null;
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
  const { enabled, port, requireAuth, authToken, readOnly } = mcpConfig;

  useEffect(() => {
    if (!enabled) {
      onStatusChange(false);
      setStatus({ ...INITIAL_STATUS });
      return;
    }

    return startMcpBridgeClient({
      config: { enabled, port, requireAuth, authToken, readOnly },
      executeCommand,
      onStatusChange,
    });
  }, [enabled, port, requireAuth, authToken, readOnly, executeCommand, onStatusChange]);
}
