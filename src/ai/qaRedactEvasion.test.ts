/**
 * @file src/ai/qaRedactEvasion.test.ts
 * @description QA adversarial de `redactSecrets` y `validateToolCall`: evasiones por codificación, separadores,
 * formatos de credenciales de otros proveedores y llamadas de herramienta con parámetros al borde.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { redactSecrets } from './providerSecurity';
import { validateToolCall } from './toolValidation';

const KEY = 'mistralKEY0123456789abcdefghijklmn';
const b64 = (s: string) => btoa(s);

type Case = [string, string];
const echoes = (k: string): Case[] => [
  ['plano', `bad key ${k}`],
  ['url-encode', `bad ${encodeURIComponent(k)}`],
  ['doble url-encode', `bad ${encodeURIComponent(encodeURIComponent(k + '/+='))}`],
  ['json escapado', JSON.stringify({ e: k }).replace(/"/g, '\\"')],
  ['mayúsculas', k.toUpperCase()],
  ['minúsculas', k.toLowerCase()],
  ['partida por espacios', k.replace(/(.{5})/g, '$1 ')],
  ['partida por saltos', k.replace(/(.{7})/g, '$1\n')],
  ['partida por guiones', k.replace(/(.{6})/g, '$1-')],
  ['partida por puntos', k.replace(/(.{6})/g, '$1.')],
  ['partida por comillas', k.replace(/(.{8})/g, '$1" + "')],
  ['escapes \\uXXXX', [...k].map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('')],
  ['entidades &#NN;', [...k].map((c) => `&#${c.charCodeAt(0)};`).join('')],
  ['hex', [...k].map((c) => c.charCodeAt(0).toString(16)).join('')],
  ['base64', b64(k)],
  ['base64 en Basic', `Authorization: Basic ${b64('user:' + k)}`],
  ['invertida', [...k].reverse().join('')],
  ['con ZWSP', k.replace(/(.{6})/g, '$1​')],
  ['con soft hyphen', k.replace(/(.{6})/g, '$1­')],
  ['full-width', [...k].map((c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).join('')],
  ['enmascarada con sufijo', `${k.slice(0, 20)}***${k.slice(-4)}`],
  ['truncada 24', k.slice(0, 24)],
];

// La clave (o 16 caracteres seguidos de ella) sigue visible.
const leaks = (out: string, k: string) => {
  for (let i = 0; i + 16 <= k.length; i++) if (out.toLowerCase().includes(k.slice(i, i + 16).toLowerCase())) return true;
  return false;
};

describe('QA redactSecrets: eco de la clave con transformaciones', () => {
  const results = echoes(KEY).map(([name, text]) => ({ name, text, out: redactSecrets(text, KEY) }));

  // Brechas conocidas (menor): una clave truncada o enmascarada deja visible su prefijo; it.fails pasará a verde al cerrarlas.
  const GAPS = new Set(['enmascarada con sufijo', 'truncada 24']);
  it.each(results.filter((r) => !GAPS.has(r.name)).map((r) => [r.name, r] as const))('%s', (_n, r) => {
    expect(leaks(r.out, KEY) || r.out.includes(KEY), `filtrado: ${r.out.slice(0, 120)}`).toBe(false);
  });
  it.fails.each(results.filter((r) => GAPS.has(r.name)).map((r) => [r.name, r] as const))('BRECHA %s', (_n, r) => {
    expect(leaks(r.out, KEY), `filtrado: ${r.out.slice(0, 120)}`).toBe(false);
  });
});

describe('QA redactSecrets: credenciales de otros proveedores sin la clave conocida', () => {
  const samples: Case[] = [
    ['openai sk-proj', 'x sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'],
    ['anthropic', 'x sk-ant-api03-AbCdEf_GhIj-KlMnOpQrStUvWxYz0123456789'],
    ['gemini query', 'https://x/v1?key=AIzaSyA1234567890abcdefghijklmnopqrstu&alt=sse'],
    ['gemini header', 'x-goog-api-key: AIzaSyA1234567890abcdefghijklmnopqrstu'],
    ['groq', 'gsk_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKl'],
    ['xai', 'xai-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGh'],
    ['huggingface', 'hf_AbCdEfGhIjKlMnOpQrStUvWxYz01234567'],
    ['perplexity', 'pplx-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCd'],
    ['github', 'ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'],
    ['aws', 'AKIAIOSFODNN7EXAMPLE'],
    ['json api_key', '{"api_key":"abcd1234abcd1234abcd1234abcd1234"}'],
    ['json apiKey', '{"apiKey": "abcd1234abcd1234abcd1234abcd1234"}'],
    ['x-api-key', 'x-api-key: abcd1234abcd1234abcd1234abcd1234'],
    ['authorization sin Bearer', 'Authorization: abcd1234abcd1234abcd1234abcd1234'],
    ['Bearer nbsp', 'Bearer abcd1234abcd1234abcd1234'],
    ['query access_token', 'https://x/?access_token=abcd1234abcd1234abcd1234'],
    ['query api-key', 'https://x/?api-key=abcd1234abcd1234abcd1234'],
    ['query APIKEY mayúsculas', 'https://x/?APIKEY=abcd1234abcd1234abcd1234'],
    ['query auth', 'https://x/?auth=abcd1234abcd1234abcd1234'],
    ['query secret', 'https://x/?secret=abcd1234abcd1234abcd1234'],
    ['SK- mayúsculas', 'SK-ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  ];
  const GAP_FORMATS = new Set(['groq', 'xai', 'huggingface', 'perplexity', 'github', 'aws', 'json api_key', 'json apiKey', 'x-api-key',
    'authorization sin Bearer', 'query access_token', 'query api-key', 'query auth', 'query secret', 'SK- mayúsculas']);
  // Brechas conocidas (menor, defensa en profundidad: la clave activa sí se redacta por literal).
  it.fails.each(samples.filter(([n]) => GAP_FORMATS.has(n)))('BRECHA %s', (_n, text) => {
    const out = redactSecrets(text);
    const m = /(?:sk-[\w-]{8,}|AIza\w{20,}|gsk_\w+|xai-[\w-]+|hf_\w+|pplx-[\w-]+|ghp_\w+|AKIA\w+|abcd1234abcd1234abcd1234)/i.exec(text);
    expect(out).not.toContain(m![0].slice(0, 12));
  });
  it.each(samples.filter(([n]) => !GAP_FORMATS.has(n)))('%s', (_n, text) => {
    const out = redactSecrets(text);
    const m = /(?:sk-[\w-]{8,}|AIza\w{20,}|gsk_\w+|xai-[\w-]+|hf_\w+|pplx-[\w-]+|ghp_\w+|AKIA\w+|abcd1234abcd1234abcd1234)/i.exec(text);
    expect(m, 'muestra mal formada').not.toBeNull();
    expect(out, `credencial visible: ${out}`).not.toContain(m![0].slice(0, 12));
  });

  it('tiempo lineal con entradas de 5 MB y con claves hostiles', () => {
    const t0 = performance.now();
    redactSecrets('a '.repeat(2_500_000) + 'Bearer ' + 'x'.repeat(1_000_000), 'a b c d e f g h');
    redactSecrets('s'.repeat(5_000_000), 'ssssssssssssssssssssss');
    redactSecrets('k'.repeat(5_000_000), 'sk-' + 'k'.repeat(105));
    expect(performance.now() - t0).toBeLessThan(4000);
  });
});

describe('QA validateToolCall: bordes y evasiones', () => {
  const bad: Array<[string, unknown, unknown]> = [
    ['nombre con prototipo', '__proto__', {}],
    ['nombre constructor', 'constructor', {}],
    ['nombre toString', 'toString', {}],
    ['args como array', 'create_primitive', [1, 2]],
    ['args JSON de 5 MB', 'create_primitive', '{"type":"box","name":"' + 'a'.repeat(5_000_000) + '"}'],
    ['posición NaN en JSON string', 'transform_object', '{"id":"a","position":[NaN,0,0]}'],
    ['posición como string', 'transform_object', { id: 'a', position: ['1', '2', '3'] }],
    ['vector de 4 comps', 'transform_object', { id: 'a', position: [1, 2, 3, 4] }],
    ['id con control', 'delete_object', { id: 'a\u0000b' }],
    ['id 5000 chars', 'delete_object', { id: 'a'.repeat(5000) }],
    ['parámetro extra', 'delete_object', { id: 'a', force: true }],
    ['connectorCount fraccional', 'plane_cut', { id: 'a', axis: 'x', connectorCount: 1.5 }],
    ['text con control', 'create_primitive', { type: 'text', text: 'a\u0007b' }],
    ['color sin #', 'create_primitive', { type: 'box', color: '38bdf8' }],
    ['tipo desconocido', 'create_primitive', { type: 'dodecahedron' }],
  ];
  it.each(bad)('rechaza %s', (_n, name, args) => {
    const v = validateToolCall(name, args);
    expect(v.ok, JSON.stringify(v).slice(0, 200)).toBe(false);
  });

  it('un valor aceptado por la capa de IA nunca contiene claves heredadas del prototipo', () => {
    const v = validateToolCall('create_primitive', JSON.parse('{"type":"box","__proto__":{"polluted":true},"width":5}') as unknown);
    if (v.ok) expect(Object.prototype.hasOwnProperty.call(v.request.params, 'polluted')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
