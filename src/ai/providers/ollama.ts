/**
 * @file src/ai/providers/ollama.ts
 * @description Adaptador de Ollama local (`/api/chat`) con Tool Calling nativo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ProviderAdapter, ToolCall } from '../providerLoop';
import { KURA_TOOL_SCHEMAS } from '../toolSchemas';
import { buildSystemPrompt, JSON_HEADERS, recentTurns, type AdapterInput } from './shared';

interface OllamaMessage {
  content?: string;
  tool_calls?: Array<{ function?: { name?: unknown; arguments?: unknown } }>;
}

export function createOllamaAdapter(input: AdapterInput): ProviderAdapter {
  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: buildSystemPrompt(input.lang) },
    ...recentTurns(input.history),
    { role: 'user', content: input.prompt },
  ];
  const tools = KURA_TOOL_SCHEMAS.map((s) => ({
    type: 'function',
    function: { name: s.name, description: s.description, parameters: s.parameters },
  }));
  let lastMessage: OllamaMessage | null = null;
  let counter = 0;

  return {
    label: 'Ollama',
    buildRequest: () => ({
      url: `${input.baseUrl}/api/chat`,
      headers: { ...JSON_HEADERS },
      timeoutMs: input.timeoutMs,
      body: JSON.stringify({
        model: input.model,
        messages,
        tools,
        stream: false,
        options: { temperature: input.config.temperature },
      }),
    }),
    parse(json) {
      lastMessage = (json as { message?: OllamaMessage }).message ?? null;
      const toolCalls: ToolCall[] = (lastMessage?.tool_calls ?? []).map((tc) => ({
        id: `oll_${Date.now()}_${counter++}`,
        name: tc.function?.name,
        args: tc.function?.arguments,
      }));
      return { text: (lastMessage?.content ?? '').trim(), toolCalls };
    },
    appendToolResults(results) {
      if (lastMessage) messages.push({ role: 'assistant', ...lastMessage });
      for (const { summary } of results) messages.push({ role: 'tool', content: summary });
    },
  };
}
