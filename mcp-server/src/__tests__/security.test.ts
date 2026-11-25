/**
 * @file mcp-server/src/__tests__/security.test.ts
 * @description Pruebas de seguridad TRUST-02 del puente MCP de Kurra3D Studio: autenticación obligatoria,
 * validación de Host/Origin, rotación de token con revocación, solo lectura aplicado en servidor,
 * confinamiento de exportaciones, límite de tamaño de mensaje y validación de datos con esquema.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { mkdtemp, readFile, rm, stat, symlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { CLOSE_TOKEN_ROTATED, constantTimeEquals, isAllowedLocalHost } from '../bridge.js';
import { parseCliArgs, resolveBridgeConfig } from '../config.js';
import { createKuraMcpServer } from '../index.js';
import { COMMAND_ACCESS, READ_COMMANDS, TOOL_COMMANDS } from '../../../src/core/commands/commandPolicy';
import type { KuraCommandName } from '../types.js';

const TOKEN_A = 'a'.repeat(16) + '0123456789abcdef';
const TOKEN_B = 'b'.repeat(16) + 'fedcba9876543210';

type Options = NonNullable<Parameters<typeof createKuraMcpServer>[0]>;

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()?.();
});

async function setup(options: Options = {}) {
  const exportDir = options.exportDir ?? (await mkdtemp(join(tmpdir(), 'kura3d-sec-')));
  const { server, bridge, headless } = createKuraMcpServer({
    bridgePort: 0,
    authToken: TOKEN_A,
    ...options,
    exportDir,
  });
  const client = new Client({ name: 'kura3d-sec-test', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  cleanup.push(async () => {
    await client.close();
    await server.close();
    await bridge.close();
    await rm(exportDir, { recursive: true, force: true });
  });
  return { server, bridge, headless, client, exportDir };
}

/** Intenta abrir un WebSocket; resuelve con el socket abierto o el código HTTP de rechazo. */
function attempt(
  url: string,
  headers?: Record<string, string>
): Promise<{ ws?: WebSocket; status?: number; messages: Array<Record<string, unknown>> }> {
  return new Promise((resolve) => {
    const messages: Array<Record<string, unknown>> = [];
    const ws = new WebSocket(url, headers ? { headers } : undefined);
    ws.on('message', (raw) => messages.push(JSON.parse(raw.toString()) as Record<string, unknown>));
    ws.once('open', () => {
      cleanup.push(async () => ws.terminate());
      resolve({ ws, messages });
    });
    ws.once('unexpected-response', (_req, res) => resolve({ status: res.statusCode, messages }));
    ws.once('error', () => resolve({ messages }));
  });
}

function waitFor<T>(predicate: () => T | undefined, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const value = predicate();
      if (value !== undefined) return resolve(value);
      if (Date.now() - started > timeoutMs) return reject(new Error('timeout'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

const textOf = (res: { content: unknown }) => (res.content as Array<{ text?: string }>)[0]?.text ?? '';

describe('TRUST-02 · autenticación obligatoria del puente', () => {
  it('no habilita el puente sin token configurado', async () => {
    const { bridge } = await setup({ authToken: '' });
    expect(await bridge.start()).toBe(false);
    expect(bridge.isListening()).toBe(false);
    expect(bridge.getStartupError()).toMatch(/KURA_BRIDGE_TOKEN/);
  });

  it('no habilita el puente con un token demasiado corto', async () => {
    const { bridge } = await setup({ authToken: 'corto' });
    expect(await bridge.start()).toBe(false);
  });

  it('rechaza sin token (401), acepta token válido y envía saludo con la política', async () => {
    const { bridge } = await setup();
    await bridge.start();
    const base = `ws://127.0.0.1:${bridge.getPort()}`;

    expect((await attempt(base)).status).toBe(401);
    expect((await attempt(`${base}/?token=${TOKEN_B}`)).status).toBe(401);

    const ok = await attempt(`${base}/?token=${TOKEN_A}`, { origin: 'http://localhost:5173' });
    expect(ok.ws).toBeDefined();
    const hello = await waitFor(() => ok.messages.find((m) => m.type === 'hello'));
    expect(hello.readOnly).toBe(false);
    expect(hello.readCommands).toEqual([...READ_COMMANDS]);
  });

  it('rechaza Origin ajeno y Host ajeno (DNS rebinding) con 403 aun con token válido', async () => {
    const { bridge } = await setup();
    await bridge.start();
    const url = `ws://127.0.0.1:${bridge.getPort()}/?token=${TOKEN_A}`;

    expect((await attempt(url, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await attempt(url, { origin: 'http://localhost.evil.example' })).status).toBe(403);
    expect((await attempt(url, { host: `evil.example:${bridge.getPort()}` })).status).toBe(403);
    expect(isAllowedLocalHost(`localhost:${bridge.getPort()}`, bridge.getPort())).toBe(true);
    expect(isAllowedLocalHost(`127.0.0.1:1`, bridge.getPort())).toBe(false);
  });

  it('responde 429 tras el límite de tokens inválidos; un Origin ajeno no consume el cupo', async () => {
    const { bridge } = await setup({ authFailureLimitPerMin: 2 });
    await bridge.start();
    const base = `ws://127.0.0.1:${bridge.getPort()}`;
    // Los rechazos por Origin ajeno no consumen el cupo de fallos.
    for (let i = 0; i < 5; i += 1) {
      expect((await attempt(base, { origin: 'https://evil.example' })).status).toBe(403);
    }
    expect((await attempt(base)).status).toBe(401);
    expect((await attempt(base)).status).toBe(401);
    // Durante el bloqueo ni siquiera el token correcto pasa (no hay oráculo de fuerza bruta).
    expect((await attempt(`${base}/?token=${TOKEN_A}`)).status).toBe(429);
  });

  it('compara tokens en tiempo constante sin depender de la longitud', () => {
    expect(constantTimeEquals(TOKEN_A, TOKEN_A)).toBe(true);
    expect(constantTimeEquals(TOKEN_A, TOKEN_A.slice(0, -1))).toBe(false);
    expect(constantTimeEquals(TOKEN_A, TOKEN_B)).toBe(false);
  });
});

describe('TRUST-02 · rotación de token', () => {
  it('revoca el token viejo, cierra la sesión y acepta solo el nuevo; persiste en archivo', async () => {
    const tokenDir = await mkdtemp(join(tmpdir(), 'kura3d-token-'));
    const tokenFile = join(tokenDir, 'bridge-token');
    cleanup.push(() => rm(tokenDir, { recursive: true, force: true }));
    const { bridge } = await setup({ tokenFile });
    await bridge.start();
    const base = `ws://127.0.0.1:${bridge.getPort()}`;

    const session = await attempt(`${base}/?token=${TOKEN_A}`);
    const closed = new Promise<number>((resolve) => session.ws!.once('close', (code) => resolve(code)));
    session.ws!.send(JSON.stringify({ type: 'rotate_token', token: TOKEN_B }));

    const ack = await waitFor(() => session.messages.find((m) => m.type === 'token_rotated'));
    expect(ack.persistent).toBe(true);
    expect(await closed).toBe(CLOSE_TOKEN_ROTATED);
    expect((await readFile(tokenFile, 'utf8')).trim()).toBe(TOKEN_B);

    expect((await attempt(`${base}/?token=${TOKEN_A}`)).status).toBe(401);
    expect((await attempt(`${base}/?token=${TOKEN_B}`)).ws).toBeDefined();
  });

  it('rechaza un token nuevo con formato inválido sin cambiar el vigente', async () => {
    const { bridge } = await setup();
    await bridge.start();
    const base = `ws://127.0.0.1:${bridge.getPort()}`;
    const session = await attempt(`${base}/?token=${TOKEN_A}`);
    session.ws!.send(JSON.stringify({ type: 'rotate_token', token: 'corto' }));
    await waitFor(() => session.messages.find((m) => m.type === 'token_rotation_failed'));
    expect((await attempt(`${base}/?token=${TOKEN_A}`)).ws).toBeDefined();
  });

  it('niega escrituras en solo lectura tras rotar y no las reenvía a la UI', async () => {
    const { bridge, client } = await setup();
    await bridge.start();
    const base = `ws://127.0.0.1:${bridge.getPort()}`;
    const first = await attempt(`${base}/?token=${TOKEN_A}`);
    first.ws!.send(JSON.stringify({ type: 'rotate_token', token: TOKEN_B }));
    await waitFor(() => first.messages.find((m) => m.type === 'token_rotated'));

    const ui = await attempt(`${base}/?token=${TOKEN_B}&readOnly=1`);
    const hello = await waitFor(() => ui.messages.find((m) => m.type === 'hello'));
    expect(hello.readOnly).toBe(true);
    const commands: string[] = [];
    ui.ws!.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as { id?: string; command?: string };
      if (!msg.command) return;
      commands.push(msg.command);
      ui.ws!.send(JSON.stringify({ id: msg.id, ok: true, result: { objects: [] } }));
    });

    const write = await client.callTool({ name: 'kura_create_primitive', arguments: { primitiveType: 'box' } });
    expect(write.isError).toBe(true);
    expect(textOf(write)).toContain('Read-only mode');

    const read = await client.callTool({ name: 'kura_get_scene_state', arguments: {} });
    expect(read.isError).not.toBe(true);
    expect(commands).toEqual(['get_scene_state']);
  });
});

describe('TRUST-02 · solo lectura como fuente única', () => {
  it('declara acceso para cada comando y anota readOnlyHint en cada herramienta listada', async () => {
    const { client } = await setup();
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(Object.keys(TOOL_COMMANDS).length);
    for (const tool of tools) {
      const command = TOOL_COMMANDS[tool.name] as KuraCommandName;
      expect(command, tool.name).toBeDefined();
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(COMMAND_ACCESS[command] === 'read');
    }
    expect([...READ_COMMANDS].sort()).toEqual(
      ['analyze_printability', 'capture_viewport', 'check_fit', 'describe_recipe', 'detect_structures', 'diagnose_mesh', 'get_scene_state', 'list_recipes', 'measure_capacity', 'measure_distance', 'measure_object', 'orient_for_print', 'validate_assembly', 'validate_recipe'].sort()
    );
  });

  it('interpreta solo lectura igual desde CLI y entorno (true/1/yes)', () => {
    expect(resolveBridgeConfig({}, { KURA_BRIDGE_READ_ONLY: '1' }).readOnly).toBe(true);
    expect(resolveBridgeConfig({}, { KURA_BRIDGE_READ_ONLY: 'true' }).readOnly).toBe(true);
    // Límite de fallos por defecto: 10 por minuto (solo lo alimentan los 401; se aplica antes del token).
    expect(resolveBridgeConfig({}, {}).authFailureLimitPerMin).toBe(10);
    expect(resolveBridgeConfig({}, { KURA_BRIDGE_READ_ONLY: 'false' }).readOnly).toBe(false);
    expect(resolveBridgeConfig({}, {}, ['--read-only']).readOnly).toBe(true);
    expect(resolveBridgeConfig({}, { KURA_BRIDGE_READ_ONLY: '1' }, ['--read-only=false']).readOnly).toBe(false);
    expect(parseCliArgs(['--export-dir', '/x', '--port=1234'])).toEqual({ 'export-dir': '/x', port: '1234' });
  });

  it('la UI no puede desactivar el solo lectura impuesto por el servidor', async () => {
    const { bridge, client } = await setup({ readOnly: true });
    await bridge.start();
    const ui = await attempt(`ws://127.0.0.1:${bridge.getPort()}/?token=${TOKEN_A}&readOnly=0`);
    const hello = await waitFor(() => ui.messages.find((m) => m.type === 'hello'));
    expect(hello.readOnly).toBe(true);
    expect(hello.serverReadOnly).toBe(true);
    const res = await client.callTool({ name: 'kura_delete_object', arguments: { objectId: 'x' } });
    expect(res.isError).toBe(true);
  });
});

describe('TRUST-02 · destinos de exportación', () => {
  async function seeded(options: Options = {}) {
    const ctx = await setup(options);
    await ctx.headless.createPrimitive({ primitiveType: 'box', params: { width: 10, height: 10, depth: 10 } });
    return ctx;
  }

  it('escribe solo dentro del directorio permitido, incluidas subcarpetas relativas', async () => {
    const { client, exportDir } = await seeded();
    const res = await client.callTool({ name: 'kura_export_stl', arguments: { outputPath: 'sub/pieza.stl' } });
    expect(res.isError).not.toBe(true);
    expect((await stat(join(exportDir, 'sub', 'pieza.stl'))).size).toBeGreaterThan(84);
  });

  it('rechaza path traversal, rutas absolutas fuera y extensiones inesperadas', async () => {
    const { client, exportDir } = await seeded();
    const outside = join(tmpdir(), `kura3d-outside-${Date.now()}.stl`);
    for (const outputPath of ['../escape.stl', 'a/../../escape.stl', outside, 'pieza.exe', 'nul\u0000.stl']) {
      const res = await client.callTool({ name: 'kura_export_stl', arguments: { outputPath } });
      expect(res.isError, outputPath).toBe(true);
    }
    const mf = await client.callTool({ name: 'kura_export_3mf', arguments: { outputPath: '../x.3mf' } });
    expect(mf.isError).toBe(true);
    await expect(stat(outside)).rejects.toThrow();
    await expect(stat(join(exportDir, '..', 'escape.stl'))).rejects.toThrow();
  });

  it('rechaza enlaces (symlink/junction) que salen del directorio permitido', async () => {
    const outsideDir = await mkdtemp(join(tmpdir(), 'kura3d-outside-dir-'));
    cleanup.push(() => rm(outsideDir, { recursive: true, force: true }));
    const { client, exportDir } = await seeded();
    await mkdir(exportDir, { recursive: true });
    await symlink(outsideDir, join(exportDir, 'link'), 'junction');
    const res = await client.callTool({ name: 'kura_export_stl', arguments: { outputPath: 'link/fuga.stl' } });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/link/);
    await expect(stat(join(outsideDir, 'fuga.stl'))).rejects.toThrow();
  });
});

describe('TRUST-02 · límites y datos tratados como datos', () => {
  it('cierra con 1009 un mensaje entrante sobre el límite de tamaño', async () => {
    const { bridge } = await setup({ maxMessageBytes: 1024 });
    await bridge.start();
    const ui = await attempt(`ws://127.0.0.1:${bridge.getPort()}/?token=${TOKEN_A}`);
    const closed = new Promise<number>((resolve) => ui.ws!.once('close', (code) => resolve(code)));
    ui.ws!.send(JSON.stringify({ id: 'x', ok: true, result: 'z'.repeat(4096) }));
    expect(await closed).toBe(1009);
  });

  it('rechaza nombres con caracteres de control o demasiado largos y colores no hexadecimales', async () => {
    const { client } = await setup();
    const bad = [
      { primitiveType: 'box', name: 'pieza\n; rm -rf /' },
      { primitiveType: 'box', name: 'x'.repeat(129) },
      { primitiveType: 'box', color: 'red; drop' },
    ];
    for (const args of bad) {
      const res = await client.callTool({ name: 'kura_create_primitive', arguments: args });
      expect(res.isError, JSON.stringify(args)).toBe(true);
    }
    const ok = await client.callTool({
      name: 'kura_create_primitive',
      arguments: { primitiveType: 'box', name: '<script>alert(1)</script>' },
    });
    expect(ok.isError).not.toBe(true);
    expect(JSON.parse(textOf(ok)).name).toBe('<script>alert(1)</script>');
  });

  it('ignora respuestas de la UI con forma inválida (no resuelve comandos con datos basura)', async () => {
    const { bridge, client } = await setup({ defaultTimeoutMs: 300 });
    await bridge.start();
    const ui = await attempt(`ws://127.0.0.1:${bridge.getPort()}/?token=${TOKEN_A}`);
    ui.ws!.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as { id?: string; command?: string };
      if (msg.command) ui.ws!.send(JSON.stringify({ id: msg.id, ok: 'yes', error: 42 }));
    });
    const res = await client.callTool({ name: 'kura_get_scene_state', arguments: {} });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/Timed out/);
  });
});
