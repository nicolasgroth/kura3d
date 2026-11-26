/**
 * @file src/components/viewport/__tests__/paintStrokeRules.test.ts
 * @description Reglas del trazo en el visor: el relleno por región usa el mismo ángulo de pliegue que
 * el sombreado del visor, y el borde fino solo fuerza el camino por muestra en mallas gruesas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { PAINT_REGION_ANGLE_DEG } from '../../../core/operations/paintOperations';
import { uvSphere } from '../../../engine/paint/__tests__/paintTestMeshes';
import { CREASE_ANGLE_DEG } from '../../../utils/creasedNormals';
import { strokeNeedsEdgeRefine } from '../paintPointer';

describe('reglas del trazo', () => {
  it('relleno por región = ángulo de pliegue del visor', () => {
    expect(PAINT_REGION_ANGLE_DEG).toBe(CREASE_ANGLE_DEG);
  });

  it('el borde fino solo subdivide en mallas gruesas para el radio', () => {
    const coarse = uvSphere(20, 12, 6);
    const fine = uvSphere(20, 256, 128);
    expect(strokeNeedsEdgeRefine(true, coarse, [1, 1, 1], 3)).toBe(true);
    expect(strokeNeedsEdgeRefine(true, fine, [1, 1, 1], 3)).toBe(false);
    expect(strokeNeedsEdgeRefine(false, coarse, [1, 1, 1], 3)).toBe(false);
  });
});
