/**
 * @file src/core/scene/__tests__/plateOverlap.test.ts
 * @description Placas cuyas camas se pisan (archivo editado a mano o cama del proyecto agrandada): se detectan para
 * avisar al abrir, sin mover nada. Las placas creadas por la app (orígenes libres) no se pisan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { ScenePlate } from '../../../types/plates';
import { overlappingPlates } from '../plateOverlap';
import { createPlate } from '../plates';

const BED = { widthMm: 200, depthMm: 200, heightMm: 200 };

describe('placas solapadas', () => {
  it('detecta las placas cuyas camas se pisan, con la cama propia o la del proyecto', () => {
    const plates: ScenePlate[] = [
      { id: 'a', name: 'A', origin: [0, 0] },
      { id: 'b', name: 'B', origin: [150, 0] },
      { id: 'c', name: 'C', origin: [600, 0] },
      { id: 'd', name: 'D', origin: [600, 260], bed: { widthMm: 100, depthMm: 400, heightMm: 100 } },
    ];
    expect(overlappingPlates(plates, BED)).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('placas que solo se tocan en el borde o están separadas no cuentan', () => {
    const plates: ScenePlate[] = [{ id: 'a', name: 'A', origin: [0, 0] }, { id: 'b', name: 'B', origin: [200, 0] }];
    expect(overlappingPlates(plates, BED)).toEqual([]);
  });

  it('las placas que crea la app no se pisan', () => {
    let scene = { objects: [], plates: [] as ScenePlate[] };
    for (let i = 0; i < 4; i++) {
      const res = createPlate(scene, { id: `p${i}`, name: `P${i}`, implicit: { id: 'p-0', name: 'P0' }, projectBed: BED })!;
      scene = res.scene as typeof scene;
    }
    expect(overlappingPlates(scene.plates, BED)).toEqual([]);
  });
});
