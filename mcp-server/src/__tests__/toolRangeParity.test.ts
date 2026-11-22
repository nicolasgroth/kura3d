/**
 * @file mcp-server/src/__tests__/toolRangeParity.test.ts
 * @description Recorre el esquema de entrada de TODAS las herramientas del servidor MCP (tal como
 * las anuncia `tools/list`) y exige que cada número acotado use un rango de la fuente única del
 * motor (`OPERATION_RANGES`, `TRANSFORM_RANGES`, `PRIMITIVE_PARAM_RANGES`): un literal propio del
 * servidor (p. ej. 5–85 frente a otro rango en la app) hace fallar la prueba. Además, ninguna
 * fuente del servidor declara cotas numéricas literales en una cadena `z.number()`. Comprueba
 * también el resumen corto de `kura_split_for_bed` y su plan completo con `detail: true`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { OPERATION_RANGES, TRANSFORM_RANGES } from '../../../src/engine/operationLimits';
import { MIN_SEGMENTS_BY_TYPE, PRIMITIVE_PARAM_RANGES, TEXT_DEPTH_RANGE } from '../../../src/engine/primitiveLimits';
import { createKuraMcpServer } from '../index.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function connect() {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  return client;
}

type Range = { min: number; max: number };
const key = (min: number | undefined, max: number | undefined) => `${min ?? '-inf'}..${max ?? 'inf'}`;
const KNOWN = new Set<string>();
const addRange = (r: Range) => KNOWN.add(key(r.min, r.max));
for (const group of Object.values(OPERATION_RANGES)) for (const r of Object.values(group as Record<string, Range>)) addRange(r);
for (const r of Object.values(TRANSFORM_RANGES)) addRange(r);
for (const r of Object.values(PRIMITIVE_PARAM_RANGES)) addRange(r);
addRange(TEXT_DEPTH_RANGE);
for (const min of Object.values(MIN_SEGMENTS_BY_TYPE)) addRange({ min, max: PRIMITIVE_PARAM_RANGES.segments.max });

interface JsonSchema {
  type?: string | string[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  prefixItems?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  additionalProperties?: JsonSchema | boolean;
}

/** Números acotados del esquema: ruta y cotas (`exclusiveMinimum` cuenta como mínimo). */
function boundedNumbers(schema: JsonSchema, path: string, out: Array<{ path: string; min?: number; max?: number }>) {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes('number') || types.includes('integer')) {
    const min = schema.minimum ?? schema.exclusiveMinimum;
    const max = schema.maximum ?? schema.exclusiveMaximum;
    // Cotas de JSON Schema de enteros seguros de zod (int()) no son rangos del dominio.
    const safe = (v: number | undefined) => v === undefined || Math.abs(v) >= Number.MAX_SAFE_INTEGER;
    if (!(safe(min) && safe(max))) out.push({ path, min: safe(min) ? undefined : min, max: safe(max) ? undefined : max });
  }
  for (const [k, v] of Object.entries(schema.properties ?? {})) boundedNumbers(v, `${path}.${k}`, out);
  const items = Array.isArray(schema.items) ? schema.items : schema.items ? [schema.items] : [];
  [...items, ...(schema.prefixItems ?? [])].forEach((v, i) => boundedNumbers(v, `${path}[${i}]`, out));
  for (const list of [schema.anyOf, schema.oneOf, schema.allOf]) list?.forEach((v) => boundedNumbers(v, path, out));
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    boundedNumbers(schema.additionalProperties, `${path}.*`, out);
  }
}

describe('MCP: rangos de las herramientas desde la fuente única del motor', () => {
  it('cada número acotado de cada herramienta usa un rango de operationLimits/primitiveLimits', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(30);
    const offenders: string[] = [];
    let checked = 0;
    for (const tool of tools) {
      const found: Array<{ path: string; min?: number; max?: number }> = [];
      boundedNumbers(tool.inputSchema as JsonSchema, tool.name, found);
      for (const n of found) {
        checked++;
        if (!KNOWN.has(key(n.min, n.max))) offenders.push(`${n.path}: ${key(n.min, n.max)}`);
      }
    }
    expect(checked).toBeGreaterThan(40);
    expect(offenders).toEqual([]);
  });

  it('las fuentes del servidor no acotan z.number() con literales', () => {
    const offenders: string[] = [];
    for (const file of ['tools.ts', 'schemas.ts', 'splitTools.ts', 'parametricTools.ts']) {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      // Inicios de cadena zod (`z.number(`, `z.array(`…) para saber a qué cadena pertenece cada cota.
      const starts = [...src.matchAll(/\bz\s*\.\s*(\w+)\s*\(/g)].map((m) => ({ at: m.index!, kind: m[1] }));
      for (const m of src.matchAll(/\.(min|max|gt|gte|lt|lte)\(\s*-?[\d.]/g)) {
        const owner = starts.filter((s) => s.at < m.index!).pop();
        if (owner?.kind === 'number') {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${file}:${line} ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('MCP: kura_split_for_bed devuelve un resumen corto', () => {
  it('por defecto resume piezas, placas, uniones con/sin conector y avisos; detail=true trae el plan', async () => {
    const client = await connect();
    const call = async (name: string, args: Record<string, unknown>) => {
      const r = await client.callTool({ name, arguments: args });
      const text = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('');
      expect(r.isError, text).toBeFalsy();
      return JSON.parse(text);
    };
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 300, height: 40, depth: 40 } });
    const plan = await call('kura_split_for_bed', { objectId: box.id, dryRun: true, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200 });
    expect(plan.plan).toBeUndefined();
    expect(plan).toMatchObject({ dryRun: true, fitsWithoutCuts: false, pieces: 2, planes: 1 });
    const full = await call('kura_split_for_bed', { objectId: box.id, dryRun: true, detail: true, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200 });
    expect(full.plan.pieces).toHaveLength(2);

    const done = await call('kura_split_for_bed', { objectId: box.id, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200 });
    expect(done.plan).toBeUndefined();
    expect(done.pieces).toBe(2);
    expect(done.parts).toHaveLength(2);
    expect(done.parts[0]).toEqual({ id: expect.any(String), code: expect.any(String), plate: expect.any(Number) });
    expect(done.joints.total).toBe(1);
    expect(done.joints.withConnector + done.joints.withoutConnector).toBe(1);
    expect(done.plates).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(done.warnings)).toBe(true);
    expect(JSON.stringify(done).length).toBeLessThan(JSON.stringify(full).length);
  }, 120_000);
});
