/**
 * @file src/engine/__tests__/detectRanges.test.ts
 * @description La detección de sub-estructuras valida sus opciones con `OPERATION_RANGES.detect`:
 * los extremos se aceptan y un valor fuera de rango es `INVALID_PARAMETER` (antes se recortaba en
 * silencio a 5–85 mientras la app y el servidor MCP anunciaban otros rangos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { OPERATION_RANGES } from '../operationLimits';
import { createPrimitiveMesh } from '../primitives';
import { detectStructuralRegions } from '../structuralSegmentation';
import { makeObject } from './geometryTestUtils';

const R = OPERATION_RANGES.detect;

describe('detectStructuralRegions: rangos de la fuente única', () => {
  it('acepta los extremos y rechaza lo de fuera con INVALID_PARAMETER', async () => {
    const obj = makeObject('c', await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 }));
    for (const creaseAngleDeg of [R.creaseAngleDeg.min, R.creaseAngleDeg.max]) {
      await expect(detectStructuralRegions(obj, { creaseAngleDeg })).resolves.toBeTruthy();
    }
    await expect(detectStructuralRegions(obj, { maxRegions: R.maxRegions.max, minRegionPercent: R.minRegionPercent.max })).resolves.toBeTruthy();
    for (const bad of [
      { creaseAngleDeg: R.creaseAngleDeg.min - 1 },
      { creaseAngleDeg: R.creaseAngleDeg.max + 1 },
      { minRegionPercent: R.minRegionPercent.max + 1 },
      { maxRegions: R.maxRegions.max + 1 },
      { maxRegions: 2.5 },
    ]) {
      await expect(detectStructuralRegions(obj, bad)).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
    }
  });
});
