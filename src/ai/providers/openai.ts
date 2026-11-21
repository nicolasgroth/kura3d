/**
 * @file src/ai/providers/openai.ts
 * @description Adaptador de Chat Completions con herramientas. Sirve a OpenAI y a cualquier proveedor
 * compatible (DeepSeek, Qwen/DashScope, OpenRouter, LM Studio, Ollama `/v1`, personalizado).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ProviderAdapter, ToolCall } from '../providerLoop';
import { KURA_TOOL_SCHEMAS } from '../toolSchemas';
import { buildSystemPrompt, JSON_HEADERS, recentTurns, type AdapterInput } from './shared';

interface OpenAiMessage {
  content?: string | null;
  tool_calls?: Array<{ id?: string; function?: { name?: unknown; arguments?: unknown } }>;
}

export function createOpenAiAdapter(input: AdapterInput, label = 'OpenAI'): ProviderAdapter {
  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: buildSystemPrompt(input.lang) },
    ...recentTurns(input.history),
    { role: 'user', content: input.prompt },
  ];
  const tools = KURA_TOOL_SCHEMAS.map((s) => ({
    type: 'function',
    function: { name: s.name, description: s.description, parameters: s.parameters },
  }));
  let lastMessage: OpenAiMessage | null = null;
  let counter = 0;

  return {
    label,
    buildRequest: () => ({
      url: `${input.baseUrl}/chat/completions`,
      headers: { ...JSON_HEADERS },
      keySlot: input.keySlot,
      timeoutMs: input.timeoutMs,
      body: JSON.stringify({ model: input.model, messages, tools, temperature: input.config.temperature }),
    }),
    parse(json) {
      const data = json as { choices?: Array<{ message?: OpenAiMessage }> };
      lastMessage = data.choices?.[0]?.message ?? null;
      const toolCalls: ToolCall[] = (lastMessage?.tool_calls ?? []).map((tc) => ({
        id: typeof tc.id === 'string' && tc.id ? tc.id : `oai_${Date.now()}_${counter++}`,
        name: tc.function?.name,
        // Los argumentos llegan como cadena JSON; validateToolCall rechaza JSON inválido.
        args: tc.function?.arguments,
      }));
      return { text: (lastMessage?.content ?? '').trim(), toolCalls };
    },
    appendToolResults(results) {
      if (lastMessage) messages.push({ role: 'assistant', ...lastMessage });
      for (const { call, summary } of results) {
        messages.push({ role: 'tool', tool_call_id: call.id, content: summary });
      }
    },
  };
}
