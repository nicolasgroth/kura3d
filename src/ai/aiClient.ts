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

/** Definición neutral de herramienta compartida entre proveedores LLM. */
interface KuraToolSchema {
  name: KuraCommandRequest['command'];
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, Record<string, unknown>>;
    required?: string[];
  };
}

/** Catálogo compacto de herramientas de modelado 3D expuestas al modelo de lenguaje. */
const KURA_TOOL_SCHEMAS: KuraToolSchema[] = [
  {
    name: 'get_scene_state',
    description: 'Obtiene el listado de objetos actuales en la escena, dimensiones en mm, selección y unidad activa.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'create_primitive',
    description: 'Crea una nueva primitiva 3D paramétrica apoyada sobre la cama de impresión (en mm).',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['box', 'cylinder', 'tube', 'sphere', 'cone', 'torus', 'prism', 'text'],
          description: 'Tipo de primitiva geométrica.',
        },
        width: { type: 'number', description: 'Ancho en mm (para box/prism).' },
        height: { type: 'number', description: 'Altura en mm.' },
        depth: { type: 'number', description: 'Profundidad en mm.' },
        radius: { type: 'number', description: 'Radio en mm (sphere/cylinder/cone).' },
        outerRadius: { type: 'number', description: 'Radio exterior en mm (tube/torus).' },
        innerRadius: { type: 'number', description: 'Radio interior en mm (tube).' },
        text: { type: 'string', description: 'Texto a extruir si type=text.' },
        name: { type: 'string', description: 'Nombre descriptivo opcional.' },
        color: { type: 'string', description: 'Color hexadecimal #rrggbb opcional.' },
      },
      required: ['type'],
    },
  },
  {
    name: 'transform_object',
    description: 'Mueve, rota, escala, centra o apoya un objeto en la cama (Y=0).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID del objeto (si se omite usa el seleccionado).' },
        position: { type: 'array', items: { type: 'number' }, description: '[x, y, z] en mm.' },
        rotation: { type: 'array', items: { type: 'number' }, description: '[rx, ry, rz] en radianes.' },
        scale: { type: 'array', items: { type: 'number' }, description: '[sx, sy, sz].' },
        dropToBed: { type: 'boolean', description: 'Si es true, apoya la base del objeto en Y=0.' },
        centerOnBed: { type: 'boolean', description: 'Si es true, centra el objeto en X=0, Z=0 sobre la cama.' },
      },
    },
  },
  {
    name: 'hollow_object',
    description: 'Ahueca un sólido creando una cáscara cerrada (shell) con grosor de pared en mm.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        wallThickness: { type: 'number', description: 'Grosor de pared en mm (ej. 2.0).' },
        drainHole: { type: 'boolean', description: 'Agregar agujero inferior de drenaje.' },
      },
      required: ['wallThickness'],
    },
  },
  {
    name: 'boolean_operation',
    description: 'Ejecuta una operación booleana CSG Manifold entre dos objetos.',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['union', 'subtract', 'intersect'] },
        targetId: { type: 'string' },
        toolId: { type: 'string' },
      },
      required: ['op'],
    },
  },
  {
    name: 'plane_cut',
    description: 'Corta un objeto por un plano X/Y/Z agregando conectores mecánicos automáticos.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        axis: { type: 'string', enum: ['x', 'y', 'z'] },
        offset: { type: 'number' },
        connectorType: { type: 'string', enum: ['none', 'dowel', 'peg', 'dovetail'] },
        connectorCount: { type: 'number' },
        tolerance: { type: 'number' },
      },
    },
  },
  {
    name: 'apply_texture',
    description: 'Aplica una textura superficial procedural (fuzzy skin, knurling, waves, honeycomb, grid).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        pattern: { type: 'string', enum: ['fuzzy', 'knurling', 'waves', 'honeycomb', 'grid'] },
        depth: { type: 'number', description: 'Profundidad del relieve en mm.' },
        scale: { type: 'number', description: 'Escala del patrón en mm.' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'duplicate_object',
    description: 'Duplica el objeto especificado o seleccionado.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'delete_object',
    description: 'Elimina el objeto especificado o seleccionado.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'export_stl',
    description: 'Exporta la escena o selección actual a un archivo STL binario listo para imprimir.',
    parameters: {
      type: 'object',
      properties: { onlySelected: { type: 'boolean' } },
    },
  },
  {
    name: 'export_3mf',
    description: 'Exporta la escena multicolor en formato 3MF.',
    parameters: {
      type: 'object',
      properties: { onlySelected: { type: 'boolean' } },
    },
  },
];

export interface AiTurnOutput {
  assistantText: string;
  executedTools: Array<{ name: string; result: string }>;
  usedLocalFallback: boolean;
}

type CommandExecutor = (req: KuraCommandRequest) => Promise<KuraCommandResponse>;

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
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(lang) }] },
        contents,
        tools,
        generationConfig: { temperature: config.temperature },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini HTTP ${resp.status}: ${errText.slice(0, 220)}`);
    }

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
    const cmdRes = await executeCommand({
      id: `gem_${Date.now()}_${step}`,
      command: name as KuraCommandRequest['command'],
      params: args ?? {},
    });

    const summary = cmdRes.ok
      ? JSON.stringify(cmdRes.result ?? { ok: true })
      : `Error: ${cmdRes.error}`;
    executedTools.push({ name, result: summary });

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
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
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

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI HTTP ${resp.status}: ${errText.slice(0, 220)}`);
    }

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
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
      } catch {
        parsedArgs = {};
      }

      const cmdRes = await executeCommand({
        id: `oai_${Date.now()}_${tc.id}`,
        command: tc.function.name as KuraCommandRequest['command'],
        params: parsedArgs,
      });

      const summary = cmdRes.ok
        ? JSON.stringify(cmdRes.result ?? { ok: true })
        : `Error: ${cmdRes.error}`;
      executedTools.push({ name: tc.function.name, result: summary });

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
  const baseUrl = (config.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
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

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic HTTP ${resp.status}: ${errText.slice(0, 220)}`);
    }

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
      const cmdRes = await executeCommand({
        id: `ant_${Date.now()}_${tu.id}`,
        command: tu.name as KuraCommandRequest['command'],
        params: tu.input ?? {},
      });
      const summary = cmdRes.ok
        ? JSON.stringify(cmdRes.result ?? { ok: true })
        : `Error: ${cmdRes.error}`;
      executedTools.push({ name: tu.name!, result: summary });
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
  const baseUrl = (config.baseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
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

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Ollama HTTP ${resp.status}: ${errText.slice(0, 220)}`);
    }

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
      const cmdRes = await executeCommand({
        id: `oll_${Date.now()}_${step}`,
        command: tc.function.name as KuraCommandRequest['command'],
        params: tc.function.arguments ?? {},
      });
      const summary = cmdRes.ok
        ? JSON.stringify(cmdRes.result ?? { ok: true })
        : `Error: ${cmdRes.error}`;
      executedTools.push({ name: tc.function.name, result: summary });
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

  switch (config.provider) {
    case 'gemini':
      return callGeminiProvider(prompt, history, config, lang, executeCommand);
    case 'openai':
      return callOpenAiProvider(prompt, history, config, lang, executeCommand);
    case 'anthropic':
      return callAnthropicProvider(prompt, history, config, lang, executeCommand);
    case 'ollama':
      return callOllamaProvider(prompt, history, config, lang, executeCommand);
    default:
      return runLocalDeterministicAssistant(prompt, lang, executeCommand);
  }
}
