/**
 * @file src/components/__tests__/plateRelativePosition.test.ts
 * @description Posición mostrada en el inspector con varias placas: relativa al centro de la placa de la pieza, y lo
 * que se escribe vuelve a coordenadas globales sin perder la altura. Una sola placa o el armado: globales.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { displayPlate, fromPlateRelative, plateOffset, toPlateRelative } from '../inspector/plateRelativePosition';

const PLATES = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] as [number, number] },
  { id: 'p2', name: 'Placa 2', origin: [296, 40] as [number, number] },
];

describe('posición relativa a la placa', () => {
  it('con 2 o más placas usa la placa de la pieza; con una o en armado, ninguna', () => {
    expect(displayPlate(PLATES, 'p2', 'print')?.name).toBe('Placa 2');
    expect(displayPlate([PLATES[0]], 'p1', 'print')).toBeNull();
    expect(displayPlate(PLATES, 'p2', 'assembly')).toBeNull();
    expect(displayPlate(PLATES, undefined, 'print')).toBeNull();
  });

  it('ida y vuelta: la X mostrada es 0 en el centro de la placa y escribir la misma coordenada no mueve la pieza', () => {
    const offset = plateOffset(PLATES[1]);
    expect(offset).toEqual([296, 0, 40]);
    const global: [number, number, number] = [296, 12, 40];
    const shown = toPlateRelative(global, offset);
    expect(shown).toEqual([0, 12, 0]);
    expect(fromPlateRelative(shown, offset)).toEqual(global);
  });

  it('sin placa el desplazamiento es cero', () => {
    expect(plateOffset(null)).toEqual([0, 0, 0]);
  });
});
