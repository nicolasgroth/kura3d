/**
 * @file src/store/__tests__/importUnitHint.test.ts
 * @description Unidades dudosas al importar: un STL diminuto (unidades normalizadas, < 2 mm) o enorme
 * (> 5 m) trae `unitHint` con escalas sugeridas; el 3MF respeta su `unit` y no trae aviso. En el store,
 * el aviso ofrece la escala más probable, no escala solo, y aplicarla es un paso deshacible que conserva
 * la disposición del conjunto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parseModelFile, unitHintForSize } from '../../engine';
import { cubeMeshXml, cubeStlBinary, modelXml, pack3mf } from '../../engine/__tests__/ioFixtures';
import { useKuraStore } from '../useKuraStore';
import { maxDimension } from '../unitRescale';

const get = useKuraStore.getState;
let empty: ReturnType<typeof get>;

beforeAll(async () => {
  await get().initEngine();
  empty = get();
});
beforeEach(() => useKuraStore.setState({ ...empty, objects: [], groups: [], toasts: [], selectedIds: [] }, true));

describe('diagnóstico de unidades', () => {
  it('un STL de 0,95 mm sugiere escalas y termina con «ajustar a 100 mm»', () => {
    const model = parseModelFile('busto.stl', cubeStlBinary(0.95));
    expect(model.unitHint?.direction).toBe('tiny');
    expect(model.unitHint?.maxDimensionMm).toBeCloseTo(0.95, 5);
    const kinds = model.unitHint!.suggestions.map((s) => s.kind);
    expect(kinds).toEqual(expect.arrayContaining(['meters', 'inches', 'centimeters', 'times100', 'fit']));
    expect(kinds.at(-1)).toBe('fit');
    // La más probable deja la pieza en un tamaño de impresión típico (×100 -> 95 mm).
    expect(model.unitHint!.suggestions[0]).toMatchObject({ kind: 'times100', factor: 100 });
  });

  it('tamaños razonables no avisan; enormes sí; el 3MF respeta su unidad', () => {
    expect(parseModelFile('ok.stl', cubeStlBinary(40)).unitHint).toBeUndefined();
    expect(unitHintForSize(2)).toBeNull();
    expect(unitHintForSize(5000)).toBeNull();
    expect(unitHintForSize(Number.NaN)).toBeNull();
    expect(unitHintForSize(0)).toBeNull();
    const huge = unitHintForSize(95_000)!;
    expect(huge.direction).toBe('huge');
    expect(huge.suggestions[0].resultMm).toBeGreaterThanOrEqual(10);
    expect(huge.suggestions[0].resultMm).toBeLessThanOrEqual(400);
    const tiny3mf = pack3mf({ '3D/3dmodel.model': modelXml(`<object id="1">${cubeMeshXml(0.5)}</object>`, '<item objectid="1"/>') });
    expect(parseModelFile('chico.3mf', tiny3mf).unitHint).toBeUndefined();
  });
});

describe('aviso y reescalado en el store', () => {
  const stl = (size: number) => ({ name: 'busto.stl', read: async () => cubeStlBinary(size) });

  it('avisa sin escalar y el botón reescala en un paso deshacible', async () => {
    await get().importModelFiles([stl(0.95)]);
    const before = get().objects.map((o) => ({ ...o }));
    expect(before[0].scale).toEqual([1, 1, 1]);
    const toast = get().toasts.find((t) => t.text.includes('busto.stl') && t.action);
    expect(toast?.action?.label).toBe('Escalar ×100');
    toast!.action!.run();
    expect(get().objects[0].scale).toEqual([100, 100, 100]);
    expect(maxDimension(get().objects)).toBeCloseTo(95, 3);
    // Sigue apoyado en la cama.
    expect(get().objects[0].position[1]).toBeCloseTo(before[0].position[1] * 100, 3);
    get().undo();
    expect(get().objects[0].scale).toEqual([1, 1, 1]);
  });

  it('rescaleObjects conserva la disposición relativa de varias piezas', async () => {
    await get().importModelFiles([stl(1)]);
    await get().importModelFiles([{ name: 'otro.stl', read: async () => cubeStlBinary(1) }], { placement: 'bed' });
    const ids = get().objects.map((o) => o.id);
    const [a, b] = get().objects;
    const gap = b.position[0] - a.position[0];
    expect(get().rescaleObjects(ids, 25.4)).toBe(true);
    const [a2, b2] = get().objects;
    expect(b2.position[0] - a2.position[0]).toBeCloseTo(gap * 25.4, 3);
    expect(get().rescaleObjects(ids, 0)).toBe(false);
    expect(get().rescaleObjects(['nada'], 2)).toBe(false);
  });
});
