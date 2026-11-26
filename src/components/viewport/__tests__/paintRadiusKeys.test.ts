/**
 * @file src/components/viewport/__tests__/paintRadiusKeys.test.ts
 * @description Pasos del radio del pincel con `[` y `]`: 0,5 mm bajo 5 mm, 1 mm desde ahí, con topes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { PAINT_RADIUS_MAX_MM, PAINT_RADIUS_MIN_MM, stepPaintRadius } from '../usePaintRadiusKeys';

describe('stepPaintRadius', () => {
  it('pasos finos abajo, gruesos arriba y simétricos en 5 mm', () => {
    expect(stepPaintRadius(3, 1)).toBe(3.5);
    expect(stepPaintRadius(5, 1)).toBe(6);
    expect(stepPaintRadius(6, -1)).toBe(5);
    expect(stepPaintRadius(5, -1)).toBe(4.5);
  });

  it('respeta los topes del control deslizante', () => {
    expect(stepPaintRadius(PAINT_RADIUS_MIN_MM, -1)).toBe(PAINT_RADIUS_MIN_MM);
    expect(stepPaintRadius(PAINT_RADIUS_MAX_MM, 1)).toBe(PAINT_RADIUS_MAX_MM);
  });
});
