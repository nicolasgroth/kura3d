/**
 * @file mcp-server/src/bridge.ts
 * @description Servidor WebSocket local (`127.0.0.1`) que actúa como puente en tiempo real
 * entre el servidor MCP de Kura3D y la interfaz gráfica (escritorio Tauri o navegador web).
 * Seguridad: token obligatorio (sin token el puente no se habilita), validación de Host y Origin
 * contra DNS rebinding, límite de tamaño de mensaje, rate-limit de comandos y de autenticaciones
 * fallidas, rotación de token con revocación inmediata y modo Solo Lectura aplicado en servidor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  MIN_TOKEN_LENGTH,
  ROTATION_TOKEN_PATTERN,
  parseBooleanFlag,
  resolveBridgeConfig,
  writeTokenFile,
  type BridgeConfigOverrides,
  type ResolvedBridgeConfig,
} from './config.js';
import { uiCommandResponseSchema, uiControlMessageSchema } from './schemas.js';
import { READ_COMMANDS, isReadCommand } from '../../src/core/commands/commandPolicy';
import type { KuraCommandName, KuraCommandRequest, KuraCommandResponse } from './types.js';

/** Comandos permitidos en modo Solo Lectura (derivado de `src/core/commands/commandPolicy.ts`). */
export const READ_ONLY_COMMANDS: ReadonlySet<KuraCommandName> = new Set(READ_COMMANDS);

/** Versión del protocolo de control del puente (mensajes `type`). */
export const BRIDGE_PROTOCOL_VERSION = 1;
/** Código de cierre WebSocket enviado a las sesiones cuyo token fue revocado por rotación. */
export const CLOSE_TOKEN_ROTATED = 4001;

/** Entrada de petición pendiente de respuesta desde el cliente Kura3D conectado. */
interface PendingRequest {
  resolve: (value: KuraCommandResponse) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

/** Opciones de configuración y seguridad para el puente WebSocket local. */
export interface KuraBridgeOptions extends BridgeConfigOverrides {
  /** Tiempo máximo de espera por comando en milisegundos. */
  defaultTimeoutMs?: number;
  /** Argumentos CLI a considerar (por defecto ninguno; `index.ts` pasa `process.argv`). */
  argv?: readonly string[];
}

/** Resultado de una rotación de token. */
export interface TokenRotationResult {
  ok: boolean;
  persistent: boolean;
  reason?: string;
}

/**
 * Valida que el encabezado `Origin` corresponda a orígenes locales autorizados (clientes nativos
 * sin Origin, localhost, 127.0.0.1 o webview de Tauri), bloqueando páginas web ajenas.
 */
export function isAllowedLocalOrigin(origin: string | undefined): boolean {
  if (!origin || origin.trim() === '') {
    return true;
  }
  const normalized = origin.trim();
  return (
    /^http:\/\/localhost(:\d+)?$/i.test(normalized) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(normalized) ||
    /^tauri:\/\/localhost$/i.test(normalized) ||
    /^https?:\/\/tauri\.localhost$/i.test(normalized)
  );
}

/**
 * Valida el encabezado `Host` contra DNS rebinding: solo `127.0.0.1:<puerto>` o `localhost:<puerto>`.
 */
export function isAllowedLocalHost(host: string | undefined, port: number): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  return h === `127.0.0.1:${port}` || h === `localhost:${port}`;
}

/** Compara dos secretos en tiempo constante (hash SHA-256 para no filtrar la longitud). */
export function constantTimeEquals(expected: string, received: string): boolean {
  const a = createHash('sha256').update(expected, 'utf8').digest();
  const b = createHash('sha256').update(received, 'utf8').digest();
  return timingSafeEqual(a, b) && expected.length === received.length;
}

/**
 * Puente WebSocket seguro (ligado exclusivamente a `127.0.0.1`) que permite
 * ejecutar herramientas MCP directamente sobre la escena activa en Kura3D.
 */
export class KuraBridgeServer {
  private readonly host = '127.0.0.1';
  private readonly config: ResolvedBridgeConfig;
  private port: number;
  private authToken: string;
  private uiReadOnly = false;
  private readonly defaultTimeoutMs: number;
  private wss: WebSocketServer | null = null;
  private activeClient: WebSocket | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private commandTimestamps: number[] = [];
  private authFailureTimestamps: number[] = [];
  private listening = false;
  private startupError: string | null = null;

  constructor(options: KuraBridgeOptions = {}) {
    this.config = resolveBridgeConfig(options, process.env, options.argv ?? []);
    this.port = this.config.port;
    this.authToken = this.config.authToken;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;
  }

  /**
   * Inicia el servidor WebSocket local. Devuelve `false` sin abrir el puerto si no hay token
   * válido configurado (el puente nunca se habilita sin autenticación) o si el puerto está ocupado.
   */
  async start(): Promise<boolean> {
    if (this.wss) {
      return this.listening;
    }

    if (this.authToken.length < MIN_TOKEN_LENGTH) {
      this.startupError =
        this.authToken.length === 0
          ? 'Puente WebSocket deshabilitado: falta KURA_BRIDGE_TOKEN (o --token-file). Modo Headless disponible.'
          : `WebSocket bridge disabled: the token must have at least ${MIN_TOKEN_LENGTH} characters.`;
      console.error(`[Kura3D-MCP] ${this.startupError}`);
      this.listening = false;
      return false;
    }
    this.startupError = null;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const wss = new WebSocketServer({
        host: this.host,
        port: this.port,
        maxPayload: this.config.maxMessageBytes,
        perMessageDeflate: false,
        verifyClient: (info, done) => this.verifyClient(info.req, info.origin, done),
      });

      this.wss = wss;

      wss.once('listening', () => {
        const address = wss.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
        }
        this.listening = true;
        console.error(`[Kura3D-MCP] Puente WebSocket escuchando en ws://${this.host}:${this.port}`);
        if (!settled) {
          settled = true;
          resolve(true);
        }
      });

      wss.on('connection', (socket, req) => this.handleConnection(socket, req));

      wss.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(
            `[Kura3D-MCP] Puerto ${this.port} ocupado por otra instancia; continuando en modo Headless.`
          );
        } else {
          console.error(`[Kura3D-MCP] Error en puente WebSocket: ${err.message}`);
        }
        this.listening = false;
        if (!settled) {
          settled = true;
          try {
            wss.close();
          } catch {
            // Sin acción adicional si ya estaba cerrado
          }
          this.wss = null;
          resolve(false);
        }
      });
    });
  }

  /** Indica si hay una instancia viva de la UI de Kura3D conectada al puente. */
  isConnected(): boolean {
    return this.activeClient !== null && this.activeClient.readyState === WebSocket.OPEN;
  }

  /** Indica si el servidor WebSocket está escuchando activamente. */
  isListening(): boolean {
    return this.listening;
  }

  /** Motivo por el que el puente no se habilitó (o `null`). */
  getStartupError(): string | null {
    return this.startupError;
  }

  /** Devuelve el puerto actual asignado al puente WebSocket. */
  getPort(): number {
    return this.port;
  }

  /**
   * Modo Solo Lectura efectivo: impuesto por el servidor (CLI/env/opciones) o solicitado por la UI
   * en el handshake (`readOnly=1`). La solicitud de la UI se conserva tras desconectarse.
   */
  isReadOnly(): boolean {
    return this.config.readOnly || this.uiReadOnly;
  }

  /** Solo lectura impuesto por el operador del servidor (no lo puede desactivar la UI). */
  isServerReadOnly(): boolean {
    return this.config.readOnly;
  }

  /** Indica si hay un token válido configurado (requisito para habilitar el puente). */
  hasAuthToken(): boolean {
    return this.authToken.length >= MIN_TOKEN_LENGTH;
  }

  /** Indica si las rotaciones de token sobreviven a un reinicio (hay archivo de token). */
  isRotationPersistent(): boolean {
    return this.config.tokenFile !== null;
  }

  /** Directorio raíz permitido para exportaciones a disco. */
  getExportDir(): string {
    return this.config.exportDir;
  }

  /** Tamaño máximo aceptado por mensaje WebSocket entrante, en bytes. */
  getMaxMessageBytes(): number {
    return this.config.maxMessageBytes;
  }

  /** Devuelve el límite máximo configurado de comandos por minuto. */
  getRateLimitPerMin(): number {
    return this.config.rateLimitPerMin;
  }

  /**
   * Registra y valida una ejecución de comando dentro de una ventana deslizante de 60 segundos.
   * Lanza un error descriptivo en español si se supera `rateLimitPerMin`.
   */
  consumeRateLimit(): void {
    const now = Date.now();
    this.commandTimestamps = this.commandTimestamps.filter((ts) => ts > now - 60_000);
    if (this.commandTimestamps.length >= this.config.rateLimitPerMin) {
      throw new Error(
        `MCP rate limit exceeded (${this.config.rateLimitPerMin} commands/minute). Wait a few seconds before retrying.`
      );
    }
    this.commandTimestamps.push(now);
  }

  /**
   * Rota el token: el anterior queda revocado de inmediato, se persiste si hay archivo de token
   * y se cierran todas las sesiones autenticadas con el token viejo (código 4001).
   */
  async rotateToken(newToken: string): Promise<TokenRotationResult> {
    if (!ROTATION_TOKEN_PATTERN.test(newToken)) {
      return { ok: false, persistent: false, reason: 'Invalid token format (32–256 URL-safe characters).' };
    }
    if (constantTimeEquals(this.authToken, newToken)) {
      return { ok: false, persistent: false, reason: 'The new token is equal to the current one.' };
    }

    this.authToken = newToken;
    let persistent = false;
    if (this.config.tokenFile) {
      try {
        await writeTokenFile(this.config.tokenFile, newToken);
        persistent = true;
      } catch (err) {
        console.error(
          `[Kura3D-MCP] No se pudo persistir el token rotado: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    console.error(
      `[Kura3D-MCP] Token del puente rotado (${persistent ? 'persistente' : 'solo en memoria hasta reiniciar'}).`
    );
    return { ok: true, persistent };
  }

  /** Envía un comando al frontend de Kura3D y espera su respuesta JSON correlacionada por `id`. */
  async sendCommand(
    command: KuraCommandName,
    params: Record<string, unknown> = {},
    timeoutMs: number = this.defaultTimeoutMs,
    options?: { skipRateLimit?: boolean }
  ): Promise<KuraCommandResponse> {
    if (this.isReadOnly() && !isReadCommand(command)) {
      throw new Error('Operation blocked: Kura3D MCP is in Read-only mode.');
    }

    if (!options?.skipRateLimit) {
      this.consumeRateLimit();
    }

    const client = this.activeClient;
    if (!client || client.readyState !== WebSocket.OPEN) {
      throw new Error('No Kura3D instance is connected to the WebSocket bridge.');
    }

    const id = randomUUID();
    const payload: KuraCommandRequest = { id, command, params };

    return new Promise<KuraCommandResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(`Timed out (${timeoutMs} ms) running command '${command}' in Kura3D.`)
        );
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      client.send(JSON.stringify(payload), (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new Error(`Error sending command '${command}' over WebSocket: ${err.message}`));
        }
      });
    });
  }

  /** Cierra ordenadamente las conexiones activas y libera el puerto TCP local. */
  async close(): Promise<void> {
    this.rejectAllPending(new Error('The Kura3D bridge server was stopped.'));

    if (this.activeClient) {
      try {
        this.activeClient.close(1000, 'MCP server stopped');
      } catch {
        // Ignora errores de cierre
      }
      this.activeClient = null;
    }

    if (!this.wss) {
      this.listening = false;
      return;
    }

    const server = this.wss;
    this.wss = null;
    this.listening = false;
    for (const client of server.clients) {
      client.terminate();
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  /** Valida throttle de fallos, Host, Origin y token antes de aceptar el upgrade WebSocket. */
  private verifyClient(
    req: IncomingMessage,
    origin: string | undefined,
    done: (result: boolean, code?: number, message?: string) => void
  ): void {
    const reject = (code: number, message: string) => {
      console.error(`[Kura3D-MCP] Conexión WebSocket rechazada (${code}): ${message}`);
      done(false, code, message);
    };

    // Los rechazos por Host/Origin no cuentan para el throttle: una página ajena
    // no debe poder bloquear al cliente legítimo provocando fallos en masa.
    if (!isAllowedLocalHost(req.headers.host, this.port)) {
      reject(403, 'Host not allowed (127.0.0.1/localhost only).');
      return;
    }
    if (!isAllowedLocalOrigin(origin ?? req.headers.origin)) {
      reject(403, 'Origin not allowed on the local Kura3D bridge.');
      return;
    }
    // El throttle se aplica antes de mirar el token (también al correcto) para que
    // no sirva de oráculo en un ataque de fuerza bruta. Solo lo alimentan los 401:
    // un navegador no puede falsificar Origin, así que una web ajena nunca llega aquí.
    const now = Date.now();
    this.authFailureTimestamps = this.authFailureTimestamps.filter((ts) => ts > now - 60_000);
    if (this.authFailureTimestamps.length >= this.config.authFailureLimitPerMin) {
      done(false, 429, 'Too many failed attempts; wait a minute.');
      return;
    }
    if (!this.verifyRequestToken(req)) {
      this.authFailureTimestamps.push(now);
      reject(401, 'Authentication token missing or invalid.');
      return;
    }
    done(true);
  }

  /** Registra la sesión de la UI, aplica la preferencia de solo lectura y envía el saludo. */
  private handleConnection(socket: WebSocket, req: IncomingMessage): void {
    if (this.activeClient && this.activeClient !== socket) {
      // Las solicitudes en vuelo eran del cliente anterior: se rechazan ya, sin esperar el timeout.
      this.rejectAllPending(new Error('The Kura3D instance was replaced by another before responding.'));
      try {
        this.activeClient.close(1000, 'Replaced by a new Kura3D instance');
      } catch {
        // Ignora errores al cerrar conexiones previas obsoletas
      }
    }

    this.activeClient = socket;
    this.uiReadOnly = this.parseUiReadOnly(req);
    console.error('[Kura3D-MCP] UI de Kura3D conectada en modo Live Bridge.');

    this.sendControl(socket, {
      type: 'hello',
      protocol: BRIDGE_PROTOCOL_VERSION,
      readOnly: this.isReadOnly(),
      serverReadOnly: this.config.readOnly,
      readCommands: READ_COMMANDS,
      rotationPersistent: this.isRotationPersistent(),
      maxMessageBytes: this.config.maxMessageBytes,
    });

    socket.on('message', (raw, isBinary) => {
      if (isBinary) return;
      void this.handleMessage(socket, raw.toString());
    });

    socket.on('close', () => {
      if (this.activeClient === socket) {
        this.activeClient = null;
        this.rejectAllPending(
          new Error('The connection to the Kura3D UI closed before the command completed.')
        );
        console.error('[Kura3D-MCP] UI de Kura3D desconectada. Modo Headless disponible.');
      }
    });

    socket.on('error', (err) => {
      console.error(`[Kura3D-MCP] Error en socket cliente: ${err.message}`);
    });
  }

  /** Procesa respuestas a comandos y mensajes de control (rotación de token). */
  private async handleMessage(socket: WebSocket, rawText: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('[Kura3D-MCP] Mensaje WebSocket inválido (JSON malformado).');
      return;
    }

    if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
      const control = uiControlMessageSchema.safeParse(parsed);
      if (control.success && control.data.type === 'rotate_token') {
        const result = await this.rotateToken(control.data.token);
        if (!result.ok) {
          this.sendControl(socket, { type: 'token_rotation_failed', reason: result.reason });
          return;
        }
        this.sendControl(socket, { type: 'token_rotated', persistent: result.persistent });
        this.revokeAllSessions();
      }
      return;
    }

    const response = uiCommandResponseSchema.safeParse(parsed);
    if (!response.success) {
      return;
    }
    const entry = this.pending.get(response.data.id);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    this.pending.delete(response.data.id);
    entry.resolve(response.data as KuraCommandResponse);
  }

  /** Cierra todas las sesiones abiertas (token revocado); la UI se reconecta con el token nuevo. */
  private revokeAllSessions(): void {
    if (!this.wss) return;
    for (const client of this.wss.clients) {
      try {
        client.close(CLOSE_TOKEN_ROTATED, 'Token rotated');
      } catch {
        client.terminate();
      }
    }
  }

  private sendControl(socket: WebSocket, message: Record<string, unknown>): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private parseUiReadOnly(req: IncomingMessage): boolean {
    try {
      const url = new URL(req.url ?? '/', `http://${this.host}`);
      return parseBooleanFlag(url.searchParams.get('readOnly') ?? undefined) ?? false;
    } catch {
      return false;
    }
  }

  /** Rechaza todas las peticiones en vuelo ante desconexión o apagado del servidor. */
  private rejectAllPending(error: Error): void {
    for (const [id, entry] of this.pending.entries()) {
      clearTimeout(entry.timer);
      entry.reject(error);
      this.pending.delete(id);
    }
  }

  /**
   * Extrae el token de `Authorization: Bearer <token>` o del query `?token=<token>` y lo compara
   * en tiempo constante con el token vigente. Sin token vigente, rechaza siempre.
   */
  private verifyRequestToken(req: IncomingMessage): boolean {
    if (!this.hasAuthToken()) {
      return false;
    }

    let candidate = '';
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string') {
      const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
      if (match) {
        candidate = match[1].trim();
      }
    }

    if (!candidate && req.url) {
      try {
        const parsedUrl = new URL(req.url, `http://${this.host}`);
        candidate = (parsedUrl.searchParams.get('token') ?? '').trim();
      } catch {
        return false;
      }
    }

    if (!candidate || candidate.length > 512) {
      return false;
    }
    return constantTimeEquals(this.authToken, candidate);
  }
}
