/**
 * @file src/ai/providers/gemini.ts
 * @description Adaptador de Google Gemini (`generateContent` con Function Calling). Ejecuta todas las
 * `functionCall` de una respuesta y devuelve todas las `functionResponse` en un único turno.
 * La clave viaja solo en la cabecera `x-goog-api-key` (la pone el transporte), nunca en la URL.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ProviderAdapter, ToolCall } from '../providerLoop';
import { KURA_TOOL_SCHEMAS } from '../toolSchemas';
import { buildSystemPrompt, JSON_HEADERS, recentTurns, type AdapterInput } from './shared';

interface GeminiPart {
  text?: string;
  functionCall?: { name?: unknown; args?: unknown };
}

export function createGeminiAdapter(input: AdapterInput): ProviderAdapter {
  const endpoint = `${input.baseUrl}/models/${encodeURIComponent(input.model)}:generateContent`;
  const contents: Array<Record<string, unknown>> = [
    ...recentTurns(input.history).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: input.prompt }] },
  ];
  const tools = [{
    functionDeclarations: KURA_TOOL_SCHEMAS.map((s) => ({ name: s.name, description: s.description, parameters: s.parameters })),
  }];
  let lastParts: GeminiPart[] = [];
  let counter = 0;

  return {
    label: 'Gemini',
    buildRequest: () => ({
      url: endpoint,
      headers: { ...JSON_HEADERS },
      keySlot: input.keySlot,
      timeoutMs: input.timeoutMs,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(input.lang) }] },
        contents,
        tools,
        generationConfig: { temperature: input.config.temperature },
      }),
    }),
    parse(json) {
      const data = json as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> };
      lastParts = data.candidates?.[0]?.content?.parts ?? [];
      const toolCalls: ToolCall[] = lastParts
        .filter((p) => p.functionCall)
        .map((p) => ({ id: `gem_${Date.now()}_${counter++}`, name: p.functionCall!.name, args: p.functionCall!.args }));
      const text = lastParts.map((p) => p.text ?? '').join('\n').trim();
      return { text, toolCalls };
    },
    appendToolResults(results) {
      contents.push({ role: 'model', parts: lastParts });
      contents.push({
        role: 'user',
        parts: results.map(({ call, response }) => ({
          functionResponse: {
            name: call.name,
            response: response.ok ? { result: response.result ?? { ok: true } } : { error: response.error },
          },
        })),
      });
    },
  };
}
