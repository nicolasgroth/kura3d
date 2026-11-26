/**
 * @file src/core/scene/__tests__/groups.test.ts
 * @description Pruebas del modelo de grupos: agrupar, desagrupar, anidar, ciclos y huérfanos, orden
 * contiguo, visibilidad/bloqueo, selección por grupo, árbol, reordenar/meter/sacar, duplicar la
 * estructura, transformación rígida y combinar (volumen = suma).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../../../engine';
import type { MeshData, SceneGroup, SceneObject, Vec3 } from '../../../types/kura';
import { concatWorldMeshes } from '../../operations/organizeOperations';
import {
  buildSceneTree, descendantObjectIds, duplicateGroupStructure, effectiveLocked, effectiveVisible, groupSelection,
  indentNode, MAX_GROUP_DEPTH, moveNode, outdentNode, pickSelection, reconcileGroups, reorderNode, selectedGroup,
  setGroupFlag, ungroup, type GroupScene,
} from '../groups';
import { rigidTransformPatches, selectionPivot } from '../groupTransform';

function cube(size = 10): MeshData {
  const h = size / 2;
  const v = [[-h, 0, -h], [h, 0, -h], [h, size, -h], [-h, size, -h], [-h, 0, h], [h, 0, h], [h, size, h], [-h, size, h]];
  const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  return { positions: new Float32Array(v.flat()), indices: new Uint32Array(f) };
}

function obj(id: string, position: Vec3 = [0, 0, 0], extra: Partial<SceneObject> = {}): SceneObject {
  const mesh = cube();
  return {
    id, name: id, source: 'primitive', position, rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ff0000',
    role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh), ...extra,
  };
}

const scene4 = (): GroupScene => ({ objects: [obj('a'), obj('b', [20, 0, 0]), obj('c', [40, 0, 0]), obj('d', [60, 0, 0])], groups: [] });
const ids = (s: GroupScene) => s.objects.map((o) => o.id);

describe('agrupar y desagrupar', () => {
  it('agrupa la selección y deja a los miembros contiguos donde estaba el primero', () => {
    const s = groupSelection(scene4(), ['b', 'd'], { id: 'g1', name: 'Grupo 1' })!;
    expect(s.groups).toHaveLength(1);
    expect(ids(s)).toEqual(['a', 'b', 'd', 'c']);
    expect(descendantObjectIds(s.objects, s.groups, 'g1')).toEqual(['b', 'd']);
  });

  it('anida: un grupo entero seleccionado entra con su estructura', () => {
    let s = groupSelection(scene4(), ['a', 'b'], { id: 'g1', name: 'G1' })!;
    s = groupSelection(s, ['a', 'b', 'c'], { id: 'g2', name: 'G2' })!;
    expect(s.groups.find((g) => g.id === 'g1')!.parentId).toBe('g2');
    expect(s.objects.find((o) => o.id === 'c')!.groupRef).toBe('g2');
    expect(s.objects.find((o) => o.id === 'a')!.groupRef).toBe('g1');
    const tree = buildSceneTree(s.objects, s.groups);
    expect(tree[0].kind).toBe('group');
    expect(tree[0].kind === 'group' && tree[0].objectCount).toBe(3);
  });

  it('desagrupar pasa los hijos al padre y borra el grupo', () => {
    let s = groupSelection(scene4(), ['a', 'b'], { id: 'g1', name: 'G1' })!;
    s = groupSelection(s, ['a', 'b', 'c'], { id: 'g2', name: 'G2' })!;
    s = ungroup(s, 'g1')!;
    expect(s.groups.map((g) => g.id)).toEqual(['g2']);
    expect(s.objects.find((o) => o.id === 'a')!.groupRef).toBe('g2');
    s = ungroup(s, 'g2')!;
    expect(s.groups).toEqual([]);
    expect(s.objects.every((o) => o.groupRef === undefined)).toBe(true);
  });
});

describe('saneado', () => {
  it('quita referencias huérfanas, grupos vacíos y ciclos', () => {
    const groups: SceneGroup[] = [
      { id: 'x', name: 'x', parentId: 'y', visible: true, locked: false, collapsed: false },
      { id: 'y', name: 'y', parentId: 'x', visible: true, locked: false, collapsed: false },
      { id: 'vacío', name: 'v', visible: true, locked: false, collapsed: false },
    ];
    const objects = [obj('a', [0, 0, 0], { groupRef: 'x' }), obj('b', [0, 0, 0], { groupRef: 'nadie' })];
    const s = reconcileGroups({ objects, groups });
    expect(s.objects[1].groupRef).toBeUndefined();
    expect(s.groups.some((g) => g.id === 'vacío')).toBe(false);
    // Sin ciclos: alguna cadena termina en la raíz.
    const x = s.groups.find((g) => g.id === 'x')!;
    const y = s.groups.find((g) => g.id === 'y');
    expect(x.parentId === undefined || y?.parentId === undefined).toBe(true);
  });

  it('acota la profundidad', () => {
    const groups: SceneGroup[] = Array.from({ length: MAX_GROUP_DEPTH + 4 }, (_, i) => ({
      id: `g${i}`, name: `g${i}`, ...(i > 0 ? { parentId: `g${i - 1}` } : {}), visible: true, locked: false, collapsed: false,
    }));
    const s = reconcileGroups({ objects: [obj('a', [0, 0, 0], { groupRef: `g${MAX_GROUP_DEPTH + 3}` })], groups });
    const tree = buildSceneTree(s.objects, s.groups);
    const depth = (nodes: typeof tree): number => Math.max(0, ...nodes.map((n) => (n.kind === 'object' ? 0 : 1 + depth(n.children))));
    expect(depth(tree)).toBeLessThanOrEqual(MAX_GROUP_DEPTH);
  });

  it('no cambia referencias si ya está sano', () => {
    const s = groupSelection(scene4(), ['a', 'b'], { id: 'g1', name: 'G1' })!;
    const again = reconcileGroups(s);
    expect(again.objects).toBe(s.objects);
    expect(again.groups).toBe(s.groups);
  });
});

describe('visibilidad, bloqueo y selección', () => {
  it('ocultar o bloquear un grupo afecta a sus miembros y el grupo los resume', () => {
    let s = groupSelection(scene4(), ['a', 'b'], { id: 'g1', name: 'G1' })!;
    s = setGroupFlag(s, 'g1', 'visible', false);
    expect(s.objects.filter((o) => !o.visible).map((o) => o.id)).toEqual(['a', 'b']);
    expect(s.groups[0].visible).toBe(false);
    s = setGroupFlag(s, 'g1', 'locked', true);
    expect(s.groups[0].locked).toBe(true);
    const a = s.objects.find((o) => o.id === 'a')!;
    expect(effectiveLocked(s.groups, { ...a, locked: false })).toBe(true);
    expect(effectiveVisible(s.groups, { ...a, visible: true })).toBe(false);
  });

  it('clic selecciona el grupo raíz; dentro del grupo selecciona el hijo', () => {
    let s = groupSelection(scene4(), ['a', 'b'], { id: 'g1', name: 'G1' })!;
    s = groupSelection(s, ['a', 'b', 'c'], { id: 'g2', name: 'G2' })!;
    expect(pickSelection(s.objects, s.groups, 'a', null).ids.sort()).toEqual(['a', 'b', 'c']);
    expect(pickSelection(s.objects, s.groups, 'a', 'g2').ids.sort()).toEqual(['a', 'b']);
    expect(pickSelection(s.objects, s.groups, 'a', 'g1').ids).toEqual(['a']);
    expect(pickSelection(s.objects, s.groups, 'd', 'g1')).toMatchObject({ ids: ['d'], context: null });
    expect(selectedGroup(s.objects, s.groups, ['a', 'b', 'c'])?.id).toBe('g2');
    expect(selectedGroup(s.objects, s.groups, ['a', 'b'])?.id).toBe('g1');
    expect(selectedGroup(s.objects, s.groups, ['a'])).toBeNull();
  });
});

describe('árbol: reordenar, meter y sacar', () => {
  it('Alt+↑/↓ intercambia hermanos (un grupo se mueve como bloque)', () => {
    const s = groupSelection(scene4(), ['b', 'c'], { id: 'g1', name: 'G1' })!;
    expect(ids(reorderNode(s, 'g:g1', -1)!)).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(reorderNode(s, 'o:a', 1)!)).toEqual(['b', 'c', 'a', 'd']);
    expect(reorderNode(s, 'o:a', -1)).toBeNull();
  });

  it('Alt+→ mete en el grupo de arriba y Alt+← lo saca tras el grupo', () => {
    const s = groupSelection(scene4(), ['a', 'b'], { id: 'g1', name: 'G1' })!;
    const inside = indentNode(s, 'o:c')!;
    expect(descendantObjectIds(inside.objects, inside.groups, 'g1')).toEqual(['a', 'b', 'c']);
    const out = outdentNode(inside, 'o:a')!;
    expect(out.objects.find((o) => o.id === 'a')!.groupRef).toBeUndefined();
    expect(ids(out)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('arrastrar: no mete un grupo dentro de su descendiente', () => {
    let s = groupSelection(scene4(), ['a', 'b'], { id: 'g1', name: 'G1' })!;
    s = groupSelection(s, ['a', 'b', 'c'], { id: 'g2', name: 'G2' })!;
    expect(moveNode(s, 'g:g2', 'g1')).toBeNull();
    const moved = moveNode(s, 'o:d', 'g1', 'o:a')!;
    expect(descendantObjectIds(moved.objects, moved.groups, 'g1')).toEqual(['d', 'a', 'b']);
  });

  it('piezas de una división se muestran bajo un nodo de presentación', () => {
    const split = (id: string) => obj(id, [0, 0, 0], { metadata: { split: { groupId: 'orig', code: id } as never } });
    const tree = buildSceneTree([obj('a'), split('A1'), split('A2')], []);
    expect(tree.map((n) => n.kind)).toEqual(['object', 'split']);
    expect(tree[1].kind === 'split' && tree[1].objectCount).toBe(2);
  });
});

describe('duplicar la estructura', () => {
  it('las copias cuelgan de un gemelo del grupo', () => {
    const s = groupSelection(scene4(), ['a', 'b'], { id: 'g1', name: 'G1' })!;
    const copies = s.objects.filter((o) => o.groupRef === 'g1').map((o) => ({ sourceId: o.id, copy: { ...o, id: `${o.id}2` } }));
    let n = 0;
    const d = duplicateGroupStructure(s, copies, () => `twin${n++}`, (name) => `${name} copia`);
    expect(d.groups).toHaveLength(2);
    const twin = d.groups.find((g) => g.id === 'twin0')!;
    expect(twin.name).toBe('G1 copia');
    expect(descendantObjectIds(d.objects, d.groups, 'twin0')).toEqual(['a2', 'b2']);
  });
});

describe('transformación rígida del conjunto', () => {
  it('rota 90° alrededor del pivote y escala proporcional', () => {
    const objs = [obj('a', [-10, 0, 0]), obj('b', [10, 0, 0])];
    const pivot = selectionPivot(objs);
    expect(pivot[0]).toBeCloseTo(0);
    const rotated = rigidTransformPatches(objs, pivot, { rotation: [0, Math.PI / 2, 0] });
    // Girar en la vertical (Y interno): X pasa a −Z.
    expect(rotated[1].position[0]).toBeCloseTo(0);
    expect(rotated[1].position[2]).toBeCloseTo(-10);
    expect(rotated[1].rotation[1]).toBeCloseTo(Math.PI / 2);
    const scaled = rigidTransformPatches(objs, pivot, { scale: 2, translate: [5, 0, 0] });
    expect(scaled[1].position[0]).toBeCloseTo(25);
    expect(scaled[0].position[0]).toBeCloseTo(-15);
    expect(scaled[0].scale).toEqual([2, 2, 2]);
    // La distancia entre miembros escala igual que ellos: el conjunto no se deforma.
    expect(scaled[1].position[0] - scaled[0].position[0]).toBeCloseTo(40);
  });
});

describe('combinar en un objeto', () => {
  it('concatena sin booleanas: el volumen es la suma y se conservan los colores', () => {
    const a = obj('a', [0, 0, 0]);
    const b = obj('b', [5, 0, 0], { color: '#00ff00' }); // se solapan: una unión daría menos volumen
    const mesh = concatWorldMeshes([a, b]);
    const stats = computeMeshStats(mesh);
    expect(stats.volumeMm3).toBeCloseTo(a.stats.volumeMm3 + b.stats.volumeMm3, 3);
    expect(stats.triangles).toBe(24);
    expect(mesh.faceColors?.slice(0, 1)).toEqual(['#ff0000']);
    expect(mesh.faceColors?.slice(-1)).toEqual(['#00ff00']);
  });
});
