/**
 * @file src/utils/aiConnectionTest.test.ts
 * @description Pruebas de "Probar conexión": clasificación de resultados, petición mínima y ausencia de la clave en la salida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';
import { AiTransportError, type AiTransport } from '../ai/aiTransport';
import { DEFAULT_ALLOWED_HOSTS } from '../ai/providerSecurity';
import { testAiConnection, type AiConnectionTestInput } from './aiConnectionTest';

const base: AiConnectionTestInput = {
  config: { provider: 'openai', baseUrl: '' },
  typedKey: 'sk-secreto-1234567890',
  keyStored: false,
  allowedHosts: DEFAULT_ALLOWED_HOSTS,
};

const answering = (status: number): AiTransport => vi.fn(async () => ({ status, body: 'cuerpo sk-secreto-1234567890' }));

describe('probar conexión de IA', () => {
  it('hace un GET mínimo a la lista de modelos con la ranura de la clave', async () => {
    const transport = answering(200);
    expect(await testAiConnection({ ...base, transport })).toEqual({ kind: 'ok' });
    const request = (transport as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request).toMatchObject({ method: 'GET', url: 'https://api.openai.com/v1/models', keySlot: 'openai' });
    expect(request.body).toBeUndefined();
  });

  it('usa la ruta propia de cada proveedor', async () => {
    const anthropic = answering(200);
    await testAiConnection({ ...base, config: { provider: 'anthropic', baseUrl: '' }, transport: anthropic });
    expect((anthropic as ReturnType<typeof vi.fn>).mock.calls[0][0].url).toBe('https://api.anthropic.com/v1/models');
    const ollama = answering(200);
    await testAiConnection({ ...base, config: { provider: 'ollama', baseUrl: '' }, typedKey: '', transport: ollama });
    expect((ollama as ReturnType<typeof vi.fn>).mock.calls[0][0].url).toBe('http://127.0.0.1:11434/api/tags');
  });

  it('clasifica clave rechazada, error HTTP, red y tiempo agotado sin filtrar la clave', async () => {
    expect(await testAiConnection({ ...base, transport: answering(401) })).toEqual({ kind: 'auth', status: 401 });
    expect(await testAiConnection({ ...base, transport: answering(404) })).toEqual({ kind: 'http', status: 404 });
    const failing = (code: string): AiTransport => async () => { throw new AiTransportError(code); };
    expect(await testAiConnection({ ...base, transport: failing('network') })).toEqual({ kind: 'network' });
    expect(await testAiConnection({ ...base, transport: failing('timeout') })).toEqual({ kind: 'timeout' });
    const results = JSON.stringify(await testAiConnection({ ...base, transport: answering(500) }));
    expect(results).not.toContain('sk-secreto');
  });

  it('exige clave, URL válida y host permitido antes de salir a la red', async () => {
    const transport = answering(200);
    expect(await testAiConnection({ ...base, typedKey: '', transport })).toEqual({ kind: 'noKey' });
    expect(await testAiConnection({ ...base, config: { provider: 'openai_compatible', compatPreset: 'custom', baseUrl: '' }, transport }))
      .toEqual({ kind: 'url' });
    expect(await testAiConnection({ ...base, config: { provider: 'openai', baseUrl: 'https://evil.example.com' }, transport }))
      .toEqual({ kind: 'blocked' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('en escritorio una clave guardada basta aunque no se escriba', async () => {
    const transport = answering(200);
    expect(await testAiConnection({ ...base, typedKey: '', keyStored: true, transport })).toEqual({ kind: 'ok' });
  });
});
