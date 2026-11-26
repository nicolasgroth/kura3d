/**
 * @file src/core/scene/__tests__/viewMode.test.ts
 * @description Reglas puras de los modos de vista (P4): modo visible desde `layout` y `freeView`, qué ve cada modo
 * (camas, plano de apoyo, fuera de volumen, herramientas de cama), cuándo se ofrece el selector y la separación visual
 * (no muta objetos, 0 = armado exacto, se aleja del centro, un solo objeto no se mueve).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { fakeBox } from '../../../test/fakeObjects';
import type { SceneObject } from '../../../types/kura';
import {
  explodedFigurePositions,
  layoutOfViewMode,
  nextViewMode,
  plateToolBlockReason,
  shouldOfferViewModes,
  viewModeOf,
  viewModeTraits,
} from '../viewMode';

function solid(id: string, position: [number, number, number]): SceneObject {
  const h = 5;
  const positions = new Float32Array([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h, -h, 10, -h, h, 10, -h, h, 10, h, -h, 10, h]);
  return { ...fakeBox(id, id), position, mesh: { positions, indices: new Uint32Array([0, 1, 2, 0, 2, 3]) } } as SceneObject;
}

describe('modo visible', () => {
  it('Libre solo existe sobre la disposición de armado', () => {
    expect(viewModeOf('print', false)).toBe('print');
    expect(viewModeOf('print', true)).toBe('print');
    expect(viewModeOf(undefined, true)).toBe('print');
    expect(viewModeOf('assembly', false)).toBe('assembly');
    expect(viewModeOf('assembly', true)).toBe('free');
  });

  it('cada modo exige su disposición real y el atajo los recorre en ciclo', () => {
    expect(layoutOfViewMode('print')).toBe('print');
    expect(layoutOfViewMode('assembly')).toBe('assembly');
    expect(layoutOfViewMode('free')).toBe('assembly');
    expect(nextViewMode('print')).toBe('assembly');
    expect(nextViewMode('assembly')).toBe('free');
    expect(nextViewMode('free')).toBe('print');
  });
});

describe('qué muestra y permite cada modo', () => {
  it('camas y fuera de volumen solo en Imprimir; el plano de apoyo se va en Libre', () => {
    expect(viewModeTraits('print')).toEqual({ bedsVisible: true, groundVisible: true, bedChecks: true, plateTools: true, freeDrag: false });
    expect(viewModeTraits('assembly')).toEqual({ bedsVisible: false, groundVisible: true, bedChecks: false, plateTools: false, freeDrag: true });
    expect(viewModeTraits('free')).toEqual({ bedsVisible: false, groundVisible: false, bedChecks: false, plateTools: false, freeDrag: true });
  });

  it('las herramientas de cama dan su motivo fuera de Imprimir', () => {
    expect(plateToolBlockReason('print')).toBeNull();
    expect(plateToolBlockReason(undefined)).toBeNull();
    expect(plateToolBlockReason('assembly')).toBe('viewMode.reason.printOnly');
  });
});

describe('cuándo se ofrece el selector', () => {
  const simple = { layout: 'print' as const, plates: [], objects: [solid('a', [0, 0, 0])] };
  it('un proyecto simple de una placa no lo muestra', () => {
    expect(shouldOfferViewModes(simple)).toBe(false);
    expect(shouldOfferViewModes({ ...simple, plates: [{ id: 'p1' }] })).toBe(false);
  });
  it('con dos placas, una pieza con restPose o una pieza dividida sí', () => {
    expect(shouldOfferViewModes({ ...simple, plates: [{ id: 'p1' }, { id: 'p2' }] })).toBe(true);
    expect(shouldOfferViewModes({ ...simple, objects: [{ ...solid('a', [0, 0, 0]), restPose: { position: [1, 0, 0], rotation: [0, 0, 0] } }] })).toBe(true);
    expect(shouldOfferViewModes({ ...simple, objects: [{ ...solid('a', [0, 0, 0]), metadata: { split: {} } } as unknown as SceneObject] })).toBe(true);
  });
  it('estando en Armado siempre, para poder volver', () => {
    expect(shouldOfferViewModes({ ...simple, layout: 'assembly' })).toBe(true);
  });
});

describe('separación visual', () => {
  const objects = [solid('a', [-30, 0, 0]), solid('b', [30, 0, 0]), solid('c', [0, 0, 40])];
  const all = new Set(['a', 'b', 'c']);

  it('con factor 0 no mueve nada y no muta los objetos', () => {
    const before = JSON.stringify(objects.map((o) => o.position));
    expect(explodedFigurePositions(objects, all, 0).size).toBe(0);
    explodedFigurePositions(objects, all, 1);
    expect(JSON.stringify(objects.map((o) => o.position))).toBe(before);
  });

  it('cada pieza se aleja del centro en su propia dirección, más con más factor', () => {
    const half = explodedFigurePositions(objects, all, 0.5);
    const full = explodedFigurePositions(objects, all, 1);
    expect(half.get('a')![0]).toBeLessThan(-30);
    expect(half.get('b')![0]).toBeGreaterThan(30);
    expect(full.get('b')![0]).toBeGreaterThan(half.get('b')![0]);
    expect(full.get('c')![2]).toBeGreaterThan(40);
  });

  it('solo mueve las piezas del alcance y una sola pieza no se separa de sí misma', () => {
    const some = explodedFigurePositions(objects, new Set(['a', 'b']), 1);
    expect([...some.keys()].sort()).toEqual(['a', 'b']);
    expect(explodedFigurePositions(objects, new Set(['a']), 1).size).toBe(0);
  });
});
