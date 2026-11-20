/**
 * @file mcp-server/src/bridge.ts
 * @description Servidor WebSocket local (`127.0.0.1`) que actúa como puente en tiempo real
 * entre el servidor MCP de Kura3D y la interfaz gráfica (escritorio Tauri o navegador web).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  KuraCommandName,
  KuraCommandRequest,
  KuraCommandResponse,
} from './types.js';

/** Entrada de petición pendiente de respuesta desde el cliente Kura3D conectado. */
interface PendingRequest {
  resolve: (value: KuraCommandResponse) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

/** Opciones de configuración para el puente WebSocket local. */
export interface KuraBridgeOptions {
  /** Puerto TCP local donde escuchar. Por defecto `process.env.KURA_BRIDGE_PORT || 17432`. */
  port?: number;
  /** Tiempo máximo de espera por comando en milisegundos. */
  defaultTimeoutMs?: number;
}

/**
 * Valida que el encabezado `Origin` de una conexión WebSocket entrante corresponda
 * únicamente a orígenes locales autorizados (clientes nativos sin Origin, localhost,
 * 127.0.0.1 o webview de Tauri), bloqueando conexiones de sitios web externos.
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
    /^https:\/\/tauri\.localhost$/i.test(normalized)
  );
}

/**
 * Puente WebSocket seguro (ligado exclusivamente a `127.0.0.1`) que permite
 * ejecutar herramientas MCP directamente sobre la escena activa en Kura3D.
 */
export class KuraBridgeServer {
  private readonly host = '127.0.0.1';
  private port: number;
  private readonly defaultTimeoutMs: number;
  private wss: WebSocketServer | null = null;
  private activeClient: WebSocket | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private listening = false;

  constructor(options: KuraBridgeOptions = {}) {
    const envPort = Number(process.env.KURA_BRIDGE_PORT || 17432);
    this.port = options.port ?? (Number.isFinite(envPort) && envPort >= 0 ? envPort : 17432);
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;
  }

  /** Inicia el servidor WebSocket local sin abortar el proceso si el puerto ya está ocupado. */
  async start(): Promise<boolean> {
    if (this.wss) {
      return this.listening;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const wss = new WebSocketServer({
        host: this.host,
        port: this.port,
        verifyClient: (info, done) => {
          const origin = info.origin ?? info.req.headers.origin;
          if (!isAllowedLocalOrigin(origin)) {
            console.error(
              `[Kura3D-MCP] Conexión WebSocket rechazada por origen no permitido: ${String(origin)}`
            );
            done(false, 403, 'Origen no permitido en el puente local de Kura3D');
            return;
          }
          done(true);
        },
      });

      this.wss = wss;

      wss.once('listening', () => {
        const address = wss.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
        }
        this.listening = true;
        console.error(
          `[Kura3D-MCP] Puente WebSocket escuchando en ws://${this.host}:${this.port}`
        );
        if (!settled) {
          settled = true;
          resolve(true);
        }
      });

      wss.on('connection', (socket) => {
        // Mantiene la conexión más reciente de la UI de Kura3D como cliente activo
        if (this.activeClient && this.activeClient !== socket) {
          try {
            this.activeClient.close(1000, 'Reemplazado por nueva instancia de Kura3D');
          } catch {
            // Ignora errores al cerrar conexiones previas obsoletas
          }
        }

        this.activeClient = socket;
        console.error('[Kura3D-MCP] UI de Kura3D conectada en modo Live Bridge.');

        socket.on('message', (raw) => {
          this.handleMessage(raw.toString('utf8'));
        });

        socket.on('close', () => {
          if (this.activeClient === socket) {
            this.activeClient = null;
            this.rejectAllPending(
              new Error('La conexión con la UI de Kura3D se cerró antes de completar el comando.')
            );
            console.error('[Kura3D-MCP] UI de Kura3D desconectada. Modo Headless disponible.');
          }
        });

        socket.on('error', (err) => {
          console.error(`[Kura3D-MCP] Error en socket cliente: ${err.message}`);
        });
      });

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

  /** Devuelve el puerto actual asignado al puente WebSocket. */
  getPort(): number {
    return this.port;
  }

  /** Envía un comando al frontend de Kura3D y espera su respuesta JSON correlacionada por `id`. */
  async sendCommand(
    command: KuraCommandName,
    params: Record<string, unknown> = {},
    timeoutMs: number = this.defaultTimeoutMs
  ): Promise<KuraCommandResponse> {
    const client = this.activeClient;
    if (!client || client.readyState !== WebSocket.OPEN) {
      throw new Error('No hay ninguna instancia de Kura3D conectada al puente WebSocket.');
    }

    const id = randomUUID();
    const payload: KuraCommandRequest = { id, command, params };

    return new Promise<KuraCommandResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Tiempo de espera agotado (${timeoutMs} ms) ejecutando el comando '${command}' en Kura3D.`
          )
        );
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      client.send(JSON.stringify(payload), (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new Error(`Error enviando comando '${command}' por WebSocket: ${err.message}`));
        }
      });
    });
  }

  /** Cierra ordenadamente las conexiones activas y libera el puerto TCP local. */
  async close(): Promise<void> {
    this.rejectAllPending(new Error('El servidor puente de Kura3D fue detenido.'));

    if (this.activeClient) {
      try {
        this.activeClient.close(1000, 'Servidor MCP detenido');
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

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  /** Procesa mensajes entrantes y resuelve la promesa correspondiente al `id`. */
  private handleMessage(rawText: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('[Kura3D-MCP] Mensaje WebSocket inválido (JSON malformado).');
      return;
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as KuraCommandResponse).id !== 'string'
    ) {
      return;
    }

    const response = parsed as KuraCommandResponse;
    const entry = this.pending.get(response.id);
    if (!entry) {
      return;
    }

    clearTimeout(entry.timer);
    this.pending.delete(response.id);
    entry.resolve(response);
  }

  /** Rechaza todas las peticiones en vuelo ante desconexión o apagado del servidor. */
  private rejectAllPending(error: Error): void {
    for (const [id, entry] of this.pending.entries()) {
      clearTimeout(entry.timer);
      entry.reject(error);
      this.pending.delete(id);
    }
  }
}
