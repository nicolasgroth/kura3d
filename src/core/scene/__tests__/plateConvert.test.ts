/**
 * @file src/core/scene/__tests__/plateConvert.test.ts
 * @description «Convertir grupos en placas» (P7): una placa por grupo raíz con su nombre, piezas con sus posiciones
 * relativas y centradas en su cama, sin solapes entre placas, placa implícita para lo que queda fuera, grupos con
 * piezas bloqueadas o subgrupos que no se convierten, y detección de grupos con nombre de placa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { SceneGroup, SceneObject, Vec3 } from '../../../types/kura';
import { footprintOf } from '../freeSpot';
import { convertGroupsToPlates, plateNamedGroups } from '../plateConvert';
import { overlappingPlates } from '../plateOverlap';

const BED = { widthMm: 200, depthMm: 200, heightMm: 200 };

function mesh(size: number) {
  const h = size / 2;
  const positions = new Float32Array([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h, -h, size, -h, h, size, -h, h, size, h, -h, size, h]);
  return { positions, indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]) };
}
function box(id: string, position: Vec3, groupRef?: string, extra: Partial<SceneObject> = {}): SceneObject {
  return {
    id, name: id, source: 'imported', position, rotation: [0, 0, 0], scale: [1, 1, 1], color: '#fff', role: 'solid', visible: true, locked: false,
    mesh: mesh(20), stats: { triangles: 12, vertices: 8, isManifold: true, volumeMm3: 8000, dimensionsMm: [20, 20, 20] },
    ...(groupRef ? { groupRef } : {}), ...extra,
  } as unknown as SceneObject;
}
const group = (id: string, name: string, parentId?: string): SceneGroup => ({ id, name, visible: true, locked: false, collapsed: false, ...(parentId ? { parentId } : {}) });

let n = 0;
const opts = { projectBed: BED, makeId: () => `plate_${++n}`, nameFor: (k: number) => `Placa ${k}` };

describe('convertir grupos en placas', () => {
  it('disuelve solo los grupos que `dissolve` marca; sus subgrupos suben a la raíz', () => {
    n = 0;
    const scene = {
      objects: [box('a', [0, 0, 0], 'g1'), box('b', [300, 0, 0], 'g2'), box('c', [310, 0, 0], 'g3')],
      plates: [], groups: [group('g1', 'Placa 1'), group('g2', 'Mío'), group('g3', 'Sub', 'g2')],
    };
    const res = convertGroupsToPlates(scene, ['g1', 'g2'], { ...opts, dissolve: (g) => g.name === 'Placa 1' })!;
    expect(res.dissolved).toEqual(['g1']);
    expect(res.groups.map((g) => g.id)).toEqual(['g2', 'g3']);
    expect(res.scene.objects[0].groupRef).toBeUndefined();
    expect(res.scene.objects[1].groupRef).toBe('g2');
    const dis = convertGroupsToPlates(scene, ['g2'], { ...opts, dissolve: () => true })!;
    expect(dis.groups.map((g) => [g.id, g.parentId])).toEqual([['g1', undefined], ['g3', undefined]]);
    expect(dis.scene.objects[2].groupRef).toBe('g3');
  });

  it('una placa por grupo, con su nombre, piezas centradas en su cama y posiciones relativas intactas', () => {
    n = 0;
    // Así llega un 3MF de Bambu con dos placas: dos grupos lado a lado.
    const scene = {
      objects: [box('a', [-30, 0, 0], 'g1'), box('b', [10, 0, 0], 'g1'), box('c', [400, 0, 50], 'g2')],
      plates: [], groups: [group('g1', 'Cuerpo'), group('g2', 'Placa 2')],
    };
    const res = convertGroupsToPlates(scene, ['g1', 'g2'], opts)!;
    expect(res.created).toHaveLength(2);
    expect(res.scene.plates.map((p) => p.name)).toEqual(['Cuerpo', 'Placa 2']);
    expect(res.scene.plates[0].origin).toEqual([0, 0]);
    expect(overlappingPlates(res.scene.plates, BED)).toEqual([]);
    const [a, b, c] = res.scene.objects;
    expect(a.plateRef).toBe(res.created[0]);
    expect(c.plateRef).toBe(res.created[1]);
    expect(b.position[0] - a.position[0]).toBeCloseTo(40);
    // Huella del grupo 1 centrada en su cama.
    const fa = footprintOf(a.mesh, a.position, a.rotation, a.scale)!;
    const fb = footprintOf(b.mesh, b.position, b.rotation, b.scale)!;
    expect((fa.minX + fb.maxX) / 2).toBeCloseTo(0);
    const fc = footprintOf(c.mesh, c.position, c.rotation, c.scale)!;
    expect((fc.minX + fc.maxX) / 2).toBeCloseTo(res.scene.plates[1].origin[0]);
    expect((fc.minZ + fc.maxZ) / 2).toBeCloseTo(res.scene.plates[1].origin[1]);
  });

  it('el nombre del grupo no repite el de una placa existente (siguiente número libre)', () => {
    n = 0;
    const scene = { objects: [box('suelta', [0, 0, 0]), box('a', [500, 0, 0], 'g1')], plates: [], groups: [group('g1', 'Placa 1')] };
    const res = convertGroupsToPlates(scene, ['g1'], opts)!;
    expect(res.scene.plates.map((p) => p.name)).toEqual(['Placa 1', 'Placa 2']);
  });

  it('lo que queda fuera de los grupos va a la placa implícita del origen', () => {
    n = 0;
    const scene = { objects: [box('suelta', [0, 0, 0]), box('a', [500, 0, 0], 'g1')], plates: [], groups: [group('g1', 'Placa 1')] };
    const res = convertGroupsToPlates(scene, ['g1'], opts)!;
    expect(res.scene.plates).toHaveLength(2);
    expect(res.scene.plates[0].origin).toEqual([0, 0]);
    expect(res.scene.objects[0].plateRef).toBe(res.scene.plates[0].id);
    expect(res.scene.objects[0].position).toEqual([0, 0, 0]);
    expect(res.scene.objects[1].plateRef).toBe(res.created[0]);
  });

  it('grupos con piezas bloqueadas, sin sólidos, subgrupos o inexistentes no se convierten; null si no queda ninguno', () => {
    n = 0;
    const scene = {
      objects: [box('a', [0, 0, 0], 'g1', { locked: true }), box('r', [0, 0, 0], 'g2', { role: 'reference' } as Partial<SceneObject>), box('s', [0, 0, 0], 'g3b')],
      plates: [], groups: [group('g1', 'A'), group('g2', 'B'), group('g3', 'C'), group('g3b', 'C hijo', 'g3')],
    };
    expect(convertGroupsToPlates(scene, ['g1', 'g2', 'g3b', 'nope'], opts)).toBeNull();
    const res = convertGroupsToPlates(scene, ['g1', 'g3'], opts)!;
    expect(res.skipped).toEqual(['g1']);
    expect(res.scene.objects[2].plateRef).toBe(res.created[0]);
  });

  it('detecta grupos raíz con nombre de placa', () => {
    const groups = [group('a', 'Placa 1'), group('b', 'Plate 12'), group('c', 'Cuerpo'), group('d', 'Placa 3', 'c')];
    expect(plateNamedGroups(groups, (s) => /^(placa|plate) \d+$/i.test(s))).toEqual(['a', 'b']);
  });
});
