/**
 * @file src/components/__tests__/printPlatesOutOfBounds.test.ts
 * @description El indicador "Fuera de volumen" no alarma por las placas de "Preparar para imprimir" (van en
 * fila a un costado de la cama a propósito): cada pieza se mide dentro de su placa. Una pieza movida a mano
 * fuera de su lugar, o una que de verdad excede la cama, sí alarma.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { plateOffsetX } from '../../core/scene/splitGroups';
import { DEFAULT_PRINTER_PROFILES, type SceneObject, type Vec3 } from '../../types/kura';
import { checkObjectsOutOfBounds } from '../viewport/viewportHelpers';

const profile = { ...DEFAULT_PRINTER_PROFILES[0], showPrintVolume: true, bedWidthMm: 220, bedDepthMm: 220, maxHeightMm: 250 };

/** Pieza de 20 mm con centro X/Z en 0 y base en Y=0 (malla local) de una división, en la placa `plate`. */
function part(id: string, plate: number, position: Vec3): SceneObject {
  const h = 10;
  const positions = new Float32Array([-h, 0, -h, h, 0, -h, h, 20, -h, -h, 20, -h, -h, 0, h, h, 0, h, h, 20, h, -h, 20, h]);
  return {
    id, name: id, source: 'cut_part', position, rotation: [0, 0, 0], scale: [1, 1, 1], color: '#38bdf8',
    role: 'solid', visible: true, locked: false,
    mesh: { positions, indices: new Uint32Array([0, 1, 2]) },
    stats: { triangles: 12, vertices: 8, isManifold: true, volumeMm3: 8000, dimensionsMm: [20, 20, 20] },
    metadata: {
      split: {
        groupId: 'g', code: id, cell: [0, 0, 0], assembly: { position: [0, 0, 0], rotation: [0, 0, 0] },
        print: { position: [10, 0, 5], rotation: [0, 0, 0], plate, downFace: '-y' }, jointLabels: [],
      },
    },
  } as unknown as SceneObject;
}

describe('indicador Fuera de volumen con piezas en placas', () => {
  it('ocho placas en fila no alarman: cada pieza cabe en su placa', () => {
    const objects = Array.from({ length: 8 }, (_, i) => part(`P${i}`, i, [10 + plateOffsetX(i, profile.bedWidthMm), 0, 5]));
    expect(checkObjectsOutOfBounds(objects, profile)).toBe(false);
  });

  it('una pieza movida a mano fuera de su lugar sí alarma', () => {
    const moved = part('P1', 1, [10 + plateOffsetX(1, profile.bedWidthMm) + 40, 0, 5]);
    expect(checkObjectsOutOfBounds([moved], profile)).toBe(true);
  });

  it('una pieza que de verdad excede la cama dentro de su placa sí alarma', () => {
    const wide = part('P2', 2, [105 + plateOffsetX(2, profile.bedWidthMm), 0, 5]);
    wide.metadata!.split!.print.position = [105, 0, 5];
    expect(checkObjectsOutOfBounds([wide], profile)).toBe(true);
  });
});
