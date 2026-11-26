/**
 * @file src/core/scene/__tests__/bedLabel.test.ts
 * @description Pruebas del rótulo de cama del visor: cama propia de la placa activa o la del proyecto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { hudBed } from '../bedLabel';
import type { ScenePlate } from '../../../types/plates';

const printerProfile = { bedWidthMm: 256, bedDepthMm: 256, maxHeightMm: 256 };
const own = { name: 'Mini 180', widthMm: 180, depthMm: 180, heightMm: 180 };
const plates = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] },
  { id: 'p2', name: 'Placa 2', origin: [400, 0], bed: own },
] as unknown as ScenePlate[];

describe('hudBed', () => {
  it('placa activa sin cama propia: la del proyecto', () => {
    const b = hudBed({ printerProfile, customBedDimensions: null, plates, activePlateId: 'p1' });
    expect(b.ownName).toBeNull();
    expect(b.widthMm).toBe(256);
  });
  it('placa activa con cama propia: su nombre y medidas', () => {
    const b = hudBed({ printerProfile, customBedDimensions: null, plates, activePlateId: 'p2' });
    expect(b).toMatchObject({ ownName: 'Mini 180', widthMm: 180, heightMm: 180 });
  });
  it('sin placas: la del proyecto', () => {
    expect(hudBed({ printerProfile, customBedDimensions: null }).ownName).toBeNull();
  });
});
