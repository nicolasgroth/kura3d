/**
 * @file mcp-server/src/__tests__/projectInfoTools.test.ts
 * @description `kura_get_project_info` y `kura_set_project_info` sin la app: mismos campos que el Command Bus, datos
 * en memoria, texto vacío que borra, `changed`, errores tipados con campos desconocidos o caracteres de control, y la
 * descripción y el autor como metadatos del 3MF que exporta el modo sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { projectMetadataXml } from '../../../src/engine/io/threeMfExport';
import { projectMetaOf } from '../../../src/project/projectMeta3mf';
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
  const raw = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    return { error: Boolean(r.isError), text: (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('') };
  };
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await raw(name, args);
    expect(r.error, r.text).toBe(false);
    return JSON.parse(r.text);
  };
  return { raw, call, headless };
}

describe('MCP: datos del proyecto sin la app', () => {
  it('leer, escribir, borrar con texto vacío y changed; mismos campos que el bus', async () => {
    const { call } = await connect();
    const empty = await call('kura_get_project_info');
    expect(empty).toMatchObject({ name: null, description: '', notes: '', author: '', createdAt: null, modifiedAt: null, workSeconds: 0, mode: 'headless' });
    const set = await call('kura_set_project_info', { description: 'Soporte de pared', author: 'Ana', notes: 'línea 1\nlínea 2' });
    expect(set).toMatchObject({ description: 'Soporte de pared', author: 'Ana', notes: 'línea 1\nlínea 2', changed: true });
    expect((await call('kura_set_project_info', { author: 'Ana' })).changed).toBe(false);
    const cleared = await call('kura_set_project_info', { author: '' });
    expect(cleared).toMatchObject({ author: '', description: 'Soporte de pared', changed: true });
    expect((await call('kura_get_project_info')).description).toBe('Soporte de pared');
  });

  it('errores tipados: sin campos, campo desconocido, caracteres de control o salto de línea en el autor', async () => {
    const { raw } = await connect();
    for (const args of [{}, { name: 'x' }, { author: 'a\u0007b' }, { author: 'a\nb' }]) {
      const r = await raw('kura_set_project_info', args);
      expect(r.error, JSON.stringify(args)).toBe(true);
    }
  });

  it('el 3MF sin interfaz lleva la descripción y el autor como metadatos', async () => {
    const { call, headless } = await connect();
    expect(projectMetadataXml(projectMetaOf(headless.projectInfo.snapshot()))).toBe('');
    await call('kura_set_project_info', { description: 'Caja <1>', author: 'Ana' });
    expect(projectMetadataXml(projectMetaOf(headless.projectInfo.snapshot()))).toBe(
      '  <metadata name="Description">Caja &lt;1&gt;</metadata>\n  <metadata name="Designer">Ana</metadata>\n',
    );
  });
});
