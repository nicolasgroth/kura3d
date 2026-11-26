/**
 * @file src/engine/__tests__/hollowPerformance.test.ts
 * @description Equivalencia de la distancia acotada
 * (`boundedSignedDistance`) con la exacta: mismo valor cerca de la superficie y signo correcto lejos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { buildMeshDistanceField } from '../meshDistance';
import { createPrimitiveMesh } from '../primitives';

describe('distancia acotada (meshDistance)', () => {
  it('coincide con la exacta bajo el tope y conserva el signo sobre él', async () => {
    const mesh = await createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 5, segments: 48 });
    const field = buildMeshDistanceField(mesh);
    let rng = 12345;
    const rand = () => ((rng = (rng * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const cap = 1.5;
    for (let i = 0; i < 2000; i++) {
      const x = (rand() - 0.5) * 44, y = (rand() - 0.5) * 44, z = (rand() - 0.5) * 44;
      const exact = field.signedDistance(x, y, z);
      const bounded = field.boundedSignedDistance(x, y, z, cap);
      if (Math.abs(exact) < cap) expect(bounded).toBeCloseTo(exact, 9);
      else expect(Math.sign(bounded)).toBe(Math.sign(exact));
    }
  });
});
