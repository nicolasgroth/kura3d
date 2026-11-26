/**
 * @file src/components/__tests__/figureExplodeCache.test.ts
 * @description Caché de la separación de la figura: memoizada por escena y por alcance (toda la figura o un grupo, con
 * su factor). Alternar entre dos alcances sobre la misma escena no recalcula; cambiar la escena sí.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneGroup, SceneObject } from '../../types/kura';
import type { FigureExplode } from '../../store/slices/viewModeSlice';
import { figureExplodePositions } from '../viewmode/useFigureExplode';

function solid(id: string, position: [number, number, number], groupRef?: string): SceneObject {
  const h = 5;
  const positions = new Float32Array([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h, -h, 10, -h, h, 10, -h, h, 10, h, -h, 10, h]);
  return { ...fakeBox(id, id), position, visible: true, ...(groupRef ? { groupRef } : {}), mesh: { positions, indices: new Uint32Array([0, 1, 2, 0, 2, 3]) } } as SceneObject;
}

describe('figureExplodePositions: caché por alcance', () => {
  const objects = [solid('a', [-30, 0, 0], 'g1'), solid('b', [30, 0, 0], 'g1'), solid('c', [0, 0, 40])];
  const groups = [{ id: 'g1', name: 'G', parentId: null }] as unknown as SceneGroup[];
  const all: FigureExplode = { scope: 'all', groupKey: null, factor: 0.5 } as FigureExplode;
  const group: FigureExplode = { scope: 'group', groupKey: 'g:g1', factor: 0.5 } as FigureExplode;

  it('alternar entre toda la figura y un grupo reutiliza cada cálculo', () => {
    const first = figureExplodePositions(objects, groups, all);
    const inGroup = figureExplodePositions(objects, groups, group);
    expect(inGroup).not.toBe(first);
    // Mismo alcance con otro objeto de separación igual (cada render del deslizador crea uno): mismo resultado.
    expect(figureExplodePositions(objects, groups, { ...all })).toBe(first);
    expect(figureExplodePositions(objects, groups, { ...group })).toBe(inGroup);
  });

  it('otro factor o una escena nueva recalculan', () => {
    const first = figureExplodePositions(objects, groups, all);
    expect(figureExplodePositions(objects, groups, { ...all, factor: 0.8 })).not.toBe(first);
    expect(figureExplodePositions([...objects], groups, all)).not.toBe(first);
  });
});
