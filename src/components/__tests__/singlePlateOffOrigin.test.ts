/**
 * @file src/components/__tests__/singlePlateOffOrigin.test.ts
 * @description Una sola placa fuera del origen (p. ej. tras borrar la placa 1) no cae en el camino antiguo: el estado
 * de la cama resta su origen y usa su cama propia (sin «Fuera de volumen» falso), y `allBedSizes` trae su centro. Sin
 * placas, o con una en el origen y la cama del proyecto, nada cambia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { isLegacyPlateSetup } from '../../core/scene/plates';
import { allBedSizes } from '../../store/bedSize';
import type { PrinterProfile, SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { platesBedStatus, sceneBedStatus } from '../viewport/plateBedStatus';

const profile = { bedWidthMm: 220, bedDepthMm: 220, maxHeightMm: 250, marginMm: 0, showPrintVolume: true } as unknown as PrinterProfile;
const box = (position: [number, number, number], plateRef?: string): SceneObject => ({
  ...buildSceneObject({ id: `b${position[0]}`, name: 'Caja', source: 'primitive', mesh: cube(10) }),
  position,
  plateRef,
});
function cube(s: number) {
  const h = s / 2;
  const positions = new Float32Array([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h, -h, s, -h, h, s, -h, h, s, h, -h, s, h]);
  const indices = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  return { positions, indices } as never;
}
const plate = (origin: [number, number], extra: Partial<ScenePlate> = {}): ScenePlate => ({ id: 'p2', name: 'Placa 2', origin, ...extra });

describe('una sola placa fuera del origen', () => {
  it('isLegacyPlateSetup: solo sin placas o con una en el origen con la cama del proyecto', () => {
    const project = { widthMm: 220, depthMm: 220, heightMm: 250 };
    expect(isLegacyPlateSetup([])).toBe(true);
    expect(isLegacyPlateSetup([plate([0, 0])], project)).toBe(true);
    expect(isLegacyPlateSetup([plate([250, 0])], project)).toBe(false);
    expect(isLegacyPlateSetup([plate([0, 0], { bed: { name: 'Otra', widthMm: 100, depthMm: 100, heightMm: 100 } })], project)).toBe(false);
    expect(isLegacyPlateSetup([plate([0, 0], { bed: { name: 'Igual', ...project } })], project)).toBe(true);
    expect(isLegacyPlateSetup([plate([0, 0]), { ...plate([300, 0]), id: 'p3' }], project)).toBe(false);
  });

  it('la pieza sobre su placa lejana no da «fuera de volumen» falso; fuera de ella, sí', () => {
    const on = box([250, 0, 0], 'p2');
    expect(sceneBedStatus([on], profile, [plate([250, 0])])).toBe('ok');
    expect(platesBedStatus([on], profile, [plate([250, 0])])[0].status).toBe('ok');
    const off = box([250 + 400, 0, 0], 'p2');
    expect(sceneBedStatus([off], profile, [plate([250, 0])])).toBe('outOfBounds');
  });

  it('usa la cama propia de una sola placa en el origen', () => {
    const small = plate([0, 0], { bed: { name: 'Chica', widthMm: 100, depthMm: 100, heightMm: 100 } });
    expect(sceneBedStatus([box([80, 0, 0], 'p2')], profile, [small])).toBe('outOfBounds');
  });

  it('el camino de siempre se conserva sin placas o con una en el origen', () => {
    expect(sceneBedStatus([box([1000, 0, 0])], profile, [])).toBe('outOfBounds');
    expect(sceneBedStatus([box([0, 0, 0])], profile, [plate([0, 0])])).toBe('ok');
  });

  it('allBedSizes trae el centro de la única placa fuera del origen', () => {
    const state = { printerProfile: profile, customBedDimensions: null, plates: [plate([250, 30])], activePlateId: 'p2' } as never;
    expect(allBedSizes(state)).toEqual([{ width: 220, depth: 220, origin: [250, 30] }]);
  });
});
