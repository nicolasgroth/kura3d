/**
 * @file src/ai/aiClient.ts
 * @description Cliente IA multi-proveedor 100% nativo basado en fetch (Gemini, OpenAI, Anthropic, Ollama)
 * con soporte de Function/Tool Calling conectado directamente al Command Bus de Kura3D, además de un
 * Asistente Local Determinista para operar sin conexión ni claves API.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type {
  AiChatMessage,
  AiConfig,
  KuraCommandRequest,
  KuraCommandResponse,
  LanguageCode,
} from '../types/kura';
import { t } from '../i18n';
import { isTauriRuntime } from '../utils/platformBridge';
import { isAllowedProviderUrl, redactSecrets } from './providerSecurity';
import { KURA_TOOL_SCHEMAS } from './toolSchemas';
import { MAX_TOOL_CALLS_PER_TURN, validateToolCall } from './toolValidation';

export interface AiTurnOutput {
  assistantText: string;
  executedTools: Array<{ name: string; result: string }>;
  usedLocalFallback: boolean;
}

type CommandExecutor = (req: KuraCommandRequest) => Promise<KuraCommandResponse>;

/**
 * Ejecuta una llamada de herramienta pedida por un proveedor solo si pasa la lista permitida y el
 * tope por turno. Las rechazadas se informan al modelo como error y nunca llegan a la escena.
 */
async function runProviderTool(
  id: string,
  name: unknown,
  rawArgs: unknown,
  executeCommand: CommandExecutor,
  executedTools: AiTurnOutput['executedTools'],
): Promise<{ response: KuraCommandResponse; summary: string }> {
  const label = typeof name === 'string' ? name.slice(0, 64) : 'unknown';
  const checked = executedTools.length >= MAX_TOOL_CALLS_PER_TURN
    ? { ok: false as const, error: `Tool call limit (${MAX_TOOL_CALLS_PER_TURN}) reached for this turn` }
    : validateToolCall(name, rawArgs);
  const response: KuraCommandResponse = checked.ok
    ? await executeCommand({ id, ...checked.request })
    : { id, ok: false, error: checked.error };
  const summary = response.ok
    ? JSON.stringify(response.result ?? { ok: true })
    : `Error: ${response.error}`;
  executedTools.push({ name: label, result: summary });
  return { response, summary };
}

function providerBaseUrl(config: AiConfig, fallback: string, lang: LanguageCode): string {
  const baseUrl = (config.baseUrl.trim() || fallback).replace(/\/+$/, '');
  if (!isAllowedProviderUrl(baseUrl, isTauriRuntime())) {
    throw new Error(t(lang, 'ai.error.endpointBlocked'));
  }
  return baseUrl;
}

async function providerHttpError(provider: string, resp: Response, config: AiConfig): Promise<Error> {
  const errText = await resp.text().catch(() => '');
  return new Error(redactSecrets(`${provider} HTTP ${resp.status}: ${errText.slice(0, 220)}`, config.apiKey));
}

function buildSystemPrompt(lang: LanguageCode): string {
  if (lang === 'en') {
    return (
      'You are Kura3D Assistant, a precision 3D CAD and 3D-printing modeling expert. ' +
      'Internal scene units are millimeters (mm), Y-up (Y=0 is the build plate). ' +
      'Always use the provided tools to inspect or modify the 3D scene when the user asks to create, edit, hollow, cut, or export geometry. ' +
      'Be concise, accurate, and report actual dimensions.'
    );
  }
  return (
    'Eres el Asistente de Kura3D, experto en modelado CAD 3D e impresión 3D. ' +
    'Las unidades internas de la escena están en milímetros (mm), con eje Y hacia arriba (Y=0 es la cama). ' +
    'Usa siempre las herramientas disponibles cuando el usuario pida crear, transformar, ahuecar, cortar o exportar geometría. ' +
    'Responde en español de forma clara, breve y precisa.'
  );
}

/**
 * Asistente Local Determinista: interpreta comandos frecuentes en español e inglés
 * sin requerir clave API ni conexión a la nube.
 */
async function runLocalDeterministicAssistant(
  prompt: string,
  lang: LanguageCode,
  executeCommand: CommandExecutor,
): Promise<AiTurnOutput> {
  const lower = prompt.toLowerCase().trim();
  const executedTools: Array<{ name: string; result: string }> = [];

  const runTool = async (
    command: KuraCommandRequest['command'],
    params: Record<string, unknown>,
  ) => {
    const res = await executeCommand({
      id: `local_${Date.now()}`,
      command,
      params,
    });
    executedTools.push({
      name: command,
      result: res.ok ? JSON.stringify(res.result ?? { ok: true }) : `Error: ${res.error}`,
    });
    return res;
  };

  // Extrae números mencionados en el prompt (ej: "40mm", "20x30x50", "2.5")
  const numbers = Array.from(lower.matchAll(/(\d+(?:[.,]\d+)?)/g)).map((m) =>
    parseFloat(m[1].replace(',', '.')),
  );

  if (/export.*3mf|3mf/.test(lower)) {
    const res = await runTool('export_3mf', {});
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? 'Exported current scene to 3MF.'
          : 'Escena exportada en formato multicolor 3MF.'
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/export.*stl|stl/.test(lower)) {
    const res = await runTool('export_stl', {});
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? 'Exported current scene to binary STL.'
          : 'Escena exportada a archivo STL binario.'
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/ahuec|hollow|shell|vaci/.test(lower)) {
    const wall = numbers[0] && numbers[0] > 0.3 && numbers[0] < 30 ? numbers[0] : 2;
    const drainHole = /drenaj|drain|agujer/.test(lower);
    const res = await runTool('hollow_object', { wallThickness: wall, drainHole });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? `Applied hollow shell with ${wall} mm wall thickness.`
          : `Ahuecado aplicado con pared de ${wall} mm.`
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/tubo|tube|pipe/.test(lower)) {
    const outerRadius = numbers[0] ? numbers[0] / 2 : 16;
    const height = numbers[1] ?? (numbers[0] ? numbers[0] * 1.4 : 40);
    const innerRadius = Math.max(2, outerRadius - 3);
    const res = await runTool('create_primitive', {
      type: 'tube',
      outerRadius,
      innerRadius,
      height,
    });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? `Created hollow tube (R=${outerRadius}mm, H=${height}mm).`
          : `Tubo hueco creado (radio ext. ${outerRadius} mm, altura ${height} mm).`
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/cilindro|cylinder/.test(lower)) {
    const diameter = numbers[0] ?? 24;
    const height = numbers[1] ?? 40;
    const res = await runTool('create_primitive', {
      type: 'cylinder',
      radius: diameter / 2,
      height,
    });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? `Created cylinder (Ø${diameter} mm × ${height} mm).`
          : `Cilindro creado (Ø${diameter} mm × ${height} mm de alto).`
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/esfera|sphere|bola/.test(lower)) {
    const radius = numbers[0] ? numbers[0] / 2 : 18;
    const res = await runTool('create_primitive', { type: 'sphere', radius });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? `Created sphere (R=${radius} mm).`
          : `Esfera creada (radio ${radius} mm).`
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/cono|cone/.test(lower)) {
    const radius = numbers[0] ? numbers[0] / 2 : 18;
    const height = numbers[1] ?? 36;
    const res = await runTool('create_primitive', { type: 'cone', radius, height });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? `Created cone (R=${radius} mm, H=${height} mm).`
          : `Cono creado (radio ${radius} mm, altura ${height} mm).`
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/toro|torus|dona|anillo/.test(lower)) {
    const outerRadius = numbers[0] ? numbers[0] / 2 : 20;
    const tubeRadius = numbers[1] ?? 6;
    const res = await runTool('create_primitive', {
      type: 'torus',
      outerRadius,
      tubeRadius,
    });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? `Created torus.`
          : `Toroide creado.`
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/cubo|caja|box|bloque|cube/.test(lower)) {
    const w = numbers[0] ?? 30;
    const h = numbers[1] ?? w;
    const d = numbers[2] ?? w;
    const res = await runTool('create_primitive', {
      type: 'box',
      width: w,
      height: h,
      depth: d,
    });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? `Created box ${w} × ${h} × ${d} mm on the build plate.`
          : `Caja/Cubo de ${w} × ${h} × ${d} mm creado sobre la cama.`
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/centr|apoy|bed|cama/.test(lower)) {
    const res = await runTool('transform_object', { centerOnBed: true });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? 'Centered selected object on the build plate.'
          : 'Objeto centrado y apoyado sobre la cama (Y=0).'
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/duplic|clon|copia/.test(lower)) {
    const res = await runTool('duplicate_object', {});
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? 'Object duplicated.'
          : 'Objeto duplicado.'
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/unir|union|merge/.test(lower)) {
    const res = await runTool('boolean_operation', { op: 'union' });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? 'Boolean union completed.'
          : 'Unión booleana completada.'
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/restar|subtract|diferencia/.test(lower)) {
    const res = await runTool('boolean_operation', { op: 'subtract' });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? 'Boolean subtraction completed.'
          : 'Resta booleana completada.'
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/textur|fuzzy|molete|knurl|panal|honeycomb/.test(lower)) {
    const pattern = /knurl|molete/.test(lower)
      ? 'knurling'
      : /panal|honey/.test(lower)
        ? 'honeycomb'
        : /onda|wave/.test(lower)
          ? 'waves'
          : 'fuzzy';
    const res = await runTool('apply_texture', { pattern, depth: 0.45, scale: 4 });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? `Applied ${pattern} surface texture.`
          : `Textura superficial "${pattern}" aplicada.`
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  if (/cort|cut|divid/.test(lower)) {
    const res = await runTool('plane_cut', {
      axis: 'y',
      offset: 0,
      connectorType: 'dowel',
      connectorCount: 2,
    });
    return {
      assistantText: res.ok
        ? lang === 'en'
          ? 'Plane cut completed with dowel connectors.'
          : 'Corte por plano ejecutado con tarugos de unión.'
        : String(res.error),
      executedTools,
      usedLocalFallback: true,
    };
  }

  // Consulta informativa por defecto
  await runTool('get_scene_state', {});
  return {
    assistantText:
      lang === 'en'
        ? 'Local Deterministic Mode active (configure Gemini, OpenAI, Anthropic, or Ollama in Settings for full free-form AI). Try commands like: "Create box 40mm", "Cylinder 20x50", "Hollow 2mm", "Cut", or "Export STL".'
        : 'Modo Local Determinista activo (configura Gemini, OpenAI, Anthropic u Ollama en Ajustes para conversación IA libre). Prueba comandos directos como: "Crear cubo 40mm", "Cilindro 20x50", "Ahuecar 2mm", "Cortar" o "Exportar STL".',
    executedTools,
    usedLocalFallback: true,
  };
}

/** Llamada a Google Gemini REST API con Function Calling. */
async function callGeminiProvider(
  userPrompt: string,
  history: AiChatMessage[],
  config: AiConfig,
  lang: LanguageCode,
  executeCommand: CommandExecutor,
): Promise<AiTurnOutput> {
  const model = config.model || 'gemini-2.5-flash';
  // La clave viaja solo en la cabecera `x-goog-api-key`, nunca en la URL (historial, logs, proxies).
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

  const contents: Array<Record<string, unknown>> = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-8)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  contents.push({ role: 'user', parts: [{ text: userPrompt }] });

  const tools = [
    {
      functionDeclarations: KURA_TOOL_SCHEMAS.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];

  const executedTools: Array<{ name: string; result: string }> = [];

  for (let step = 0; step < 4; step++) {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(lang) }] },
        contents,
        tools,
        generationConfig: { temperature: config.temperature },
      }),
    });

    if (!resp.ok) throw await providerHttpError('Gemini', resp, config);

    const data = (await resp.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }> };
      }>;
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const fnCallPart = parts.find((p) => p.functionCall);

    if (!fnCallPart || !fnCallPart.functionCall) {
      const text = parts
        .map((p) => p.text ?? '')
        .join('\n')
        .trim();
      return {
        assistantText: text || 'OK',
        executedTools,
        usedLocalFallback: false,
      };
    }

    const { name, args } = fnCallPart.functionCall;
    const { response: cmdRes } = await runProviderTool(
      `gem_${Date.now()}_${step}`,
      name,
      args,
      executeCommand,
      executedTools,
    );

    contents.push({ role: 'model', parts });
    contents.push({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name,
            response: cmdRes.ok ? { result: cmdRes.result ?? { ok: true } } : { error: cmdRes.error },
          },
        },
      ],
    });
  }

  return {
    assistantText: lang === 'en' ? 'Actions completed.' : 'Acciones completadas.',
    executedTools,
    usedLocalFallback: false,
  };
}

/** Llamada a OpenAI / endpoints compatibles con OpenAI Chat Completions + Tools. */
async function callOpenAiProvider(
  userPrompt: string,
  history: AiChatMessage[],
  config: AiConfig,
  lang: LanguageCode,
  executeCommand: CommandExecutor,
): Promise<AiTurnOutput> {
  const baseUrl = providerBaseUrl(config, 'https://api.openai.com/v1', lang);
  const model = config.model || 'gpt-4o-mini';

  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: buildSystemPrompt(lang) },
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userPrompt },
  ];

  const tools = KURA_TOOL_SCHEMAS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const executedTools: Array<{ name: string; result: string }> = [];

  for (let step = 0; step < 4; step++) {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        temperature: config.temperature,
      }),
    });

    if (!resp.ok) throw await providerHttpError('OpenAI', resp, config);

    const data = (await resp.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const msg = data.choices?.[0]?.message;
    if (!msg) break;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        assistantText: msg.content?.trim() || 'OK',
        executedTools,
        usedLocalFallback: false,
      };
    }

    messages.push(msg);

    for (const tc of msg.tool_calls) {
      // Los argumentos llegan como cadena JSON; validateToolCall rechaza JSON inválido.
      const { summary } = await runProviderTool(
        `oai_${Date.now()}_${tc.id}`,
        tc.function?.name,
        tc.function?.arguments,
        executeCommand,
        executedTools,
      );

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: summary,
      });
    }
  }

  return {
    assistantText: lang === 'en' ? 'Actions completed.' : 'Acciones completadas.',
    executedTools,
    usedLocalFallback: false,
  };
}

/** Llamada a Anthropic Messages API con Tool Use. */
async function callAnthropicProvider(
  userPrompt: string,
  history: AiChatMessage[],
  config: AiConfig,
  lang: LanguageCode,
  executeCommand: CommandExecutor,
): Promise<AiTurnOutput> {
  const baseUrl = providerBaseUrl(config, 'https://api.anthropic.com', lang);
  const model = config.model || 'claude-3-5-sonnet-latest';

  const messages: Array<Record<string, unknown>> = [
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userPrompt },
  ];

  const tools = KURA_TOOL_SCHEMAS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  const executedTools: Array<{ name: string; result: string }> = [];

  for (let step = 0; step < 4; step++) {
    const resp = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: buildSystemPrompt(lang),
        messages,
        tools,
        temperature: config.temperature,
      }),
    });

    if (!resp.ok) throw await providerHttpError('Anthropic', resp, config);

    const data = (await resp.json()) as {
      content?: Array<{
        type: 'text' | 'tool_use';
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
    };

    const blocks = data.content ?? [];
    const toolUses = blocks.filter((b) => b.type === 'tool_use' && b.name && b.id);

    if (toolUses.length === 0) {
      const text = blocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n')
        .trim();
      return {
        assistantText: text || 'OK',
        executedTools,
        usedLocalFallback: false,
      };
    }

    messages.push({ role: 'assistant', content: blocks });

    const toolResults: Array<Record<string, unknown>> = [];
    for (const tu of toolUses) {
      const { summary } = await runProviderTool(
        `ant_${Date.now()}_${tu.id}`,
        tu.name,
        tu.input,
        executeCommand,
        executedTools,
      );
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: summary,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    assistantText: lang === 'en' ? 'Actions completed.' : 'Acciones completadas.',
    executedTools,
    usedLocalFallback: false,
  };
}

/** Llamada a Ollama local (`/api/chat`) con Tool Calling nativo. */
async function callOllamaProvider(
  userPrompt: string,
  history: AiChatMessage[],
  config: AiConfig,
  lang: LanguageCode,
  executeCommand: CommandExecutor,
): Promise<AiTurnOutput> {
  const baseUrl = providerBaseUrl(config, 'http://127.0.0.1:11434', lang);
  const model = config.model || 'llama3.1';

  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: buildSystemPrompt(lang) },
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userPrompt },
  ];

  const tools = KURA_TOOL_SCHEMAS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const executedTools: Array<{ name: string; result: string }> = [];

  for (let step = 0; step < 3; step++) {
    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        tools,
        stream: false,
        options: { temperature: config.temperature },
      }),
    });

    if (!resp.ok) throw await providerHttpError('Ollama', resp, config);

    const data = (await resp.json()) as {
      message?: {
        content?: string;
        tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
      };
    };

    const msg = data.message;
    if (!msg) break;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        assistantText: msg.content?.trim() || 'OK',
        executedTools,
        usedLocalFallback: false,
      };
    }

    messages.push(msg);

    for (const tc of msg.tool_calls) {
      const { summary } = await runProviderTool(
        `oll_${Date.now()}_${step}`,
        tc.function?.name,
        tc.function?.arguments,
        executeCommand,
        executedTools,
      );
      messages.push({ role: 'tool', content: summary });
    }
  }

  return {
    assistantText: lang === 'en' ? 'Actions completed.' : 'Acciones completadas.',
    executedTools,
    usedLocalFallback: false,
  };
}

/**
 * Envía un mensaje del usuario al proveedor configurado o al Asistente Local Determinista
 * cuando aún no se ha configurado una API Key.
 */
export async function sendAiPrompt(
  prompt: string,
  history: AiChatMessage[],
  config: AiConfig,
  lang: LanguageCode,
  executeCommand: CommandExecutor,
): Promise<AiTurnOutput> {
  const needsApiKey = config.provider !== 'ollama';
  if (needsApiKey && !config.apiKey.trim()) {
    return runLocalDeterministicAssistant(prompt, lang, executeCommand);
  }

  try {
    switch (config.provider) {
      case 'gemini':
        return await callGeminiProvider(prompt, history, config, lang, executeCommand);
      case 'openai':
        return await callOpenAiProvider(prompt, history, config, lang, executeCommand);
      case 'anthropic':
        return await callAnthropicProvider(prompt, history, config, lang, executeCommand);
      case 'ollama':
        return await callOllamaProvider(prompt, history, config, lang, executeCommand);
      default:
        return await runLocalDeterministicAssistant(prompt, lang, executeCommand);
    }
  } catch (error) {
    // Ningún error que llegue a la interfaz o a la consola puede contener la clave.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redactSecrets(message, config.apiKey));
  }
}
