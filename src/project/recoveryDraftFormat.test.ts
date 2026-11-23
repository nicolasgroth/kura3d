/**
 * @file src/project/recoveryDraftFormat.test.ts
 * @description Pruebas del formato del borrador v2: ida y vuelta, claves estables por contenido
 * (mover o recolorear no crea bloques nuevos) y rechazo de bloques ausentes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { captureProject, useKuraStore } from '../store/useKuraStore';
import { computeMeshStats } from '../engine/primitives';
import type { MeshData, SceneObject } from '../types/kura';
import { assembleDocument, blockKey, splitDocument } from './recoveryDraftFormat';

function mesh(size = 1): MeshData {
  return {
    positions: new Float32Array([0, 0, 0, size, 0, 0, 0, size, 0, 0, 0, size]),
    indices: new Uint32Array([0, 1, 2, 0, 1, 3, 0, 2, 3, 1, 2, 3]),
  };
}

function object(id: string, m: MeshData, x = 0): SceneObject {
  return {
    id, name: id, source: 'imported', position: [x, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: '#336699', isHole: false, visible: true, locked: false, mesh: m, stats: computeMeshStats(m),
  } as SceneObject;
}

function documentWith(objects: SceneObject[]) {
  const initial = useKuraStore.getInitialState();
  return { ...captureProject(initial), objects, selectedIds: [objects[0].id] };
}

const asWords = (blocks: Awaited<ReturnType<typeof splitDocument>>['blocks']) =>
  new Map([...blocks].map(([key, block]) => [key, block.words]));

describe('borrador de recuperación v2', () => {
  it('ida y vuelta conserva escena, selección y geometría', async () => {
    const shared = mesh(2);
    const doc = documentWith([object('a', shared, 5), object('b', shared, -5), object('c', mesh(3))]);
    const { manifest, blocks } = await splitDocument(doc);
    expect(manifest.meshes).toHaveLength(2);
    const back = assembleDocument(JSON.parse(JSON.stringify(manifest)), asWords(blocks));
    expect(back.objects.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(back.objects[0].position).toEqual([5, 0, 0]);
    expect([...back.objects[2].mesh.positions]).toEqual([...doc.objects[2].mesh.positions]);
    expect(back.objects[0].mesh).toBe(back.objects[1].mesh);
    expect(back.selectedIds).toEqual(['a']);
    expect(back.objects[0].stats.triangles).toBe(4);
  });

  it('mover o recolorear un objeto no cambia las claves de sus bloques', async () => {
    const m = mesh(4);
    const before = await splitDocument(documentWith([object('a', m, 0)]));
    const moved = { ...object('a', m, 40), color: '#ff0000' };
    const after = await splitDocument(documentWith([moved]));
    expect([...after.blocks.keys()]).toEqual([...before.blocks.keys()]);
    // Una copia con el mismo contenido comparte clave (huella de contenido, no identidad).
    const copy: MeshData = { positions: new Float32Array(m.positions), indices: new Uint32Array(m.indices) };
    expect(await blockKey(copy.positions)).toBe(await blockKey(m.positions));
    expect(await blockKey(new Float32Array([1, 2, 3]))).not.toBe(await blockKey(new Float32Array([1, 2, 4])));
  });

  it('rechaza un borrador al que le falta un bloque o trae índices fuera de rango', async () => {
    const { manifest, blocks } = await splitDocument(documentWith([object('a', mesh())]));
    const words = asWords(blocks);
    const [first] = words.keys();
    const missing = new Map(words);
    missing.delete(first);
    expect(() => assembleDocument(manifest, missing)).toThrow();
    const broken = new Map(words);
    broken.set(manifest.meshes[0].indices, new Uint32Array([0, 1, 99]));
    expect(() => assembleDocument(manifest, broken)).toThrow();
  });

  it('sin historial omite deshacer y rehacer', async () => {
    const doc = { ...documentWith([object('a', mesh())]), past: [{ objects: [object('z', mesh(9))], selectedIds: [] }] };
    const full = await splitDocument(doc, true);
    const light = await splitDocument(doc, false);
    expect(full.manifest.past).toHaveLength(1);
    expect(light.manifest.past).toHaveLength(0);
    expect(light.blocks.size).toBeLessThan(full.blocks.size);
  });
});
