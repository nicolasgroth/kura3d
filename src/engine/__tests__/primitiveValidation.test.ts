/**
 * @file src/engine/__tests__/primitiveValidation.test.ts
 * @description Primitivas: `NaN`, infinitos, segmentos excesivos y valores fuera de rango lanzan
 * `INVALID_PARAMETER` (antes producían mallas vacías o se corregían en silencio); los valores
 * por defecto y los válidos siguen generando sólidos watertight con las dimensiones pedidas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { PrimitiveParams, PrimitiveType } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';

describe('Validación de primitivas (primitives.ts)', () => {
  const invalid: Array<[PrimitiveType, PrimitiveParams]> = [
    ['box', { width: Number.NaN }],
    ['box', { height: -5 }],
    ['box', { depth: Number.POSITIVE_INFINITY }],
    ['cylinder', { radius: Number.NaN }],
    ['cylinder', { segments: 100_000 }],
    ['sphere', { segments: 2 }],
    ['tube', { outerRadius: 10, innerRadius: 12 }],
    ['torus', { outerRadius: 10, tubeRadius: 15 }],
    ['prism', { sides: 1 }],
    ['cone', { height: 0 }],
    ['text', { text: '   ' }],
    ['text', { fontSize: Number.NaN }],
  ];

  it.each(invalid)('%s %o lanza INVALID_PARAMETER', async (type, params) => {
    const err = await createPrimitiveMesh(type, params).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect((err as EngineError).code).toBe('INVALID_PARAMETER');
    expect((err as EngineError).params.name).toBeTruthy();
  });

  it('los valores por defecto y válidos generan sólidos watertight con la medida pedida', async () => {
    const box = computeMeshStats(await createPrimitiveMesh('box', { width: 12, height: 7, depth: 3 }));
    expect(box.isManifold).toBe(true);
    expect(box.dimensionsMm).toEqual([12, 7, 3]);
    for (const type of ['cylinder', 'tube', 'sphere', 'cone', 'torus', 'prism', 'text'] as PrimitiveType[]) {
      const stats = computeMeshStats(await createPrimitiveMesh(type));
      expect(stats.isManifold).toBe(true);
      expect(stats.volumeMm3).toBeGreaterThan(0);
    }
  });
});
