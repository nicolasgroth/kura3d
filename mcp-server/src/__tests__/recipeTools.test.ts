/**
 * @file mcp-server/src/__tests__/recipeTools.test.ts
 * @description Herramientas de recetas en modo headless: listar y describir (textos en el idioma pedido), validar
 * una receta escrita por el agente (errores con ruta), `dryRun` sin cambios, ejecutar la caja con tapa (dos
 * objetos nuevos en la escena) y una ejecución fallida que no deja nada. Anotación de solo lectura correcta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createKuraMcpServer } from '../index.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function connect() {
  const { server, bridge, headless } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  return { client, headless };
}

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };
const json = (res: unknown) => JSON.parse((res as ToolResult).content[0].text);

const MINI = {
  format: 'kura.recipe/1', id: 'agente.taco', version: '1.0.0', title: 'Taco', author: 'Agente', license: 'MIT',
  params: [{ id: 'w', type: 'number', unit: 'mm', min: 5, max: 50, default: 20, label: 'Ancho' }],
  steps: [{ id: 'b', op: 'create_primitive', args: { type: 'box', params: { width: '=p.w', depth: '=p.w', height: 5 } } }],
  outputs: [{ ref: '@b', name: 'Taco' }],
};

describe('MCP: recetas (headless)', () => {
  it('lista y describe las incorporadas en el idioma pedido; lectura vs escritura', async () => {
    const { client } = await connect();
    const tools = (await client.listTools()).tools;
    const hint = (name: string) => tools.find((t) => t.name === name)?.annotations?.readOnlyHint;
    expect(hint('kura_list_recipes')).toBe(true);
    expect(hint('kura_describe_recipe')).toBe(true);
    expect(hint('kura_validate_recipe')).toBe(true);
    expect(hint('kura_run_recipe')).toBe(false);
    const list = json(await client.callTool({ name: 'kura_list_recipes', arguments: { language: 'en' } }));
    expect(list.recipes.map((r: { id: string }) => r.id)).toEqual(['kura.caja-tapa', 'kura.llavero', 'kura.placa-enchufe']);
    const placa = json(await client.callTool({ name: 'kura_describe_recipe', arguments: { recipeId: 'kura.placa-enchufe', language: 'en' } }));
    expect(placa.title).toBe('Outlet / switch plate');
    expect(placa.presets.map((p: { id: string; verified: boolean }) => [p.id, p.verified])).toContainEqual(['cl', false]);
    expect(placa.params.find((p: { id: string }) => p.id === 'modules')).toMatchObject({ min: 1, max: 3, default: 1 });
  });

  it('valida la receta de un agente y devuelve errores con ruta', async () => {
    const { client } = await connect();
    const ok = json(await client.callTool({ name: 'kura_validate_recipe', arguments: { recipe: MINI } }));
    expect(ok).toEqual({ ok: true, errors: [] });
    const bad = { ...MINI, steps: [{ ...MINI.steps[0], op: 'export_stl' }] };
    const res = json(await client.callTool({ name: 'kura_validate_recipe', arguments: { recipe: bad, language: 'en' } }));
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatchObject({ code: 'schema.invalid', path: 'steps[0].op' });
  });

  it('dryRun no cambia la escena; ejecutar agrega la caja y la tapa', { timeout: 60_000 }, async () => {
    const { client, headless } = await connect();
    const dry = json(await client.callTool({ name: 'kura_run_recipe', arguments: { recipeId: 'kura.caja-tapa', dryRun: true } }));
    expect(dry).toMatchObject({ dryRun: true, ok: true, estimate: { outputs: 2 } });
    expect(headless.getSceneState().objectCount).toBe(0);
    const run = json(await client.callTool({ name: 'kura_run_recipe', arguments: { recipeId: 'kura.caja-tapa', answers: { w: 60 } } }));
    expect(run.objects.map((o: { name: string }) => o.name)).toEqual(['Caja', 'Tapa']);
    expect(run.objects[0].stats.dimensionsMm[0]).toBeCloseTo(64, 3);
    expect(headless.getSceneState().objectCount).toBe(2);
    const inline = json(await client.callTool({ name: 'kura_run_recipe', arguments: { recipe: MINI, answers: { w: 10 } } }));
    expect(inline.objects[0].stats.dimensionsMm[0]).toBeCloseTo(10, 4);
  });

  it('una receta que falla no deja nada y responde con error', async () => {
    const { client, headless } = await connect();
    const res = (await client.callTool({ name: 'kura_run_recipe', arguments: { recipe: MINI, answers: { w: 500 } } })) as ToolResult;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('param.outOfRange');
    expect(headless.getSceneState().objectCount).toBe(0);
  });
});
