/**
 * @file src/engine/__tests__/primitiveRangeParity.test.ts
 * @description Paridad de rangos de primitivas entre el motor (`primitiveLimits`), la validación de
 * la IA (`toolSchemas`/`toolValidation`), el Command Bus (`commandSchemas`) y el servidor MCP
 * (`mcp-server/src/schemas.ts`): un valor que pasa cualquiera de las validaciones no puede explotar
 * después en el motor, y uno fuera de rango se rechaza antes de llegar a él.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { primitiveParamsSchema } from '../../../mcp-server/src/schemas';
import { validateToolCall } from '../../ai/toolValidation';
import { parseCreatePrimitive } from '../../store/commandSchemas';
import type { PrimitiveType } from '../../types/kura';
import { createPrimitiveMesh, initManifoldEngine } from '../index';
import { PRIMITIVE_PARAM_RANGES, primitiveRangeFor } from '../primitiveLimits';

/** Primitiva donde cada parámetro se usa de forma aislada (sin restricciones cruzadas). */
const USES: Array<[keyof typeof PRIMITIVE_PARAM_RANGES, PrimitiveType]> = [
  ['width', 'box'],
  ['height', 'box'],
  ['depth', 'box'],
  ['radius', 'sphere'],
  ['segments', 'cylinder'],
  ['sides', 'prism'],
  ['fontSize', 'text'],
  ['letterSpacing', 'text'],
];

const busAccepts = (type: PrimitiveType, params: Record<string, unknown>) => {
  try {
    parseCreatePrimitive({ type, ...params });
    return true;
  } catch {
    return false;
  }
};

beforeAll(async () => {
  await initManifoldEngine();
});

describe('rangos de primitivas: una sola fuente', () => {
  it.each(USES)('%s en %s: los límites pasan en todas las capas y el motor los construye', async (key, type) => {
    const range = primitiveRangeFor(type, key);
    for (const value of [range.min, range.max]) {
      expect(busAccepts(type, { [key]: value })).toBe(true);
      expect(primitiveParamsSchema.safeParse({ [key]: value }).success).toBe(true);
      const parsed = parseCreatePrimitive({ type, [key]: value });
      if (key === 'fontSize' && value === range.max) continue; // texto enorme: solo validación
      await expect(createPrimitiveMesh(type, parsed.params)).resolves.toBeDefined();
    }
  });

  it.each(USES)('%s en %s: fuera de rango se rechaza antes del motor', (key, type) => {
    const range = primitiveRangeFor(type, key);
    // Mínimos negativos (espaciado de letras): la mitad quedaría dentro del rango.
    const below = range.integer || range.min <= 0 ? range.min - 1 : range.min / 2;
    for (const value of [below, range.max + 1]) {
      expect(busAccepts(type, { [key]: value })).toBe(false);
      expect(primitiveParamsSchema.safeParse({ [key]: value }).success).toBe(false);
    }
  });

  it('la IA usa los mismos rangos para las dimensiones que declara', () => {
    for (const key of ['width', 'height', 'depth', 'radius', 'outerRadius', 'innerRadius'] as const) {
      const range = PRIMITIVE_PARAM_RANGES[key];
      expect(validateToolCall('create_primitive', { type: 'box', [key]: range.max }).ok).toBe(true);
      expect(validateToolCall('create_primitive', { type: 'box', [key]: range.max + 1 }).ok).toBe(false);
      expect(validateToolCall('create_primitive', { type: 'box', [key]: range.min / 2 }).ok).toBe(false);
    }
  });

  it('los mínimos dependientes del tipo se respetan en el Command Bus', () => {
    // Esfera: al menos 4 segmentos; toro: 6; texto: profundidad hasta 500 mm.
    expect(busAccepts('sphere', { segments: 3 })).toBe(false);
    expect(busAccepts('sphere', { segments: 4 })).toBe(true);
    expect(busAccepts('torus', { segments: 5 })).toBe(false);
    expect(busAccepts('text', { height: 501 })).toBe(false);
    expect(busAccepts('box', { height: 501 })).toBe(true);
  });
});
