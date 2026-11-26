/**
 * @file src/core/scene/__tests__/plateView.test.ts
 * @description Caja de encuadre de las camas de placa: une las camas visibles, respeta «Solo esta», la de la
 * activa sola, y null sin placas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { ScenePlate } from '../../../types/plates';
import { plateBedsBox, unionBox } from '../plateView';

const PLATES: ScenePlate[] = [
  { id: 'p1', name: 'A', origin: [0, 0] },
  { id: 'p2', name: 'B', origin: [250, 0], bed: { name: 'Mini', widthMm: 100, depthMm: 50, heightMm: 80 } },
];
const source = {
  printerProfile: { bedWidthMm: 200, bedDepthMm: 200, maxHeightMm: 200 },
  customBedDimensions: null,
  plates: PLATES,
  activePlateId: 'p2',
};

describe('plateBedsBox', () => {
  it('une las camas de todas las placas', () => {
    expect(plateBedsBox(source, 'visible')).toEqual({ min: [-100, 0, -100], max: [300, 30, 100] });
  });

  it('con «Solo esta» o pidiendo la activa, solo la cama de la placa activa (con su cama propia)', () => {
    expect(plateBedsBox({ ...source, plateSolo: true }, 'visible')).toEqual({ min: [200, 0, -25], max: [300, 30, 25] });
    expect(plateBedsBox(source, 'active')).toEqual({ min: [200, 0, -25], max: [300, 30, 25] });
  });

  it('sin placas no hay caja', () => {
    expect(plateBedsBox({ ...source, plates: [] }, 'visible')).toBeNull();
  });

  it('unionBox une y tolera cajas ausentes', () => {
    const a = { min: [0, 0, 0] as [number, number, number], max: [1, 1, 1] as [number, number, number] };
    const b = { min: [-1, 0, 2] as [number, number, number], max: [0, 5, 3] as [number, number, number] };
    expect(unionBox(a, null)).toBe(a);
    expect(unionBox(null, b)).toBe(b);
    expect(unionBox(a, b)).toEqual({ min: [-1, 0, 0], max: [1, 5, 3] });
  });
});
