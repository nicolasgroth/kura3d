/**
 * @file src/core/scene/__tests__/plates.test.ts
 * @description Pruebas del modelo de placas: crear (la placa implícita se vuelve «Placa 1»), orígenes que no
 * se solapan, borrar (las piezas pasan a la placa por defecto), renombrar, asignar, consultas, cama de la
 * placa, placa activa y saneo de datos externos (referencias rotas, duplicados, nombres largos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../../types/kura';
import type { ScenePlate } from '../../../types/plates';
import {
  assignToPlate, createPlate, deletePlate, MAX_PLATE_NAME, nextPlateName, nextPlateOrigin, objectsOnPlate, PLATE_GAP_MM,
  plateBed, plateOf, reconcilePlates, renamePlate, resolveActivePlate, type PlateScene, type ProjectBed,
} from '../plates';

function cube(size = 10): MeshData {
  const h = size / 2;
  const v = [[-h, 0, -h], [h, 0, -h], [h, size, -h], [-h, size, -h], [-h, 0, h], [h, 0, h], [h, size, h], [-h, size, h]];
  const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  return { positions: new Float32Array(v.flat()), indices: new Uint32Array(f) };
}

function obj(id: string, extra: Partial<SceneObject> = {}, position: Vec3 = [0, 0, 0]): SceneObject {
  const mesh = cube();
  return {
    id, name: id, source: 'primitive', position, rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ff0000',
    role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh), ...extra,
  };
}

const BED: ProjectBed = { widthMm: 220, depthMm: 220, heightMm: 250 };
const name = (n: number) => `Placa ${n}`;
const empty = (): PlateScene => ({ objects: [obj('a'), obj('b'), obj('ref', { role: 'reference' })], plates: [] });

/** Crea una placa con ids predecibles. */
function add(scene: PlateScene, id: string, bed?: ScenePlate['bed']) {
  const r = createPlate(scene, { id, name: nextPlateName(scene.plates, name), projectBed: BED, implicit: { id: 'p1', name: name(1) }, bed });
  expect(r).not.toBeNull();
  return r!;
}

/** true si las camas de dos placas quedan separadas al menos por `gap` en algún eje. */
function apart(a: ScenePlate, b: ScenePlate, gap = PLATE_GAP_MM) {
  const ba = plateBed(a, BED), bb = plateBed(b, BED);
  const dx = Math.abs(a.origin[0] - b.origin[0]) - (ba.widthMm + bb.widthMm) / 2;
  const dz = Math.abs(a.origin[1] - b.origin[1]) - (ba.depthMm + bb.depthMm) / 2;
  return dx >= gap - 1e-6 || dz >= gap - 1e-6;
}

describe('crear placas', () => {
  it('la primera creación vuelve explícita la placa implícita (en el origen) y le asigna las piezas sólidas', () => {
    const { scene, plate } = add(empty(), 'p2');
    expect(scene.plates.map((p) => [p.id, p.name, p.origin])).toEqual([['p1', 'Placa 1', [0, 0]], ['p2', 'Placa 2', [220 + PLATE_GAP_MM, 0]]]);
    expect(plate.id).toBe('p2');
    // Las piezas que se imprimen quedan en la placa 1; la referencia queda sin placa.
    expect(scene.objects.map((o) => o.plateRef)).toEqual(['p1', 'p1', undefined]);
  });

  it('con placas ya explícitas no toca las piezas y numera con el primer nombre libre', () => {
    let s = add(empty(), 'p2').scene;
    s = renamePlate(s, 'p2', 'Cabeza')!;
    const r = add(s, 'p3');
    expect(r.plate.name).toBe('Placa 3');
    expect(r.scene.objects).toBe(s.objects);
  });

  it('con «Bases» y «Placa 2» la nueva es «Placa 3», y salta los números ya usados', () => {
    const name = (n: number) => `Placa ${n}`;
    const mk = (names: string[]) => names.map((n, i) => ({ id: `q${i}`, name: n, origin: [0, 0] as [number, number] }));
    expect(nextPlateName(mk(['Bases', 'Placa 2']), name)).toBe('Placa 3');
    expect(nextPlateName(mk(['Bases', 'Placa 3']), name)).toBe('Placa 4');
    expect(nextPlateName([], name)).toBe('Placa 2');
  });

  it('los orígenes forman una cuadrícula sin solaparse (4 por fila, luego hacia el fondo)', () => {
    let s = empty();
    for (let i = 2; i <= 9; i++) s = add(s, `p${i}`).scene;
    const pitch = 220 + PLATE_GAP_MM;
    expect(s.plates.map((p) => p.origin)).toEqual([
      [0, 0], [pitch, 0], [2 * pitch, 0], [3 * pitch, 0], [0, -pitch], [pitch, -pitch], [2 * pitch, -pitch], [3 * pitch, -pitch], [0, -2 * pitch],
    ]);
    for (let i = 0; i < s.plates.length; i++) for (let j = i + 1; j < s.plates.length; j++) expect(apart(s.plates[i], s.plates[j])).toBe(true);
  });

  it('una cama propia más grande no se solapa con las vecinas, y un hueco liberado se reutiliza', () => {
    let s = add(empty(), 'p2').scene;
    s = add(s, 'p3', { name: 'Grande', widthMm: 400, depthMm: 350, heightMm: 300 }).scene;
    s = add(s, 'p4').scene;
    for (let i = 0; i < s.plates.length; i++) for (let j = i + 1; j < s.plates.length; j++) expect(apart(s.plates[i], s.plates[j])).toBe(true);
    s = deletePlate(s, 'p2')!;
    const origin = nextPlateOrigin(s.plates, BED);
    // El hueco que dejó la placa 2 queda antes que el final de la fila.
    expect(origin).toEqual([440, 0]);
    expect(s.plates.every((p) => apart(p, { id: 'x', name: 'x', origin: origin! }))).toBe(true);
  });

  it('rechaza camas inválidas, ids repetidos y nombres vacíos', () => {
    const s = add(empty(), 'p2').scene;
    const base = { name: 'X', projectBed: BED, implicit: { id: 'p1', name: name(1) } };
    expect(createPlate(s, { ...base, id: 'p2' })).toBeNull();
    expect(createPlate(s, { ...base, id: 'p9', bed: { name: 'mala', widthMm: -1, depthMm: 10, heightMm: 10 } })).toBeNull();
    expect(createPlate(s, { ...base, id: 'p9', bed: { name: 'mala', widthMm: Number.NaN, depthMm: 10, heightMm: 10 } })).toBeNull();
    expect(createPlate(s, { ...base, id: 'p9', name: '   ' })).toBeNull();
  });
});

describe('borrar, renombrar y asignar', () => {
  it('borrar una placa pasa sus piezas a la placa por defecto sin moverlas', () => {
    let s = add(empty(), 'p2').scene;
    s = assignToPlate(s, ['b'], 'p2')!;
    const before = s.objects.find((o) => o.id === 'b')!.position;
    s = deletePlate(s, 'p2')!;
    expect(s.plates.map((p) => p.id)).toEqual(['p1']);
    expect(s.objects.find((o) => o.id === 'b')!.plateRef).toBe('p1');
    expect(s.objects.find((o) => o.id === 'b')!.position).toEqual(before);
  });

  it('borrar la primera placa pasa sus piezas a la siguiente; con destino null quedan sin placa', () => {
    let s = add(add(empty(), 'p2').scene, 'p3').scene;
    const moved = deletePlate(s, 'p1')!;
    expect(moved.objects.filter((o) => o.role === 'solid').every((o) => o.plateRef === 'p2')).toBe(true);
    s = deletePlate(s, 'p1', null)!;
    expect(s.objects.every((o) => o.plateRef === undefined)).toBe(true);
    s = deletePlate(add(add(empty(), 'p2').scene, 'p3').scene, 'p1', 'p3')!;
    expect(s.objects.filter((o) => o.role === 'solid').every((o) => o.plateRef === 'p3')).toBe(true);
  });

  it('no borra la última placa ni una que no existe', () => {
    const s = deletePlate(add(empty(), 'p2').scene, 'p2')!;
    expect(deletePlate(s, 'p1')).toBeNull();
    expect(deletePlate(s, 'nada')).toBeNull();
    expect(deletePlate(empty(), 'p1')).toBeNull();
  });

  it('renombrar recorta, rechaza vacío y no cambia nada si el nombre es igual', () => {
    const s = add(empty(), 'p2').scene;
    expect(renamePlate(s, 'p2', '  Cuerpo  ')!.plates[1].name).toBe('Cuerpo');
    expect(renamePlate(s, 'p2', 'x'.repeat(200))!.plates[1].name).toHaveLength(MAX_PLATE_NAME);
    expect(renamePlate(s, 'p2', '   ')).toBeNull();
    expect(renamePlate(s, 'p2', 'Placa 2')).toBeNull();
    expect(renamePlate(s, 'nada', 'X')).toBeNull();
  });

  it('asignar mueve solo sólidos no bloqueados; ids ajenos se ignoran', () => {
    const base = add({ ...empty(), objects: [...empty().objects, obj('lk', { locked: true }), obj('neg', { role: 'negative' })] }, 'p2').scene;
    const s = assignToPlate(base, ['a', 'ref', 'lk', 'neg', 'fantasma'], 'p2')!;
    expect(objectsOnPlate(s.objects, 'p2')).toEqual(['a']);
    expect(assignToPlate(s, ['a'], 'p2')).toBeNull();
    expect(assignToPlate(s, ['a'], 'nada')).toBeNull();
  });

  it('plateOf y objectsOnPlate', () => {
    const s = assignToPlate(add(empty(), 'p2').scene, ['b'], 'p2')!;
    expect(plateOf(s.plates, s.objects[1])?.id).toBe('p2');
    expect(plateOf(s.plates, s.objects[2])).toBeNull();
    expect(plateOf(s.plates, obj('z', { plateRef: 'rota' }))).toBeNull();
    expect(objectsOnPlate(s.objects, 'p1')).toEqual(['a']);
  });
});

describe('cama de la placa y placa activa', () => {
  it('plateBed usa la cama propia o la del proyecto', () => {
    expect(plateBed(null, BED)).toEqual(BED);
    expect(plateBed({ id: 'x', name: 'x', origin: [0, 0] }, BED)).toEqual(BED);
    const own = { name: 'Otra', widthMm: 300, depthMm: 200, heightMm: 100, marginMm: 3 };
    expect(plateBed({ id: 'x', name: 'x', origin: [0, 0], bed: own }, BED)).toEqual({ widthMm: 300, depthMm: 200, heightMm: 100, marginMm: 3 });
  });

  it('la placa activa cae en la primera si el id no existe', () => {
    const s = add(empty(), 'p2').scene;
    expect(resolveActivePlate(s.plates, 'p2')?.id).toBe('p2');
    expect(resolveActivePlate(s.plates, 'rota')?.id).toBe('p1');
    expect(resolveActivePlate(s.plates, null)?.id).toBe('p1');
    expect(resolveActivePlate([], 'p2')).toBeNull();
  });
});

describe('saneo', () => {
  it('sin placas ni referencias devuelve la misma escena (sin copias)', () => {
    const s = empty();
    expect(reconcilePlates(s)).toBe(s);
  });

  it('una referencia rota pasa a la placa por defecto; sin placas se quita', () => {
    const plates: ScenePlate[] = [{ id: 'p1', name: 'Placa 1', origin: [0, 0] }];
    const s = reconcilePlates({ objects: [obj('a', { plateRef: 'rota' }), obj('b', { plateRef: 'p1' })], plates });
    expect(s.objects.map((o) => o.plateRef)).toEqual(['p1', 'p1']);
    const none = reconcilePlates({ objects: [obj('a', { plateRef: 'rota' })], plates: [] });
    expect(none.objects).toHaveLength(1);
    expect('plateRef' in none.objects[0]).toBe(false);
  });

  it('descarta placas con id repetido y recorta nombres', () => {
    const plates: ScenePlate[] = [
      { id: 'p1', name: 'x'.repeat(300), origin: [0, 0] },
      { id: 'p1', name: 'copia', origin: [500, 0] },
    ];
    const s = reconcilePlates({ objects: [], plates });
    expect(s.plates).toHaveLength(1);
    expect(s.plates[0].name).toHaveLength(MAX_PLATE_NAME);
  });
});
