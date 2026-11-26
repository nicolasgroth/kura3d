/**
 * @file src/engine/__tests__/operationRangeParity.test.ts
 * @description Paridad de rangos de operaciones entre el motor, el Command Bus (`commandSchemas`),
 * el servidor MCP (`mcp-server/src/schemas.ts`) y la IA (`toolSchemas`): todo número dentro del rango
 * de `operationLimits.ts` pasa todas las capas y el motor no lo rechaza como `INVALID_PARAMETER`
 * (sí puede rechazarlo por geometría con otro código); uno fuera de rango se rechaza en todas.
 * Además, el motor no conserva rangos propios con literales.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { rangeSchema } from '../../../mcp-server/src/schemas';
import { TOOL_PARAM_RANGES } from '../../ai/toolSchemas';
import type { PlaneCutOptions, SurfaceProjectionOptions } from '../../types/kura';
import { isEngineError } from '../engineErrors';
import { planeCutWithConnectors } from '../operations';
import { OPERATION_RANGES, TRANSFORM_RANGES, type OperationRange } from '../operationLimits';
import { createPrimitiveMesh } from '../primitives';
import { refineMeshDetailed } from '../refine';
import { projectGraphicOntoSurface } from '../surfaceProjection';
import { makeObject } from './geometryTestUtils';

const inside = (r: OperationRange) => [r.exclusiveMin ? r.min + (r.integer ? 1 : 1e-3) : r.min, r.max];
const outside = (r: OperationRange) => [r.integer ? r.min - 1 : r.exclusiveMin ? r.min : r.min - Math.max(1e-3, Math.abs(r.min) / 2), r.max + 1];

/** Código de error del motor, o `null` si la llamada terminó bien. */
async function engineCode(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (err) {
    return isEngineError(err) ? err.code : String(err);
  }
}

/** Fuentes del motor con rangos de operación (texto crudo). */
const ENGINE_SOURCES = import.meta.glob(
  ['../cutConnectorChecks.ts', '../surfaceProjection.ts', '../refine.ts', '../generators.ts', '../molds.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const ENTRIES = Object.entries(OPERATION_RANGES).flatMap(([op, keys]) =>
  Object.entries(keys as Record<string, OperationRange>).map(([key, range]) => [op, key, range] as const)
);

describe('rangos de operaciones: una sola fuente', () => {
  it.each(ENTRIES)('%s.%s: el esquema MCP acepta el rango y rechaza lo de fuera', (_op, _key, range) => {
    for (const v of inside(range)) expect(rangeSchema(range).safeParse(v).success).toBe(true);
    for (const v of outside(range)) expect(rangeSchema(range).safeParse(v).success).toBe(false);
  });

  it('la IA reutiliza los objetos de rango de operationLimits (no copias)', () => {
    const all = new Set<OperationRange>([...ENTRIES.map(([, , r]) => r), ...Object.values(TRANSFORM_RANGES)]);
    for (const ranges of Object.values(TOOL_PARAM_RANGES)) {
      for (const [key, range] of Object.entries(ranges ?? {})) {
        expect(all.has(range), key).toBe(true);
      }
    }
  });

  it('el motor no declara rangos de operación con literales', () => {
    for (const file of ['cutConnectorChecks.ts', 'surfaceProjection.ts', 'refine.ts', 'generators.ts', 'molds.ts']) {
      const src = ENGINE_SOURCES[`../${file}`];
      expect(src, file).toBeTruthy();
      expect(src, file).not.toMatch(/requireNumberInRange\(/);
      expect(src, file).not.toMatch(/requireIntegerInRange\(/);
    }
  });
});

const CUT: PlaneCutOptions = {
  axis: 'y',
  offset: 0,
  connectorType: 'dowel',
  connectorSize: 2,
  connectorDepth: 3,
  tolerance: 0.25,
  connectorCount: 2,
  keepMode: 'both',
};

describe('motor ↔ operationLimits: corte', () => {
  it('8 conectores (máximo declarado) se aceptan en una caja grande', async () => {
    const box = await createPrimitiveMesh('box', { width: 120, height: 40, depth: 120 });
    const res = await planeCutWithConnectors(makeObject('b', box), { ...CUT, connectorCount: OPERATION_RANGES.cut.connectorCount.max });
    expect(res.positive).not.toBeNull();
    expect(res.negative).not.toBeNull();
  });

  it.each([
    ['connectorCount', OPERATION_RANGES.cut.connectorCount],
    ['tolerance', OPERATION_RANGES.cut.tolerance],
    ['connectorSize', OPERATION_RANGES.cut.connectorSize],
    ['connectorDepth', OPERATION_RANGES.cut.connectorDepth],
  ] as const)('%s: dentro del rango no es INVALID_PARAMETER; fuera sí', async (key, range) => {
    const box = await createPrimitiveMesh('box', { width: 40, height: 40, depth: 40 });
    for (const v of inside(range)) {
      expect(await engineCode(() => planeCutWithConnectors(makeObject('b', box), { ...CUT, [key]: v }))).not.toBe('INVALID_PARAMETER');
    }
    for (const v of outside(range)) {
      expect(await engineCode(() => planeCutWithConnectors(makeObject('b', box), { ...CUT, [key]: v }))).toBe('INVALID_PARAMETER');
    }
  });
});

const PROJ: SurfaceProjectionOptions = { kind: 'text', text: 'K', mode: 'emboss', axis: '+z', widthMm: 10, depthMm: 1, colorHex: '#f97316' };

describe('motor ↔ operationLimits: proyección y refinado', () => {
  it.each([
    ['widthMm', OPERATION_RANGES.projection.widthMm],
    ['depthMm', OPERATION_RANGES.projection.depthMm],
    ['offsetU', OPERATION_RANGES.projection.offsetU],
    ['offsetV', OPERATION_RANGES.projection.offsetV],
  ] as const)('%s: dentro del rango no es INVALID_PARAMETER; fuera sí', async (key, range) => {
    const box = await createPrimitiveMesh('box', { width: 30, height: 20, depth: 10 });
    for (const v of inside(range)) {
      expect(await engineCode(() => projectGraphicOntoSurface(makeObject('b', box), { ...PROJ, [key]: v }))).not.toBe('INVALID_PARAMETER');
    }
    for (const v of outside(range)) {
      expect(await engineCode(() => projectGraphicOntoSurface(makeObject('b', box), { ...PROJ, [key]: v }))).toBe('INVALID_PARAMETER');
    }
  }, 30_000);

  it('refinado: fuera del rango es INVALID_PARAMETER', async () => {
    const box = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    for (const v of outside(OPERATION_RANGES.refine.targetEdgeLengthMm)) {
      expect(await engineCode(() => refineMeshDetailed(makeObject('b', box), v))).toBe('INVALID_PARAMETER');
    }
  });
});
