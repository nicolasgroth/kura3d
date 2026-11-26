/**
 * @file src/ai/aiTransport.test.ts
 * @description Pruebas del transporte único (proxy nativo simulado y `fetch`) y del bucle común de
 * proveedores: cancelación, tiempo límite, códigos de error de Rust, ranura de clave, todas las
 * `functionCall` de Gemini, presets compatibles con OpenAI y lista de hosts del usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiConfig, KuraCommandRequest, KuraCommandResponse } from '../types/kura';
import { sendAiPrompt } from './aiClient';
import { AiTransportError, createNativeTransport, createWebTransport, type AiHttpRequest, type AiTransport } from './aiTransport';
import { DEFAULT_ALLOWED_HOSTS } from './providerSecurity';

const KEY = 'fake-transport-key-0123456789';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function executor() {
  return vi.fn(async (req: KuraCommandRequest): Promise<KuraCommandResponse> => ({ id: req.id, ok: true, result: { ran: req.command } }));
}

/** Transporte simulado que responde en orden y guarda las solicitudes. */
function scripted(bodies: unknown[]) {
  const requests: AiHttpRequest[] = [];
  const transport: AiTransport = async (req) => {
    requests.push(req);
    return { status: 200, body: JSON.stringify(bodies.shift()) };
  };
  return { transport, requests };
}

describe('native transport (Tauri proxy)', () => {
  it('sends the key slot, never the key, and maps Rust error codes', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'ai_http_request') throw 'ai-proxy-host-not-allowed';
      return null;
    });
    const transport = createNativeTransport(invoke as never);
    const failure = transport({ url: 'https://evil.example/v1', keySlot: 'openai', body: '{}' });
    await expect(failure).rejects.toMatchObject({ code: 'ai-proxy-host-not-allowed' });
    const [, args] = invoke.mock.calls[0] as unknown as [string, { request: Record<string, unknown> }];
    expect(args.request).toMatchObject({ url: 'https://evil.example/v1', keySlot: 'openai', method: 'POST' });
    expect(JSON.stringify(args)).not.toContain(KEY);
  });

  it('cancels in Rust when the signal aborts', async () => {
    const invoke = vi.fn((command: string) =>
      command === 'ai_http_request' ? new Promise(() => undefined) : Promise.resolve(null));
    const controller = new AbortController();
    const pending = createNativeTransport(invoke as never)({ url: 'https://api.openai.com/v1/x' }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    const cancel = invoke.mock.calls.find(([name]) => name === 'ai_http_cancel') as unknown as [string, { requestId: string }];
    const request = invoke.mock.calls[0] as unknown as [string, { request: { requestId: string } }];
    expect(cancel[1].requestId).toBe(request[1].request.requestId);
  });

  it('times out even if the native side never answers', async () => {
    vi.useFakeTimers();
    const invoke = vi.fn((command: string) =>
      command === 'ai_http_request' ? new Promise(() => undefined) : Promise.resolve(null));
    const pending = createNativeTransport(invoke as never)({ url: 'https://api.openai.com/v1/x', timeoutMs: 1000 });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(3100);
    await assertion;
  });
});

describe('web transport (fetch)', () => {
  it('attaches the key by slot and refuses redirects', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const transport = createWebTransport(() => KEY);
    await transport({ url: 'https://api.deepseek.com/chat/completions', keySlot: 'deepseek' });
    await transport({ url: 'https://api.anthropic.com/v1/messages', keySlot: 'anthropic' });
    await transport({ url: 'http://127.0.0.1:1234/v1/x' });
    const inits = fetchMock.mock.calls.map((c) => (c as unknown as [string, RequestInit])[1]);
    expect((inits[0].headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect((inits[1].headers as Record<string, string>)['x-api-key']).toBe(KEY);
    expect(inits[2].headers).toEqual({});
    expect(inits.every((init) => init.redirect === 'error')).toBe(true);
  });

  it('reports timeouts and cancellations with stable codes', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const transport = createWebTransport(() => '');
    await expect(transport({ url: 'https://api.openai.com/v1', timeoutMs: 20 })).rejects.toMatchObject({ code: 'timeout' });
    const controller = new AbortController();
    const pending = transport({ url: 'https://api.openai.com/v1' }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(AiTransportError);
  });
});

describe('provider loop', () => {
  const cfg = (patch: Partial<AiConfig>): AiConfig => ({
    provider: 'gemini', apiKey: KEY, model: 'm', baseUrl: '', temperature: 0, ...patch,
  });

  it('runs every Gemini functionCall of a response and answers them in one turn', async () => {
    const { transport, requests } = scripted([
      { candidates: [{ content: { parts: [
        { functionCall: { name: 'create_primitive', args: { type: 'box', width: 10 } } },
        { functionCall: { name: 'duplicate_object', args: {} } },
      ] } }] },
      { candidates: [{ content: { parts: [{ text: 'listo' }] } }] },
    ]);
    const run = executor();
    const out = await sendAiPrompt('crea y duplica', [], cfg({}), 'es', run, { transport });
    expect(run.mock.calls.map(([r]) => r.command)).toEqual(['create_primitive', 'duplicate_object']);
    const second = JSON.parse(requests[1].body!) as { contents: Array<{ role: string; parts: unknown[] }> };
    expect(second.contents.at(-1)!.parts).toHaveLength(2);
    expect(out.assistantText).toBe('listo');
    expect(requests[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/m:generateContent');
    expect(requests[0].keySlot).toBe('gemini');
  });

  it('uses OpenAI-compatible presets with their own base URL and key slot', async () => {
    const { transport, requests } = scripted([{ choices: [{ message: { content: 'hola' } }] }]);
    const out = await sendAiPrompt('hola', [], cfg({ provider: 'openai_compatible', compatPreset: 'deepseek', model: '' }), 'es', executor(), { transport });
    expect(out.assistantText).toBe('hola');
    expect(requests[0].url).toBe('https://api.deepseek.com/chat/completions');
    expect(requests[0].keySlot).toBe('deepseek');
    expect(JSON.parse(requests[0].body!).model).toBe('deepseek-flash');
  });

  it('uses the provider on desktop when only the keychain holds the key', async () => {
    const { transport, requests } = scripted([{ choices: [{ message: { content: 'ok' } }] }]);
    const out = await sendAiPrompt('hola', [], cfg({ provider: 'openai', apiKey: '', keyStored: true }), 'es', executor(), { transport });
    expect(out.usedLocalFallback).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it('refuses hosts outside the user list before sending anything', async () => {
    const transport = vi.fn<AiTransport>();
    const custom = cfg({ provider: 'openai_compatible', compatPreset: 'custom', baseUrl: 'https://my.proxy.example/v1' });
    await expect(sendAiPrompt('hola', [], custom, 'es', executor(), { transport, allowedHosts: DEFAULT_ALLOWED_HOSTS }))
      .rejects.toThrow(/no permitida/);
    expect(transport).not.toHaveBeenCalled();
    const { transport: ok } = scripted([{ choices: [{ message: { content: 'ok' } }] }]);
    await expect(sendAiPrompt('hola', [], custom, 'es', executor(), { transport: ok, allowedHosts: ['my.proxy.example'] }))
      .resolves.toMatchObject({ assistantText: 'ok' });
  });

  it('turns transport errors into translated messages and aborts as AbortError', async () => {
    const controller = new AbortController();
    const transport: AiTransport = async (_req, signal) => {
      controller.abort();
      if (signal?.aborted) throw new AiTransportError('cancelled');
      throw new Error('unreachable');
    };
    const failure = sendAiPrompt('hola', [], cfg({}), 'es', executor(), { transport, signal: controller.signal });
    await expect(failure).rejects.toMatchObject({ name: 'AbortError', message: 'Solicitud cancelada.' });
    const timeout: AiTransport = async () => {
      throw new AiTransportError('timeout');
    };
    await expect(sendAiPrompt('hola', [], cfg({}), 'en', executor(), { transport: timeout })).rejects.toThrow(/did not respond in time/);
  });
});
