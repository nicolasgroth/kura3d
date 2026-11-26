/**
 * @file mcp-server/src/__tests__/mcpThreadsExport3mf.test.ts
 * @description QA ronda 6 del servidor MCP sin interfaz. (D) `slicerTarget` enviado se ignora, `approximate: true`
 * en imprimibilidad, rosca M3 y M64 válidas y M2/M65 con error tipado en inglés, tope de 10 intentos fallidos
 * (el 11.º y un token válido posterior quedan bloqueados) y todos los textos visibles al cliente en inglés
 * (descripciones, errores de herramientas y respuestas HTTP del puente). Las pruebas `it.fails` documentan brechas
 * CONFIRMADAS.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createKuraMcpServer } from '../index.js';

const TOKEN = 'q'.repeat(16) + 'A1b2C3d4E5f6G7h8';
const cleanup: Array<() => Promise<void>> = [];
let tempDir = '';
beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'kura3d-qa6-'));
});
afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()?.();
});

async function session() {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0, exportDir: tempDir });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa6', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  cleanup.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  const raw = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  const text = (r: Awaited<ReturnType<typeof raw>>) => (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('\n');
  const call = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown>): Promise<T> => {
    const r = await raw(name, args);
    if (r.isError) throw new Error(text(r));
    return JSON.parse(text(r)) as T;
  };
  return { client, raw, text, call };
}

/** Caracteres acentuados/ñ/¿¡ y palabras españolas frecuentes: no deben aparecer en lo que ve el cliente MCP. */
const ACCENTED = /[áéíóúüñÁÉÍÓÚÑ¿¡]/;
const SPANISH_WORDS = /\b(el|la|los|las|una?|de|del|que|para|con|sin|por|pieza|piezas|unión|uniones|objeto|mensaje|espera|intentos|fallidos|demasiados|error al|no se puede|debe|puede|altura|ancho|fondo)\b/i;
const looksSpanish = (s: string) => ACCENTED.test(s) || /\b(demasiados|intentos|espera un|no se puede|pieza|uniones?|objeto|debe ser|altura|ancho|fondo)\b/i.test(s);

describe('rosca M3 / M64 válidas, M2 / M65 con error tipado en inglés', () => {
  it.each([[3, 0.5], [64, 6]])('M%i (paso %f) se crea con la rosca pedida', async (d, pitch) => {
    const { call } = await session();
    for (const kind of ['bolt', 'nut', 'hole']) {
      const r = await call<{ id: string; stats: { dimensionsMm: number[] } }>('kura_create_thread', { kind, diameterMm: d, pitchMm: pitch, lengthMm: 12, placement: 'origin' });
      expect(r.id).toBeTruthy();
      expect(r.stats.dimensionsMm.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
    }
  }, 120_000);

  it.each([[2, 'below'], [65, 'above'], [2.99, 'below'], [64.01, 'above'], [0, 'zero'], [-3, 'negative'], [Number.NaN, 'nan']])(
    'M%s (%s) falla con isError y mensaje en inglés',
    async (d) => {
      const { raw, text } = await session();
      const r = await raw('kura_create_thread', { kind: 'bolt', diameterMm: d, pitchMm: 0.5, lengthMm: 10 });
      expect(r.isError).toBe(true);
      const msg = text(r);
      expect(msg.length).toBeGreaterThan(10);
      expect(looksSpanish(msg), msg).toBe(false);
    },
  );

  it('el error de rango del MCP es tipado: trae un código estable, no solo texto libre', async () => {
    const { raw, text } = await session();
    const r = await raw('kura_create_thread', { kind: 'bolt', diameterMm: 2, pitchMm: 0.5, lengthMm: 10 });
    expect(r.isError).toBe(true);
    // Los errores del motor llegan como "[CODE] mensaje" más un bloque JSON { code, params }; los de validación del SDK
    // llegan como error JSON-RPC -32602 (código de protocolo, en inglés) sin código de Kurra Studio.
    expect(text(r)).toMatch(/\[[A-Z_]+\]|"code"|-32602/);
  });

  it('el paso por defecto (1,25) en M3 se rechaza con mensaje claro o se ajusta; nunca queda a medias', async () => {
    const { raw, text } = await session();
    const r = await raw('kura_create_thread', { kind: 'bolt', diameterMm: 3, lengthMm: 10 });
    if (r.isError) expect(looksSpanish(text(r))).toBe(false);
    else expect(JSON.parse(text(r)).stats.dimensionsMm.every((v: number) => v > 0)).toBe(true);
  }, 60_000);
});

describe('slicerTarget ignorado y approximate', () => {
  it('kura_export_3mf con slicerTarget (válido o no) no falla y produce el mismo archivo', async () => {
    const { call } = await session();
    const box = await call<{ id: string }>('kura_create_primitive', { primitiveType: 'box', params: { width: 10, depth: 10, height: 10 }, placement: 'origin' });
    const base = await call<{ path?: string; filePath?: string; bytes?: number }>('kura_export_3mf', { outputPath: 'qa6-base.3mf', objectIds: [box.id] });
    const withTarget = await call<{ bytes?: number }>('kura_export_3mf', { outputPath: 'qa6-bambu.3mf', objectIds: [box.id], slicerTarget: 'bambu' });
    const bogus = await call<{ bytes?: number }>('kura_export_3mf', { outputPath: 'qa6-bogus.3mf', objectIds: [box.id], slicerTarget: 'no-existe' });
    expect(withTarget.bytes).toBe(base.bytes);
    expect(bogus.bytes).toBe(base.bytes);
    const files = (await readdir(tempDir)).filter((f) => f.startsWith('qa6-'));
    expect(files.sort()).toEqual(['qa6-base.3mf', 'qa6-bambu.3mf', 'qa6-bogus.3mf'].sort());
    const [a, b, c] = await Promise.all(['qa6-base.3mf', 'qa6-bambu.3mf', 'qa6-bogus.3mf'].map((f) => readFile(join(tempDir, f))));
    expect(b.length).toBe(a.length);
    expect(c.length).toBe(a.length);
  }, 60_000);

  it('el esquema de kura_export_3mf no declara slicerTarget y la descripción lo da por obsoleto', async () => {
    const { client } = await session();
    const tool = (await client.listTools()).tools.find((t) => t.name === 'kura_export_3mf')!;
    expect(Object.keys((tool.inputSchema as { properties: object }).properties)).not.toContain('slicerTarget');
    expect(tool.description).toMatch(/slicerTarget.*(obsolete|ignored)/i);
  });

  it('kura_analyze_printability devuelve approximate: true y una nota', async () => {
    const { call } = await session();
    const box = await call<{ id: string }>('kura_create_primitive', { primitiveType: 'box', params: { width: 20, depth: 20, height: 20 }, placement: 'origin' });
    const r = await call<{ approximate: boolean; estimateNote: string; warnings: string[] }>('kura_analyze_printability', { objectId: box.id });
    expect(r.approximate).toBe(true);
    expect(r.estimateNote.length).toBeGreaterThan(5);
    expect(looksSpanish(r.estimateNote), r.estimateNote).toBe(false);
    for (const w of r.warnings) expect(looksSpanish(w), w).toBe(false);
  }, 60_000);
});

describe('tope de 10 intentos fallidos', () => {
  function attempt(url: string): Promise<{ status: number | 'open'; body: string }> {
    return new Promise((resolve) => {
      const ws = new WebSocket(url);
      ws.once('open', () => { cleanup.push(async () => ws.terminate()); resolve({ status: 'open', body: '' }); });
      ws.once('unexpected-response', (_req, res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      });
      ws.once('error', () => resolve({ status: 0, body: '' }));
    });
  }
  async function start() {
    const { bridge } = createKuraMcpServer({ bridgePort: 0, authToken: TOKEN });
    await bridge.start();
    cleanup.push(() => bridge.close());
    return `ws://127.0.0.1:${bridge.getPort()}`;
  }

  it('10 tokens malos dan 401, el 11.º da 429 y un token válido posterior también', async () => {
    const base = await start();
    for (let i = 0; i < 10; i++) expect((await attempt(`${base}/?token=mal-${i}`)).status, `intento ${i + 1}`).toBe(401);
    expect((await attempt(`${base}/?token=mal-10`)).status).toBe(429);
    expect((await attempt(`${base}/?token=${TOKEN}`)).status).toBe(429);
    expect((await attempt(`${base}/?token=${TOKEN}`)).status).toBe(429);
  });

  it('antes del tope, un token válido sí conecta', async () => {
    const base = await start();
    for (let i = 0; i < 9; i++) await attempt(`${base}/?token=mal-${i}`);
    expect((await attempt(`${base}/?token=${TOKEN}`)).status).toBe('open');
  });

  it('el rechazo por Host/Origin ajeno (403) no consume el cupo de intentos', async () => {
    const base = await start();
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => {
        const ws = new WebSocket(`${base}/?token=mal`, { headers: { origin: 'http://evil.example' } });
        ws.once('unexpected-response', () => r(null));
        ws.once('error', () => r(null));
      });
    }
    expect((await attempt(`${base}/?token=${TOKEN}`)).status).toBe('open');
  });

  // Corregida (antes `it.fails`): el 429 del puente salía en español.
  it('las respuestas HTTP de rechazo (429) están en inglés', async () => {
    const base = await start();
    for (let i = 0; i < 10; i++) await attempt(`${base}/?token=mal-${i}`);
    const r = await attempt(`${base}/?token=${TOKEN}`);
    expect(r.status).toBe(429);
    expect(looksSpanish(r.body), r.body).toBe(false);
  });
  it('las respuestas HTTP 401 y 403 están en inglés', async () => {
    const base = await start();
    const r401 = await attempt(`${base}/?token=mal`);
    expect(r401.status).toBe(401);
    expect(looksSpanish(r401.body), r401.body).toBe(false);
  });
});

describe('todos los textos visibles al cliente MCP están en inglés', () => {
  it('títulos, descripciones y esquemas de todas las herramientas no traen español', async () => {
    const { client } = await session();
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(25);
    const bad: string[] = [];
    for (const t of tools) {
      const blob = JSON.stringify({ title: t.title, description: t.description, input: t.inputSchema, annotations: t.annotations });
      if (looksSpanish(blob)) bad.push(`${t.name}: ${blob.match(/.{0,40}([áéíóúüñÁÉÍÓÚÑ¿¡]|\b(?:demasiados|intentos|pieza|uniones?|objeto|debe ser)\b).{0,40}/i)?.[0]}`);
    }
    expect(bad).toEqual([]);
    const res = await client.listResources().catch(() => ({ resources: [] as Array<{ name: string; description?: string }> }));
    for (const r of res.resources) expect(looksSpanish(`${r.name} ${r.description ?? ''}`), r.name).toBe(false);
  });

  it('los errores de las herramientas (parámetros inválidos, objeto inexistente, bloqueos) están en inglés', async () => {
    const { raw, text } = await session();
    const attempts: Array<[string, Record<string, unknown>]> = [
      ['kura_transform_object', { objectId: 'no-existe', position: [0, 0, 0] }],
      ['kura_plane_cut', { objectId: 'no-existe', axis: 'z', offset: 0 }],
      ['kura_split_for_bed', { objectId: 'no-existe' }],
      ['kura_validate_assembly', { groupId: 'no-existe' }],
      ['kura_validate_assembly', {}],
      ['kura_align_objects', { objectIds: ['a', 'b'], mode: 'minZ' }],
      ['kura_mirror_object', { objectId: 'no-existe', axis: 'z' }],
      ['kura_generate_mold', { objectId: 'no-existe', mode: 'direct_2part' }],
      ['kura_project_on_surface', { objectId: 'no-existe', kind: 'text', text: 'A' }],
      ['kura_create_primitive', { primitiveType: 'box', params: { width: -5 } }],
      ['kura_create_primitive', { primitiveType: 'box', params: { width: 1e9 } }],
      ['kura_create_primitive', { primitiveType: 'nube' }],
      ['kura_hollow_object', { objectId: 'no-existe', wallThickness: 2 }],
      ['kura_export_stl', { outputPath: '../fuera.stl' }],
      ['kura_export_stl', { outputPath: 'a:b.stl' }],
      ['kura_analyze_printability', { objectId: 'no-existe' }],
      ['kura_set_printer_profile', { profileId: 'no-existe' }],
      ['kura_split_disconnected', { objectId: 'no-existe' }],
      ['kura_boolean_operation', { operation: 'union', targetId: 'x', toolIds: ['y'] }],
    ];
    const bad: string[] = [];
    for (const [name, args] of attempts) {
      const r = await raw(name, args);
      const msg = text(r);
      if (looksSpanish(msg)) bad.push(`${name}: ${msg.slice(0, 160)}`);
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('errores del motor tras una operación real (corte que no cruza, dividir con exceso de piezas, mold) en inglés', async () => {
    const { raw, text, call } = await session();
    const box = await call<{ id: string }>('kura_create_primitive', { primitiveType: 'box', params: { width: 100, depth: 100, height: 100 }, placement: 'origin' });
    const probes: Array<[string, Record<string, unknown>]> = [
      ['kura_plane_cut', { objectId: box.id, axis: 'z', offset: 900 }],
      ['kura_split_for_bed', { objectId: box.id, bedWidthMm: 20, bedDepthMm: 20, bedHeightMm: 20, maxPieces: 2 }],
      ['kura_split_for_bed', { objectId: box.id, bedWidthMm: 30, bedDepthMm: 30, bedHeightMm: 30, axes: ['x'], connectorType: 'dowel' }],
      ['kura_hollow_object', { objectId: box.id, wallThickness: 80 }],
      ['kura_plane_cut', { objectId: box.id, axis: 'z', offset: 0, connectorType: 'dowel', connectorSize: 200 }],
      ['kura_validate_assembly', { groupId: box.id }],
      ['kura_create_thread', { kind: 'nut', diameterMm: 8, pitchMm: 5, lengthMm: 10 }],
    ];
    const bad: string[] = [];
    for (const [name, args] of probes) {
      const r = await raw(name, args);
      const msg = text(r);
      if (looksSpanish(msg)) bad.push(`${name}: ${msg.slice(0, 200)}`);
    }
    expect(bad).toEqual([]);
  }, 120_000);

  // Corregida (antes `it.fails`): bridge.ts respondía el 429 en español.
  it('el texto fuente de mensajes al cliente (failText, reject, done, Error) no contiene español', async () => {
    const src = join(__dirname, '..');
    const bad: string[] = [];
    for (const f of (await readdir(src)).filter((n) => n.endsWith('.ts'))) {
      const lines = (await readFile(join(src, f), 'utf8')).split('\n');
      lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        // Mensajes que salen por el protocolo o la red (no logs de consola del operador)
        if (/(failText|reject|done|new Error|new HeadlessCommandError|throw new)\s*\(/.test(t) && /[áéíóúñ¿¡]|Demasiados|espera un/i.test(t)) bad.push(`${f}:${i + 1}: ${t.slice(0, 140)}`);
      });
    }
    expect(bad).toEqual([]);
  });
});

