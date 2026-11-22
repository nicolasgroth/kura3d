/**
 * @file src/utils/aiConnectionTest.ts
 * @description "Probar conexión" de Ajustes de IA: una sola petición GET mínima (lista de modelos) por el
 * transporte existente. Devuelve un resultado clasificado y nunca incluye la clave ni el cuerpo de la respuesta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { AiTransportError, defaultTransport, type AiTransport } from '../ai/aiTransport';
import { keySlotFor, specFor } from '../ai/providerCatalog';
import { isAllowedProviderUrl } from '../ai/providerSecurity';
import type { AiConfig } from '../types/kura';

export type AiConnectionResult =
  | { kind: 'ok' }
  | { kind: 'auth'; status: number }
  | { kind: 'http'; status: number }
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'noKey' }
  | { kind: 'url' }
  | { kind: 'blocked' };

export interface AiConnectionTestInput {
  config: Pick<AiConfig, 'provider' | 'compatPreset' | 'baseUrl'>;
  /** Clave escrita en el formulario (solo web; en escritorio la lee Rust del llavero). */
  typedKey: string;
  /** Escritorio: hay clave guardada en el llavero para la ranura. */
  keyStored: boolean;
  allowedHosts: readonly string[];
  transport?: AiTransport;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Ruta de solo lectura que cada proveedor ofrece para listar modelos. */
function probePath(provider: AiConfig['provider']): string {
  if (provider === 'ollama') return '/api/tags';
  if (provider === 'anthropic') return '/v1/models';
  return '/models';
}

export async function testAiConnection(input: AiConnectionTestInput): Promise<AiConnectionResult> {
  const { config } = input;
  const spec = specFor(config);
  const baseUrl = (config.baseUrl.trim() || spec.defaultBaseUrl).replace(/\/+$/, '');
  if (!baseUrl) return { kind: 'url' };
  if (!isAllowedProviderUrl(baseUrl, input.allowedHosts)) return { kind: 'blocked' };
  const hasKey = input.typedKey.trim().length > 0 || input.keyStored;
  if (spec.needsKey && !hasKey) return { kind: 'noKey' };

  const slot = keySlotFor(config);
  const transport = input.transport ?? defaultTransport(() => input.typedKey);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.provider === 'anthropic') headers['anthropic-version'] = '2023-06-01';
  try {
    const response = await transport({
      url: `${baseUrl}${probePath(config.provider)}`,
      method: 'GET',
      headers,
      keySlot: hasKey ? slot : undefined,
      timeoutMs: input.timeoutMs ?? 15_000,
    }, input.signal);
    if (response.status >= 200 && response.status < 300) return { kind: 'ok' };
    if (response.status === 401 || response.status === 403) return { kind: 'auth', status: response.status };
    return { kind: 'http', status: response.status };
  } catch (error) {
    if (error instanceof AiTransportError) {
      if (error.code === 'timeout') return { kind: 'timeout' };
      if (error.code === 'ai-proxy-host-not-allowed' || error.code === 'ai-proxy-url-invalid') return { kind: 'blocked' };
    }
    return { kind: 'network' };
  }
}
