/**
 * @file src/ai/aiTransport.ts
 * @description Transporte HTTP único para los proveedores IA, con tiempo límite y cancelación.
 * - Escritorio (Tauri): `invoke('ai_http_request')`; Rust valida el host contra la lista del usuario,
 *   lee la clave del llavero y la adjunta. La clave nunca pasa por el webview.
 * - Web: `fetch`, con la clave en memoria adjunta según la ranura (misma tabla que Rust).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { isTauriRuntime } from '../utils/platformBridge';
import { authSchemeFor, type AiKeySlot } from './providerCatalog';

export interface AiHttpRequest {
  url: string;
  method?: 'POST' | 'GET';
  headers?: Record<string, string>;
  body?: string;
  /** Ranura de la clave a adjuntar (o ninguna). */
  keySlot?: AiKeySlot;
  timeoutMs?: number;
}

export interface AiHttpResponse {
  status: number;
  body: string;
}

/** Error de transporte con código estable (`timeout`, `cancelled`, `network` o un código de Rust). */
export class AiTransportError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'AiTransportError';
  }
}

export type AiTransport = (request: AiHttpRequest, signal?: AbortSignal) => Promise<AiHttpResponse>;

type Invoke = <T>(command: string, args: Record<string, unknown>) => Promise<T>;

export const DEFAULT_AI_TIMEOUT_MS = 60_000;
const MAX_WEB_RESPONSE_CHARS = 8 * 1024 * 1024;

function newRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `ai_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Normaliza códigos de Rust (`ai-proxy-timeout`) a los del frontend. */
function normalizeCode(raw: unknown): string {
  const code = typeof raw === 'string' ? raw : '';
  if (code === 'ai-proxy-timeout') return 'timeout';
  if (code === 'ai-proxy-cancelled') return 'cancelled';
  if (code === 'ai-proxy-connect-failed' || code === 'ai-proxy-request-failed') return 'network';
  return /^ai-[a-z-]{1,60}$/.test(code) ? code : 'network';
}

/** Transporte de escritorio: proxy nativo con cancelación explícita en Rust. */
export function createNativeTransport(invoke?: Invoke): AiTransport {
  return async (request, signal) => {
    if (signal?.aborted) throw new AiTransportError('cancelled');
    const run = invoke ?? ((await import('@tauri-apps/api/core')).invoke as Invoke);
    const requestId = newRequestId();
    const timeoutMs = request.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
    return new Promise<AiHttpResponse>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        fn();
      };
      const cancel = (code: string) => {
        void run('ai_http_cancel', { requestId }).catch(() => undefined);
        finish(() => reject(new AiTransportError(code)));
      };
      const onAbort = () => cancel('cancelled');
      // Respaldo por si el proceso nativo no responde: Rust también aplica su propio plazo.
      const timer = setTimeout(() => cancel('timeout'), timeoutMs + 2_000);
      signal?.addEventListener('abort', onAbort, { once: true });
      run<AiHttpResponse>('ai_http_request', {
        request: {
          requestId,
          url: request.url,
          method: request.method ?? 'POST',
          headers: request.headers ?? {},
          body: request.body,
          keySlot: request.keySlot,
          timeoutMs,
        },
      }).then(
        (resp) => finish(() => resolve({ status: Number(resp.status), body: String(resp.body ?? '') })),
        (err) => finish(() => reject(new AiTransportError(normalizeCode(err)))),
      );
    });
  };
}

/** Transporte web: `fetch` directo con la clave en memoria. */
export function createWebTransport(getKey: (slot: AiKeySlot) => string): AiTransport {
  return async (request, signal) => {
    if (signal?.aborted) throw new AiTransportError('cancelled');
    const headers: Record<string, string> = { ...(request.headers ?? {}) };
    const key = request.keySlot ? getKey(request.keySlot).trim() : '';
    if (request.keySlot && key) {
      const scheme = authSchemeFor(request.keySlot);
      if (scheme === 'bearer') headers.Authorization = `Bearer ${key}`;
      else headers[scheme] = key;
      if (request.keySlot === 'anthropic') headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, request.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const resp = await fetch(request.url, {
        method: request.method ?? 'POST',
        headers,
        body: request.body,
        redirect: 'error',
        signal: controller.signal,
      });
      const body = await resp.text();
      if (body.length > MAX_WEB_RESPONSE_CHARS) throw new AiTransportError('ai-proxy-response-too-large');
      return { status: resp.status, body };
    } catch (err) {
      if (err instanceof AiTransportError) throw err;
      if (timedOut) throw new AiTransportError('timeout');
      if (signal?.aborted) throw new AiTransportError('cancelled');
      throw new AiTransportError('network');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  };
}

/** Transporte según la plataforma en ejecución. */
export function defaultTransport(getKey: (slot: AiKeySlot) => string): AiTransport {
  return isTauriRuntime() ? createNativeTransport() : createWebTransport(getKey);
}
