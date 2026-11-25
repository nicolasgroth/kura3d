/**
 * @file src/core/scene/__tests__/plateExportFollow.test.ts
 * @description Lógica pura de exportar por placa (lote P6) y de reasignar la placa al cambiar la posición:
 * coordenadas respecto de la cama de cada placa, cubos por placa, piezas sin placa excluidas, sin placas sin
 * cambios; y reasignación por posición que respeta los cambios explícitos de placa y arrastra a los acompañantes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { SceneObject, Vec3 } from '../../../types/kura';
import type { ScenePlate } from '../../../types/plates';
import { planPlateExport, shiftForExport } from '../plateExport';
import { reassignMovedPieces } from '../plateFollow';

const BED = { widthMm: 200, depthMm: 200, heightMm: 200 };
const PLATES: ScenePlate[] = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] },
  { id: 'p2', name: 'Placa 2', origin: [250, 0] },
];

function mesh(size: number) {
  const h = size / 2;
  const positions = new Float32Array([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h, -h, size, -h, h, size, -h, h, size, h, -h, size, h]);
  return { positions, indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]) };
}

function box(id: string, position: Vec3, plateRef?: string, extra: Partial<SceneObject> = {}): SceneObject {
  return {
    id, name: id, source: 'primitive', position, rotation: [0, 0, 0], scale: [1, 1, 1], color: '#fff', role: 'solid', visible: true, locked: false,
    mesh: mesh(20), stats: { triangles: 12, vertices: 8, isManifold: true, volumeMm3: 8000, dimensionsMm: [20, 20, 20] },
    ...(plateRef ? { plateRef } : {}), ...extra,
  } as unknown as SceneObject;
}

describe('planPlateExport', () => {
  it('sin placas: un solo cubo con los mismos objetos (mismas referencias)', () => {
    const objs = [box('a', [10, 0, 0]), box('b', [-30, 0, 5])];
    const plan = planPlateExport(objs, []);
    expect(plan.excluded).toBe(0);
    expect(plan.buckets).toHaveLength(1);
    expect(plan.buckets[0].plateId).toBeNull();
    expect(plan.buckets[0].objects[0]).toBe(objs[0]);
    expect(plan.buckets[0].objects[1]).toBe(objs[1]);
  });

  it('una sola placa en el origen: idéntico a sin placas', () => {
    const objs = [box('a', [10, 0, 0], 'p1')];
    const plan = planPlateExport(objs, [PLATES[0]]);
    expect(plan.buckets).toHaveLength(1);
    expect(plan.buckets[0].objects[0]).toBe(objs[0]);
  });

  it('una sola placa fuera del origen: resta su origen', () => {
    const plan = planPlateExport([box('a', [260, 0, 3], 'p2')], [PLATES[1]]);
    expect(plan.buckets[0].objects[0].position).toEqual([10, 0, 3]);
  });

  it('dos placas: un cubo por placa en el orden de las placas, cada pieza respecto de su cama', () => {
    const objs = [box('b', [255, 0, -4], 'p2'), box('a', [5, 0, -4], 'p1')];
    const plan = planPlateExport(objs, PLATES);
    expect(plan.buckets.map((b) => b.plateId)).toEqual(['p1', 'p2']);
    expect(plan.buckets.map((b) => b.name)).toEqual(['Placa 1', 'Placa 2']);
    expect(plan.buckets[0].objects[0].position).toEqual([5, 0, -4]);
    expect(plan.buckets[1].objects[0].position).toEqual([5, 0, -4]);
    // La escena no se toca.
    expect(objs[0].position).toEqual([255, 0, -4]);
  });

  it('dos placas: lo que no tiene placa se excluye y se cuenta', () => {
    const plan = planPlateExport([box('a', [5, 0, 0], 'p1'), box('x', [0, 0, 400])], PLATES);
    expect(plan.excluded).toBe(1);
    expect(plan.buckets).toHaveLength(1);
    expect(plan.buckets[0].objects.map((o) => o.id)).toEqual(['a']);
  });

  it('un agregado sin placa sigue la placa de su pieza', () => {
    const host = box('h', [260, 0, 0], 'p2');
    const addon = box('m', [262, 0, 0], undefined, { metadata: { addon: { hostId: 'h' } } } as never);
    const plan = planPlateExport([box('a', [0, 0, 0], 'p1'), host, addon], PLATES);
    expect(plan.excluded).toBe(0);
    expect(plan.buckets[1].objects.map((o) => o.id)).toEqual(['h', 'm']);
    expect(plan.buckets[1].objects[1].position).toEqual([12, 0, 0]);
  });

  it('shiftForExport da los desplazamientos no nulos (para restaurar la escena)', () => {
    const { objects, offsets } = shiftForExport([box('a', [5, 0, 0], 'p1'), box('b', [255, 0, 0], 'p2')], PLATES);
    expect(objects[1].position).toEqual([5, 0, 0]);
    expect(offsets).toEqual({ b: [250, 0] });
  });
});

describe('reassignMovedPieces', () => {
  it('una pieza movida sobre la cama de otra placa pasa a esa placa', () => {
    const before = [box('a', [0, 0, 0], 'p1')];
    const after = [{ ...before[0], position: [250, 0, 10] as Vec3 }];
    const next = reassignMovedPieces(before, after, PLATES, BED)!;
    expect(next[0].plateRef).toBe('p2');
  });

  it('fuera de toda placa conserva la suya', () => {
    const before = [box('a', [0, 0, 0], 'p1')];
    const after = [{ ...before[0], position: [600, 0, 0] as Vec3 }];
    expect(reassignMovedPieces(before, after, PLATES, BED)).toBeNull();
  });

  it('no pelea con un cambio de placa explícito en el mismo paso (Mover a placa)', () => {
    const before = [box('a', [0, 0, 0], 'p1')];
    const after = [{ ...before[0], plateRef: 'p2', position: [0, 0, 300] as Vec3 }];
    expect(reassignMovedPieces(before, after, PLATES, BED)).toBeNull();
  });

  it('sin moverse no cambia nada; con una sola placa tampoco', () => {
    const before = [box('a', [250, 0, 0], 'p1')];
    expect(reassignMovedPieces(before, [{ ...before[0], color: '#000' }], PLATES, BED)).toBeNull();
    expect(reassignMovedPieces(before, [{ ...before[0], position: [251, 0, 0] as Vec3 }], [PLATES[0]], BED)).toBeNull();
  });

  it('referencias, negativos y bloqueadas no se reasignan', () => {
    const ref = box('r', [0, 0, 0], 'p1', { role: 'reference' } as never);
    const locked = box('l', [0, 0, 0], 'p1', { locked: true });
    const after = [ref, locked].map((o) => ({ ...o, position: [250, 0, 0] as Vec3 }));
    expect(reassignMovedPieces([ref, locked], after, PLATES, BED)).toBeNull();
  });

  it('el agregado de una pieza reasignada la acompaña', () => {
    const host = box('h', [0, 0, 0], 'p1');
    const addon = box('m', [2, 0, 0], 'p1', { metadata: { addon: { hostId: 'h' } } } as never);
    const after = [{ ...host, position: [250, 0, 0] as Vec3 }, { ...addon, position: [252, 0, 0] as Vec3 }];
    const next = reassignMovedPieces([host, addon], after, PLATES, BED)!;
    expect(next.map((o) => o.plateRef)).toEqual(['p2', 'p2']);
  });

  it('los negativos con placa de un grupo cuyas piezas cambian todas de placa las acompañan', () => {
    const a = box('a', [0, 0, 0], 'p1', { groupRef: 'g' });
    const neg = box('n', [0, 0, 0], 'p1', { groupRef: 'g', role: 'negative' } as never);
    const after = [{ ...a, position: [250, 0, 0] as Vec3 }, { ...neg, position: [250, 0, 0] as Vec3 }];
    const next = reassignMovedPieces([a, neg], after, PLATES, BED)!;
    expect(next.map((o) => o.plateRef)).toEqual(['p2', 'p2']);
  });
});
