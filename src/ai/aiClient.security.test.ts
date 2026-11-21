/**
 * @file src/ai/aiClient.security.test.ts
 * @description Pruebas de seguridad del cliente IA con respuestas simuladas (sin red ni claves reales):
 * transporte de la clave Gemini, comandos fuera de la lista permitida, redacción de errores y URL base.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiConfig, KuraCommandRequest, KuraCommandResponse } from '../types/kura';
import { sendAiPrompt } from './aiClient';
import { DEFAULT_ALLOWED_HOSTS, isAllowedProviderUrl, redactSecrets } from './providerSecurity';

const FAKE_KEY = 'fake-test-key-abcdef123456';

function config(provider: AiConfig['provider'], baseUrl = ''): AiConfig {
  return { provider, apiKey: FAKE_KEY, model: 'test-model', baseUrl, temperature: 0 };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function executor() {
  return vi.fn(async (req: KuraCommandRequest): Promise<KuraCommandResponse> => ({
    id: req.id, ok: true, result: { ran: req.command },
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gemini transport', () => {
  it('sends the key in x-goog-api-key and never in the URL', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ candidates: [{ content: { parts: [{ text: 'hola' }] } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const out = await sendAiPrompt('hola', [], config('gemini'), 'es', executor());

    expect(out.assistantText).toBe('hola');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain(FAKE_KEY);
    expect(url).not.toMatch(/[?&]key=/);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(FAKE_KEY);
    expect(String(init.body)).not.toContain(FAKE_KEY);
  });
});

describe('provider tool calls', () => {
  it('runs allowed Gemini calls and refuses unknown ones without touching the scene', async () => {
    const replies = [
      { candidates: [{ content: { parts: [{ functionCall: { name: 'import_svg', args: { path: 'C:/x' } } }] } }] },
      { candidates: [{ content: { parts: [{ functionCall: { name: 'create_primitive', args: { type: 'box', width: 10 } } }] } }] },
      { candidates: [{ content: { parts: [{ text: 'listo' }] } }] },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(replies.shift())));
    const run = executor();

    const out = await sendAiPrompt('crea', [], config('gemini'), 'es', run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({ command: 'create_primitive', params: { type: 'box', width: 10 } });
    expect(out.executedTools[0]).toMatchObject({ name: 'import_svg' });
    expect(out.executedTools[0].result).toMatch(/^Error: Tool "import_svg" is not allowed/);
  });

  it('refuses OpenAI calls with malformed JSON or extra parameters', async () => {
    const replies = [
      {
        choices: [{
          message: {
            content: null,
            tool_calls: [
              { id: 'a', function: { name: 'delete_object', arguments: '{"id":' } },
              { id: 'b', function: { name: 'delete_object', arguments: '{"id":"x","all":true}' } },
              { id: 'c', function: { name: 'delete_object', arguments: '{"id":"x"}' } },
            ],
          },
        }],
      },
      { choices: [{ message: { content: 'ok' } }] },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(replies.shift())));
    const run = executor();

    const out = await sendAiPrompt('borra', [], config('openai'), 'es', run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({ command: 'delete_object', params: { id: 'x' } });
    expect(out.executedTools.map((tool) => tool.result.startsWith('Error:'))).toEqual([true, true, false]);
  });

  it('caps the number of tool calls per turn (Anthropic)', async () => {
    const toolUses = Array.from({ length: 12 }, (_, i) => ({
      type: 'tool_use', id: `t${i}`, name: 'duplicate_object', input: {},
    }));
    const replies = [{ content: toolUses }, { content: [{ type: 'text', text: 'fin' }] }];
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(replies.shift())));
    const run = executor();

    const out = await sendAiPrompt('duplica', [], config('anthropic'), 'es', run);

    expect(run).toHaveBeenCalledTimes(8);
    expect(out.executedTools).toHaveLength(12);
    expect(out.executedTools.at(-1)?.result).toMatch(/limit/);
  });

  it('validates Ollama object arguments too', async () => {
    const replies = [
      { message: { tool_calls: [{ function: { name: 'hollow_object', arguments: { wallThickness: 'thick' } } }] } },
      { message: { content: 'ok' } },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(replies.shift())));
    const run = executor();
    const ollama = { ...config('ollama'), apiKey: '' };

    await sendAiPrompt('ahueca', [], ollama, 'es', run);

    expect(run).not.toHaveBeenCalled();
  });
});

describe('secret hygiene', () => {
  it('removes the key from provider error messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse({ error: { message: `Incorrect API key provided: ${FAKE_KEY}` } }, 401)));

    const failure = sendAiPrompt('hola', [], config('openai'), 'es', executor());

    await expect(failure).rejects.toThrow(/OpenAI HTTP 401/);
    await expect(failure).rejects.not.toThrow(FAKE_KEY);
  });

  it('redacts common credential formats', () => {
    const text = 'url?key=abc123456789&x=1 Bearer abcdefghijkl sk-proj-abcdefgh1234 AIzaSyA1234567890123456789012';
    const clean = redactSecrets(text);
    expect(clean).not.toMatch(/abc123456789|abcdefghijkl|sk-proj|AIza/);
    expect(clean).toContain('key=[redacted]');
  });

  it('refuses provider URLs that the security policy does not allow before sending anything', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendAiPrompt('hola', [], config('openai', 'http://evil.example.com/v1'), 'es', executor()))
      .rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies the user host allowlist on every platform', () => {
    const custom = ['openrouter.ai', '*.example.org'];
    expect(isAllowedProviderUrl('https://api.openai.com/v1', DEFAULT_ALLOWED_HOSTS)).toBe(true);
    expect(isAllowedProviderUrl('https://api.deepseek.com', DEFAULT_ALLOWED_HOSTS)).toBe(true);
    expect(isAllowedProviderUrl('https://my.proxy.example/v1', DEFAULT_ALLOWED_HOSTS)).toBe(false);
    expect(isAllowedProviderUrl('https://openrouter.ai/api/v1', custom)).toBe(true);
    expect(isAllowedProviderUrl('https://api.openai.com/v1', custom)).toBe(false);
    expect(isAllowedProviderUrl('https://a.example.org/v1', custom)).toBe(true);
    expect(isAllowedProviderUrl('https://example.org/v1', custom)).toBe(false);
    expect(isAllowedProviderUrl('http://127.0.0.1:1234/v1', [])).toBe(true);
    expect(isAllowedProviderUrl('http://localhost:11434', [])).toBe(true);
    expect(isAllowedProviderUrl('http://192.168.1.5:11434', custom)).toBe(false);
    expect(isAllowedProviderUrl('https://user:pass@api.openai.com', DEFAULT_ALLOWED_HOSTS)).toBe(false);
    expect(isAllowedProviderUrl('javascript:alert(1)', DEFAULT_ALLOWED_HOSTS)).toBe(false);
    expect(isAllowedProviderUrl('not a url', DEFAULT_ALLOWED_HOSTS)).toBe(false);
  });
});
