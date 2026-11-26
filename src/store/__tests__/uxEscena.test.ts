/**
 * @file src/store/__tests__/uxEscena.test.ts
 * @description Lote de escena en el store: duplicar y agrandar no dejan piezas sobre otras, guardar en la
 * web avisa al cancelar, cancelar la importación no agrega nada y un archivo con varios cuerpos sueltos
 * ofrece separarlos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { overlapsOthers, keepClearOfOthers } from '../../core/scene/freeSpot';
import { countMeshBodies } from '../../engine/io/meshBodies';
import { addBox, byId, resetStore, store } from './storeTestUtils';

function cubesStl(centers: Array<[number, number, number]>, size: number): ArrayBuffer {
  const h = size / 2;
  const lines = ['solid c'];
  for (const [cx, cy, cz] of centers) {
    const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
      .map(([x, y, z]) => [cx + x * h, cy + y * h, cz + z * h]);
    const tris = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
    for (const t of tris) lines.push('facet normal 0 0 0', 'outer loop', ...t.map((i) => `vertex ${v[i].join(' ')}`), 'endloop', 'endfacet');
  }
  lines.push('endsolid c');
  return new TextEncoder().encode(lines.join('\n')).buffer as ArrayBuffer;
}

describe('colocación sin solapes', () => {
  beforeEach(() => resetStore());

  it('duplicar un cubo grande no lo deja encima del original', async () => {
    const big = await addBox(80, [0, 0, 0]);
    const [copy] = store().duplicateObjects([big.id]);
    expect(overlapsOthers([byId(big.id)!], [byId(copy.id)!])).toBe(false);
  });

  it('duplicar un cubo chico conserva el corrimiento de 15 mm', async () => {
    const small = await addBox(10, [0, 0, 0]);
    const [copy] = store().duplicateObjects([small.id]);
    expect(byId(copy.id)!.position[0]).toBeCloseTo(15);
  });

  it('agrandar un cubo sobre otro objeto lo lleva a un hueco libre en el mismo paso de deshacer', async () => {
    const other = await addBox(20, [0, 0, 0]);
    const cube = await addBox(20, [40, 0, 0]);
    const past = store().past.length;
    await store().updatePrimitiveParams(cube.id, { kind: 'primitive', params: { width: 80, height: 20, depth: 80 } });
    expect(overlapsOthers([byId(other.id)!], [byId(cube.id)!])).toBe(false);
    expect(store().past.length).toBe(past + 1);
    expect(store().toasts.map((t) => t.text)).toContainEqual(expect.stringContaining('hueco libre'));
  });

  it('keepClearOfOthers no mueve lo que no pisa a nadie y mueve en bloque lo que sí', async () => {
    const a = await addBox(20, [0, 0, 0]);
    const far = { ...a, position: [100, 0, 0] as [number, number, number] };
    expect(keepClearOfOthers([a], [far]).moved).toBe(false);
    const on = [{ ...a, id: 'x' }, { ...a, id: 'y', position: [10, 0, 0] as [number, number, number] }];
    const moved = keepClearOfOthers([a], on);
    expect(moved.moved).toBe(true);
    expect(overlapsOthers([a], moved.parts)).toBe(false);
    expect(moved.parts[1].position[0] - moved.parts[0].position[0]).toBeCloseTo(10);
  });
});

describe('guardar en la web', () => {
  beforeEach(() => resetStore());

  it('cancelar el selector avisa "Guardado cancelado"', async () => {
    const picker = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    vi.stubGlobal('window', { showSaveFilePicker: picker });
    try {
      await addBox(10);
      expect(await store().saveProject()).toBe(false);
      expect(store().toasts.some((t) => t.text === 'Guardado cancelado.')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('importación', () => {
  beforeEach(() => resetStore());

  it('cuenta cuerpos sueltos', () => {
    const mesh = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5, 6, 5, 5, 5, 6, 5]), indices: new Uint32Array([0, 1, 2, 3, 4, 5]) };
    expect(countMeshBodies(mesh)).toBe(2);
    expect(countMeshBodies({ positions: new Float32Array(), indices: new Uint32Array() })).toBe(0);
  });

  it('un STL con dos cuerpos avisa y "Separar cuerpos" deja dos piezas', async () => {
    await store().importModelFiles([{ name: 'dos.stl', read: async () => cubesStl([[0, 10, 0], [60, 10, 0]], 20) }]);
    expect(store().objects).toHaveLength(1);
    const toast = store().toasts.find((t) => t.text.includes('trae 2 cuerpos separados'));
    expect(toast?.action?.label).toBe('Separar cuerpos');
    toast!.action!.run();
    await vi.waitFor(() => expect(store().objects).toHaveLength(2));
  });

  it('cancelar durante la lectura no agrega nada y avisa', async () => {
    const never = () => new Promise<ArrayBuffer>(() => undefined);
    const run = store().importModelFiles([{ name: 'lento.stl', size: 10, read: never }]);
    await vi.waitFor(() => expect(store().busyProgress?.cancellable).toBe(true));
    expect(store().cancelBusyOperation()).toBe(true);
    expect(await run).toBe(false);
    expect(store().objects).toHaveLength(0);
    expect(store().toasts.some((t) => t.text.startsWith('Importación cancelada'))).toBe(true);
  });
});
