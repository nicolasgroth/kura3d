/**
 * @file src/ai/aiClient.ts
 * @description Punto de entrada del chat IA de Kurra Studio. Elige el proveedor configurado (Gemini, OpenAI,
 * Anthropic, Ollama o un proveedor compatible con OpenAI) y lo ejecuta con el bucle común de herramientas
 * (`providerLoop.ts`) sobre el transporte único (`aiTransport.ts`: proxy nativo en escritorio, `fetch` en
 * web). Sin credenciales usa el Asistente Local Determinista (`local/localAssistant.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t, type TranslationKey } from '../i18n';
import type { AiChatMessage, AiConfig, LanguageCode } from '../types/kura';
import { getAllowedHostsSync } from './allowedHosts';
import { AiTransportError, defaultTransport, type AiTransport } from './aiTransport';
import { runLocalAssistant } from './local/localAssistant';
import { hasUsableCredentials, keySlotFor, providerLabel, specFor } from './providerCatalog';
import { runToolLoop, type AiTurnOutput, type CommandExecutor, type ProviderAdapter } from './providerLoop';
import { createAnthropicAdapter } from './providers/anthropic';
import { createGeminiAdapter } from './providers/gemini';
import { createOllamaAdapter } from './providers/ollama';
import { createOpenAiAdapter } from './providers/openai';
import type { AdapterInput } from './providers/shared';
import { isAllowedProviderUrl, redactSecrets } from './providerSecurity';

export type { AiTurnOutput } from './providerLoop';

export interface SendAiOptions {
  /** Cancela la solicitud en curso (botón "Detener" del chat). */
  signal?: AbortSignal;
  /** Transporte inyectable (pruebas). Por defecto: proxy nativo en escritorio, `fetch` en web. */
  transport?: AiTransport;
  /** Lista de hosts permitidos; por defecto la del usuario. */
  allowedHosts?: readonly string[];
  timeoutMs?: number;
}

const TRANSPORT_MESSAGES: Record<string, TranslationKey> = {
  timeout: 'ai.error.timeout',
  cancelled: 'ai.error.cancelled',
  network: 'ai.error.network',
  'ai-proxy-host-not-allowed': 'ai.error.endpointBlocked',
  'ai-proxy-url-invalid': 'ai.error.endpointBlocked',
  'ai-proxy-key-host-mismatch': 'ai.error.keyHostMismatch',
  'ai-proxy-redirect-blocked': 'ai.error.redirectBlocked',
  'ai-proxy-response-too-large': 'ai.error.responseTooLarge',
  'ai-proxy-request-too-large': 'ai.error.responseTooLarge',
};

function createAdapter(input: AdapterInput): ProviderAdapter {
  switch (input.config.provider) {
    case 'gemini':
      return createGeminiAdapter(input);
    case 'anthropic':
      return createAnthropicAdapter(input);
    case 'ollama':
      return createOllamaAdapter(input);
    case 'openai':
      return createOpenAiAdapter(input);
    case 'openai_compatible':
      return createOpenAiAdapter(input, providerLabel(input.config));
  }
}

/**
 * En el chat, una primitiva sin posición ni colocación explícitas nace en el primer hueco libre
 * de la cama en vez de en el origen (donde se solaparía con lo que ya hay).
 */
export function withFreePlacement(executeCommand: CommandExecutor): CommandExecutor {
  return (req) => {
    const params = (req.params ?? {}) as Record<string, unknown>;
    if (req.command === 'create_primitive' && typeof params === 'object' && !Array.isArray(params)
      && params.placement === undefined && params.position === undefined) {
      return executeCommand({ ...req, params: { ...params, placement: 'free' } });
    }
    return executeCommand(req);
  };
}

/**
 * Envía un mensaje al proveedor configurado o al Asistente Local Determinista cuando no hay
 * credenciales. Los errores llegan traducidos y sin la clave.
 */
export async function sendAiPrompt(
  prompt: string,
  history: AiChatMessage[],
  config: AiConfig,
  lang: LanguageCode,
  executeCommand: CommandExecutor,
  options: SendAiOptions = {},
): Promise<AiTurnOutput> {
  executeCommand = withFreePlacement(executeCommand);
  if (!hasUsableCredentials(config)) {
    return runLocalAssistant(prompt, lang, executeCommand);
  }

  try {
    const spec = specFor(config);
    const baseUrl = (config.baseUrl.trim() || spec.defaultBaseUrl).replace(/\/+$/, '');
    if (!baseUrl) throw new Error(t(lang, 'ai.error.baseUrlRequired'));
    if (!isAllowedProviderUrl(baseUrl, options.allowedHosts ?? getAllowedHostsSync())) {
      throw new Error(t(lang, 'ai.error.endpointBlocked'));
    }
    const keySlot = keySlotFor(config);
    const transport = options.transport ?? defaultTransport(() => config.apiKey);
    const adapter = createAdapter({
      prompt,
      history,
      config,
      lang,
      baseUrl,
      model: config.model.trim() || spec.defaultModel,
      keySlot,
      timeoutMs: options.timeoutMs,
    });
    return await runToolLoop(adapter, {
      transport,
      executeCommand,
      signal: options.signal,
      secret: config.apiKey,
      maxSteps: config.provider === 'ollama' ? 3 : 4,
      doneText: t(lang, 'ai.actionsCompleted'),
    });
  } catch (error) {
    if (error instanceof AiTransportError) {
      const key = TRANSPORT_MESSAGES[error.code];
      const err = new Error(key ? t(lang, key) : t(lang, 'ai.error.network'));
      err.name = error.code === 'cancelled' ? 'AbortError' : 'AiTransportError';
      throw err;
    }
    // Ningún error que llegue a la interfaz o a la consola puede contener la clave.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redactSecrets(message, config.apiKey));
  }
}
