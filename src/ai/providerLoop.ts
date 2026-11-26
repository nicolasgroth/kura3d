/**
 * @file src/ai/providerLoop.ts
 * @description Bucle común de conversación con herramientas para todos los proveedores IA. Cada proveedor
 * aporta un adaptador (cómo construir la solicitud, leer la respuesta y devolver los resultados de las
 * herramientas); el bucle se encarga del transporte, los errores HTTP redactados, la cancelación, el tope
 * de pasos y de llamadas, y de validar cada herramienta antes de tocar la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { KuraCommandRequest, KuraCommandResponse } from '../types/kura';
import { AiTransportError, type AiHttpRequest, type AiTransport } from './aiTransport';
import { redactSecrets } from './providerSecurity';
import { MAX_TOOL_CALLS_PER_TURN, validateToolCall } from './toolValidation';

export interface AiTurnOutput {
  assistantText: string;
  executedTools: Array<{ name: string; result: string }>;
  usedLocalFallback: boolean;
}

export type CommandExecutor = (req: KuraCommandRequest) => Promise<KuraCommandResponse>;

export interface ToolCall {
  id: string;
  name: unknown;
  args: unknown;
}

export interface ToolResult {
  call: ToolCall;
  response: KuraCommandResponse;
  summary: string;
}

export interface ParsedTurn {
  text: string;
  toolCalls: ToolCall[];
}

/** Lo que cada proveedor debe saber hacer. El adaptador guarda su propio historial de mensajes. */
export interface ProviderAdapter {
  label: string;
  buildRequest(): AiHttpRequest;
  parse(json: unknown): ParsedTurn;
  appendToolResults(results: ToolResult[]): void;
}

export interface LoopContext {
  transport: AiTransport;
  executeCommand: CommandExecutor;
  signal?: AbortSignal;
  /** Clave en memoria (web) para redactarla de cualquier error. */
  secret?: string;
  maxSteps?: number;
  doneText: string;
}

/**
 * Ejecuta una llamada de herramienta pedida por un proveedor solo si pasa la lista permitida y el
 * tope por turno. Las rechazadas se informan al modelo como error y nunca llegan a la escena.
 */
export async function runProviderTool(
  call: ToolCall,
  executeCommand: CommandExecutor,
  executedTools: AiTurnOutput['executedTools'],
): Promise<ToolResult> {
  const label = typeof call.name === 'string' ? call.name.slice(0, 64) : 'unknown';
  const checked = executedTools.length >= MAX_TOOL_CALLS_PER_TURN
    ? { ok: false as const, error: `Tool call limit (${MAX_TOOL_CALLS_PER_TURN}) reached for this turn` }
    : validateToolCall(call.name, call.args);
  const response: KuraCommandResponse = checked.ok
    ? await executeCommand({ id: call.id, ...checked.request })
    : { id: call.id, ok: false, error: checked.error };
  const summary = response.ok
    ? JSON.stringify(response.result ?? { ok: true })
    : `Error: ${response.error}`;
  executedTools.push({ name: label, result: summary });
  return { call, response, summary };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AiTransportError('cancelled');
}

/** Bucle solicitud → herramientas → solicitud, hasta que el modelo responda solo con texto. */
export async function runToolLoop(adapter: ProviderAdapter, ctx: LoopContext): Promise<AiTurnOutput> {
  const executedTools: AiTurnOutput['executedTools'] = [];
  const maxSteps = ctx.maxSteps ?? 4;
  for (let step = 0; step < maxSteps; step++) {
    throwIfAborted(ctx.signal);
    const resp = await ctx.transport(adapter.buildRequest(), ctx.signal);
    if (resp.status < 200 || resp.status >= 300) {
      // Se redacta antes de truncar: una clave cortada por el límite ya no coincidiría con el literal.
      throw new Error(`${adapter.label} HTTP ${resp.status}: ${redactSecrets(resp.body, ctx.secret).slice(0, 220)}`);
    }
    let json: unknown;
    try {
      json = JSON.parse(resp.body);
    } catch {
      throw new Error(`${adapter.label}: invalid JSON response`);
    }
    const turn = adapter.parse(json);
    if (turn.toolCalls.length === 0) {
      return { assistantText: turn.text || 'OK', executedTools, usedLocalFallback: false };
    }
    const results: ToolResult[] = [];
    for (const call of turn.toolCalls) {
      throwIfAborted(ctx.signal);
      results.push(await runProviderTool(call, ctx.executeCommand, executedTools));
    }
    adapter.appendToolResults(results);
  }
  return { assistantText: ctx.doneText, executedTools, usedLocalFallback: false };
}
