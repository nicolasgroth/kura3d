/**
 * @file src/ai/providers/anthropic.ts
 * @description Adaptador de la Messages API de Anthropic con Tool Use.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ProviderAdapter, ToolCall } from '../providerLoop';
import { KURA_TOOL_SCHEMAS } from '../toolSchemas';
import { buildSystemPrompt, JSON_HEADERS, recentTurns, type AdapterInput } from './shared';

interface AnthropicBlock {
  type?: string;
  text?: string;
  id?: unknown;
  name?: unknown;
  input?: unknown;
}

export function createAnthropicAdapter(input: AdapterInput): ProviderAdapter {
  const messages: Array<Record<string, unknown>> = [...recentTurns(input.history), { role: 'user', content: input.prompt }];
  const tools = KURA_TOOL_SCHEMAS.map((s) => ({ name: s.name, description: s.description, input_schema: s.parameters }));
  let lastBlocks: AnthropicBlock[] = [];

  return {
    label: 'Anthropic',
    buildRequest: () => ({
      url: `${input.baseUrl}/v1/messages`,
      headers: { ...JSON_HEADERS, 'anthropic-version': '2023-06-01' },
      keySlot: input.keySlot,
      timeoutMs: input.timeoutMs,
      body: JSON.stringify({
        model: input.model,
        max_tokens: 1024,
        system: buildSystemPrompt(input.lang),
        messages,
        tools,
        temperature: input.config.temperature,
      }),
    }),
    parse(json) {
      lastBlocks = (json as { content?: AnthropicBlock[] }).content ?? [];
      const toolCalls: ToolCall[] = lastBlocks
        .filter((b) => b.type === 'tool_use' && b.name && typeof b.id === 'string')
        .map((b) => ({ id: b.id as string, name: b.name, args: b.input }));
      const text = lastBlocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();
      return { text, toolCalls };
    },
    appendToolResults(results) {
      messages.push({ role: 'assistant', content: lastBlocks });
      messages.push({
        role: 'user',
        content: results.map(({ call, summary }) => ({ type: 'tool_result', tool_use_id: call.id, content: summary })),
      });
    },
  };
}
