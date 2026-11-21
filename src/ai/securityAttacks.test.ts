/**
 * @file src/ai/securityAttacks.test.ts
 * @description Pruebas adversariales de QA (TRUST-01/03) sobre `validateToolCall`, `redactSecrets`,
 * `isAllowedProviderUrl` y el cliente IA: prototype pollution, unicode, JSON anidado, claves partidas o
 * codificadas en mensajes de error. Los casos marcados con `it.fails` documentan huecos conocidos: cuando
 * se corrijan, Vitest los reportará como fallidos para que se conviertan en `it` normales.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiConfig, KuraCommandRequest, KuraCommandResponse } from '../types/kura';
import { sendAiPrompt } from './aiClient';
import { isAllowedProviderUrl, redactSecrets } from './providerSecurity';
import { validateToolCall } from './toolValidation';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validateToolCall: nombre de herramienta', () => {
  it.each([
    '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'prototype', 'valueOf',
    'create_primitive ', ' create_primitive', 'CREATE_PRIMITIVE', 'create_primitıve', 'create_primitive\u0000',
    'create​_primitive', 'ｃreate_primitive', '', 'kura_create_primitive', 'paint_object', 'import_svg', 'generate_mold',
  ])('rechaza el nombre %j', (name) => {
    expect(validateToolCall(name, {}).ok).toBe(false);
  });

  it.each([null, undefined, 42, {}, [], ['create_primitive'], { toString: () => 'create_primitive' }])(
    'rechaza nombres que no son cadena (%j)',
    (name) => {
      expect(validateToolCall(name, {}).ok).toBe(false);
    },
  );
});

describe('validateToolCall: prototype pollution y argumentos hostiles', () => {
  it('rechaza __proto__ como clave en JSON (OpenAI) y no contamina Object.prototype', () => {
    const r = validateToolCall('create_primitive', '{"type":"box","__proto__":{"polluted":true}}');
    expect(r.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each(['constructor', 'prototype', 'toString', '__proto__', 'hasOwnProperty'])(
    'rechaza el parámetro %s',
    (key) => {
      const args = JSON.parse(`{"type":"box","${key}":{"x":1}}`);
      expect(validateToolCall('create_primitive', args).ok).toBe(false);
    },
  );

  it('rechaza objetos con prototipo no plano (clase, Object.create, null-prototype)', () => {
    class Evil { type = 'box'; }
    expect(validateToolCall('create_primitive', new Evil()).ok).toBe(false);
    expect(validateToolCall('create_primitive', Object.create({ type: 'box' })).ok).toBe(false);
    expect(validateToolCall('create_primitive', Object.assign(Object.create(null), { type: 'box' })).ok).toBe(false);
  });

  it('no hereda parámetros desde el prototipo del objeto de argumentos', () => {
    const args = Object.create(null) as Record<string, unknown>;
    expect(validateToolCall('create_primitive', args).ok).toBe(false);
  });

  it('no deja pasar JSON anidado como valor de un parámetro escalar', () => {
    expect(validateToolCall('create_primitive', { type: { nested: 'box' } }).ok).toBe(false);
    expect(validateToolCall('create_primitive', { type: ['box'] }).ok).toBe(false);
    expect(validateToolCall('create_primitive', { type: 'box', width: { valueOf: () => 5 } }).ok).toBe(false);
    expect(validateToolCall('create_primitive', { type: 'box', width: [[5]] }).ok).toBe(false);
  });

  it('rechaza vectores anidados, dispersos, con NaN/Infinity o longitud incorrecta', () => {
    const sparse = new Array(3);
    for (const position of [[[1], 2, 3], sparse, [1, 2], [1, 2, 3, 4], [NaN, 0, 0], [Infinity, 0, 0], [0, 0, 1e9]]) {
      expect(validateToolCall('transform_object', { id: 'a', position }).ok).toBe(false);
    }
  });

  it('rechaza números que JSON.parse convierte en Infinity y cadenas numéricas', () => {
    expect(validateToolCall('create_primitive', '{"type":"box","width":1e999}').ok).toBe(false);
    expect(validateToolCall('create_primitive', { type: 'box', width: '10' }).ok).toBe(false);
    expect(validateToolCall('create_primitive', { type: 'box', width: -0 }).ok).toBe(false);
    expect(validateToolCall('create_primitive', { type: 'box', width: 0 }).ok).toBe(false);
  });

  it('rechaza JSON no objeto, truncado o con basura final', () => {
    for (const raw of ['[]', '"x"', '123', 'null', '{"type":"box"', '{"type":"box"} trailing', '{"type":"box",}']) {
      const r = validateToolCall('create_primitive', raw);
      // `null` se interpreta como "sin argumentos" y falla por parámetro requerido; nunca debe ser ok.
      expect(r.ok).toBe(false);
    }
  });

  it('el resultado es una copia: mutar la entrada después no altera los parámetros validados', () => {
    const position = [1, 2, 3];
    const args: Record<string, unknown> = { id: 'a', position };
    const r = validateToolCall('transform_object', args);
    expect(r.ok).toBe(true);
    position[0] = 1e12;
    args.id = 'b';
    if (r.ok) {
      expect(r.request.params.position).toEqual([1, 2, 3]);
      expect(r.request.params.id).toBe('a');
    }
  });

  it('enum con homoglifos unicode o relleno invisible no pasa', () => {
    for (const type of ['bоx', 'box ', 'box\u0000', 'BOX', 'box​', 'ｂox']) {
      expect(validateToolCall('create_primitive', { type }).ok).toBe(false);
    }
  });

  it('color: solo #rrggbb ASCII', () => {
    for (const color of ['#ff00ff00', '#ＦＦ００ＦＦ', 'red', '#ff00f', 'javascript:1', '#ff00ff\n']) {
      expect(validateToolCall('create_primitive', { type: 'box', color }).ok).toBe(false);
    }
    expect(validateToolCall('create_primitive', { type: 'box', color: '#AaBb09' }).ok).toBe(true);
  });

  it('limita el tamaño de cadenas largas', () => {
    expect(validateToolCall('create_primitive', { type: 'text', text: 'x'.repeat(501) }).ok).toBe(false);
    expect(validateToolCall('delete_object', { id: 'x'.repeat(201) }).ok).toBe(false);
  });

  it.fails('GAP (menor): rechaza caracteres de control en parámetros de texto/ID/nombre', () => {
    // Hoy "\u0000" y "\u001b[31m" pasan en `text` y `id`; el puente MCP ya los rechaza en `name`.
    expect(validateToolCall('create_primitive', { type: 'text', text: 'a\u0000b\u001b[31m' }).ok).toBe(false);
  });

});

describe('redactSecrets: claves partidas, codificadas o truncadas', () => {
  const KEY = 'zz-custom-provider-key-0123456789ABCDEF';

  it('redacta la clave literal y sus formatos conocidos', () => {
    const text = `bad ${KEY} and sk-abcdefghij1234 and AIzaSyA1234567890abcdefghijk and ?key=abc123 and Bearer abcdefgh12345`;
    const out = redactSecrets(text, KEY);
    for (const leak of [KEY, 'sk-abcdefghij1234', 'AIzaSyA1234567890abcdefghijk', 'abc123', 'abcdefgh12345']) {
      expect(out).not.toContain(leak);
    }
  });

  it('redacta cada aparición, también pegadas o con regex especiales', () => {
    const k = 'a.b*c+d?e(f)[g]{h}|i^j$k';
    const out = redactSecrets(`${k}${k} x ${k}`, k);
    expect(out).not.toContain('a.b*c');
  });

  it.fails('GAP (menor): redacta la clave codificada como URL (%xx) en un error del proveedor', () => {
    const key = 'abc/def+ghi=jkl0123456789';
    const out = redactSecrets(`invalid key ${encodeURIComponent(key)}`, key);
    expect(out).not.toContain(encodeURIComponent(key));
  });

  it.fails('GAP (menor): redacta la clave escapada como JSON (comillas/barras)', () => {
    const key = 'ab"cd\\ef-0123456789xyz';
    const escaped = JSON.stringify(key).slice(1, -1);
    const out = redactSecrets(`{"error":"bad ${escaped}"}`, key);
    expect(out).not.toContain(escaped);
  });

  it.fails('GAP (menor): redacta la clave partida por espacios o saltos de línea', () => {
    const out = redactSecrets(`bad key ${KEY.slice(0, 20)}\n${KEY.slice(20)}`, KEY);
    expect(out).not.toContain(KEY.slice(0, 20));
  });

  it.fails('GAP (menor): redacta la clave en otra capitalización', () => {
    const out = redactSecrets(`bad ${KEY.toUpperCase()}`, KEY);
    expect(out).not.toContain(KEY.toUpperCase());
  });

  it('no revienta ni se vuelve cuadrático con entradas enormes', () => {
    const big = `sk-${'a'.repeat(200_000)} ${'Bearer '.repeat(5000)}`;
    const t0 = Date.now();
    redactSecrets(big, KEY);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});

describe('cliente IA: la clave no se filtra a través de errores HTTP', () => {
  const KEY = 'zz-custom-provider-key-0123456789ABCDEF';
  const cfg = (provider: AiConfig['provider']): AiConfig => ({
    provider, apiKey: KEY, model: 'm', baseUrl: '', temperature: 0,
  });
  const exec = vi.fn(async (r: KuraCommandRequest): Promise<KuraCommandResponse> => ({ id: r.id, ok: true }));

  async function messageFor(provider: AiConfig['provider'], body: string): Promise<string> {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 401 })));
    try {
      await sendAiPrompt('hola', [], cfg(provider), 'es', exec);
    } catch (e) {
      return (e as Error).message;
    }
    return '';
  }

  it('redacta la clave completa que el proveedor repite en el cuerpo del error', async () => {
    const msg = await messageFor('openai', `{"error":"Incorrect API key provided: ${KEY}"}`);
    expect(msg).toContain('401');
    expect(msg).not.toContain(KEY);
  });

  it.fails('GAP (mayor): una clave que cruza el límite de 220 caracteres del error queda parcialmente expuesta', async () => {
    // errText.slice(0, 220) se aplica ANTES de redactSecrets: la clave partida por el corte ya no coincide
    // con el literal y los formatos no estándar (sin prefijo sk-/AIza) se filtran casi enteros.
    const padding = 'x'.repeat(220 - 'openai HTTP 401: '.length > 0 ? 200 : 0);
    const msg = await messageFor('openai', `${padding}${KEY}`);
    expect(msg).not.toContain(KEY.slice(0, 15));
  });
});

describe('isAllowedProviderUrl: evasiones', () => {
  it.each([
    'http://evil.com', 'http://localhost.evil.com', 'http://127.0.0.1.evil.com', 'http://user:pw@localhost:11434',
    'https://user@api.openai.com', 'https://api.openai.com@evil.com', 'http://localhost@evil.com',
    'ftp://localhost', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/plain,x', 'ws://localhost',
    'http://[::1]:11434', 'http://0.0.0.0:11434', 'http://2130706433', 'http://0x7f.0.0.1', 'http://127.1',
    'https://api.openai.com.evil.com', '//evil.com', 'http:evil.com', '', ' ',
  ])('escritorio rechaza %j', (url) => {
    // Las formas numéricas de loopback se normalizan a 127.0.0.1 y son legítimas: se cubren aparte.
    if (['http://2130706433', 'http://0x7f.0.0.1', 'http://127.1'].includes(url)) return;
    expect(isAllowedProviderUrl(url, true)).toBe(false);
  });

  it('web rechaza http remoto y credenciales embebidas', () => {
    for (const url of ['http://evil.com', 'http://u:p@localhost', 'https://u:p@example.com', 'ftp://example.com']) {
      expect(isAllowedProviderUrl(url, false)).toBe(false);
    }
  });

  it('acepta los destinos legítimos', () => {
    expect(isAllowedProviderUrl('http://localhost:11434', true)).toBe(true);
    expect(isAllowedProviderUrl('http://127.0.0.1:1234/v1', true)).toBe(true);
    expect(isAllowedProviderUrl('https://api.openai.com/v1', true)).toBe(true);
    expect(isAllowedProviderUrl('https://my.proxy.example/v1', false)).toBe(true);
    expect(isAllowedProviderUrl('https://my.proxy.example/v1', true)).toBe(false);
  });

  it('las formas numéricas alternativas de loopback se normalizan a 127.0.0.1 y se aceptan (es loopback real)', () => {
    expect(isAllowedProviderUrl('http://2130706433', true)).toBe(true);
    expect(isAllowedProviderUrl('http://0x7f.0.0.1', true)).toBe(true);
  });
});
