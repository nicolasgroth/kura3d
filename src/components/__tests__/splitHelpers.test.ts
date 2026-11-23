/**
 * @file src/components/__tests__/splitHelpers.test.ts
 * @description Piezas de interfaz de "dividir para imprimir": traducción de la fase `cut:i/n`,
 * animación ida y vuelta del armado, vista explosionada en 0 = armado exacto, disposición de
 * impresión por placas con su vuelta al armado, y nombre de archivo por pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import {
  arrangeSplitGroupPatches,
  explodedSplitPositions,
  plateOffsetX,
  splitArrangementOf,
  splitGroupOf,
  splitPartFileName,
} from '../../core/scene/splitGroups';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject, Vec3 } from '../../types/kura';
import { pingPongFactor } from '../split/SplitAssemblyControl';
import { parseCutPhase, progressPhaseLabel } from '../split/splitProgress';

function part(id: string, code: string, y: number, plate: number): SceneObject {
  const base = fakeBox(id, `Tubo · ${code}`, 100);
  return {
    ...base,
    position: [0, y, 0],
    metadata: {
      split: {
        groupId: 'g',
        code,
        cell: [0, 0, 0],
        assembly: { position: [0, y, 0], rotation: [0, 0, 0] },
        print: { position: [10, 0, -20], rotation: [Math.PI, 0, 0], plate, downFace: '+y' },
        jointLabels: ['1'],
      },
    },
  };
}

describe('fase de progreso', () => {
  it('traduce cut:i/n como "Cortando i+1 de n" y, al terminar, la preparación de uniones', () => {
    expect(parseCutPhase('cut:2/7')).toEqual({ done: 2, total: 7 });
    expect(parseCutPhase('compute')).toBeNull();
    expect(parseCutPhase('cut:9/7')).toBeNull();
    expect(progressPhaseLabel('es', 'cut:2/7')).toBe('Cortando 3 de 7');
    expect(progressPhaseLabel('es', 'cut:7/7')).toBe('Preparando uniones y marcas');
    expect(progressPhaseLabel('en', 'cut:0/4')).toBe('Cutting 1 of 4');
    expect(progressPhaseLabel('es', null)).toBeNull();
  });
});

describe('control de armado', () => {
  it('la animación va de 0 a 1 y vuelve', () => {
    expect(pingPongFactor(0)).toBeCloseTo(0, 6);
    expect(pingPongFactor(1600)).toBeCloseTo(1, 6);
    expect(pingPongFactor(3200)).toBeCloseTo(0, 6);
    expect(pingPongFactor(800)).toBeCloseTo(0.5, 6);
  });

  it('factor 0 es el armado exacto y factor 1 separa las piezas', () => {
    const objects = [part('a', 'A1', 0, 0), part('b', 'A2', 100, 0), part('c', 'A3', 200, 1)];
    const group = splitGroupOf(objects, 'b')!;
    expect(group.parts).toHaveLength(3);
    const at0 = explodedSplitPositions(group, 0);
    for (const o of objects) expect(at0.get(o.id)).toEqual(o.position);
    const at1 = explodedSplitPositions(group, 1);
    // Separadas, ninguna baja de la cama: la de abajo queda apoyada y las demás se alejan hacia arriba.
    expect(at1.get('a')![1]).toBeGreaterThanOrEqual(0);
    expect(at1.get('c')![1] - at1.get('a')![1]).toBeGreaterThan(200);
    expect(at1.get('c')![1]).toBeGreaterThan(200);
  });

  it('prepara para imprimir por placas y vuelve a armar', () => {
    const objects = [part('a', 'A1', 0, 0), part('b', 'A2', 100, 1)];
    const group = splitGroupOf(objects, 'a')!;
    expect(splitArrangementOf(group, 256)).toBe('assembly');
    const toPrint = arrangeSplitGroupPatches(group, 'print', 256);
    expect(toPrint.find((p) => p.id === 'b')!.patch.position).toEqual([10 + plateOffsetX(1, 256), 0, -20]);
    const printed = objects.map((o) => ({ ...o, ...toPrint.find((p) => p.id === o.id)!.patch }));
    const printedGroup = splitGroupOf(printed, 'a')!;
    expect(splitArrangementOf(printedGroup, 256)).toBe('print');
    expect(arrangeSplitGroupPatches(printedGroup, 'print', 256)).toEqual([]);
    const back = arrangeSplitGroupPatches(printedGroup, 'assembly', 256);
    expect(back.map((p) => p.patch.position)).toEqual([[0, 0, 0], [0, 100, 0]] as Vec3[]);
  });

  it('una pieza suelta no forma grupo', () => {
    expect(splitGroupOf([fakeBox('x', 'Cubo', 10)], 'x')).toBeNull();
  });
});

describe('nombre de archivo por pieza', () => {
  it('usa <proyecto>_<código>.<ext> sin caracteres problemáticos', () => {
    expect(splitPartFileName('Estatua', 'A1', 'stl')).toBe('Estatua_A1.stl');
    expect(splitPartFileName('Mi proyecto: v2', 'B2a', '.3mf')).toBe('Mi_proyecto_v2_B2a.3mf');
    expect(splitPartFileName('  ', 'A1', 'obj')).toBe('kura3d_A1.obj');
    expect(splitPartFileName('Unión · estatua', 'C1b', 'stl')).toBe('Union_estatua_C1b.stl');
  });
});
