/**
 * @file src/project/__tests__/recipeProvenance.test.ts
 * @description `metadata.recipe` en el `.kura`: los objetos generados por una receta se guardan y se vuelven a
 * abrir con su procedencia; un proyecto sin ella sigue abriendo igual; y una procedencia hostil (huella mal
 * formada, respuestas no simples o demasiadas, campos desconocidos) se rechaza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore, store, addBox } from '../../store/__tests__/storeTestUtils';
import { DEFAULT_PRINTER_PROFILES, type SceneObject } from '../../types/kura';
import { decodeProject, encodeProject } from '../projectCodec';

const doc = (objects: SceneObject[]) => ({
  objects, selectedIds: [], past: [], future: [], unitSystem: 'mm' as const, printerProfile: DEFAULT_PRINTER_PROFILES[0],
  customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 0 }, snapGridMm: 1,
});

const roundTrip = (objects: SceneObject[]) => decodeProject(encodeProject(doc(objects))).objects;

describe('procedencia de recetas en el .kura', () => {
  beforeEach(() => resetStore());

  it('una caja de receta se guarda y se reabre con metadata.recipe', async () => {
    const res = await store().executeCommand({ id: '1', command: 'run_recipe', params: { recipeId: 'kura.caja-tapa', answers: { w: 60, fix: 'press' } } });
    expect(res.ok, res.error).toBe(true);
    const reopened = roundTrip(store().objects);
    expect(reopened.map((o) => o.metadata?.recipe)).toEqual(store().objects.map((o) => o.metadata?.recipe));
    expect(reopened[0].metadata?.recipe).toMatchObject({ id: 'kura.caja-tapa', answers: { w: 60, fix: 'press' }, output: 'box' });
  });

  it('la ejecución, el nombre y la huella de la malla viajan en el .kura y se reabren', async () => {
    const box = await addBox(10);
    const recipe = { id: 'kura.caja-tapa', version: '1.0.0', hash: 'a'.repeat(64), answers: { w: 60 }, output: 'box', run: 'run_1', name: 'Caja', meshFingerprint: '12:0badc0de' };
    expect(roundTrip([{ ...box, metadata: { recipe } }])[0].metadata?.recipe).toEqual(recipe);
  });

  it('un proyecto sin procedencia abre igual', async () => {
    const box = await addBox(10);
    expect(roundTrip([box])[0].metadata).toBeUndefined();
  });

  it.each([
    ['huella mal formada', { hash: 'abc' }],
    ['respuesta que no es simple', { answers: { w: { evil: 1 } } }],
    ['demasiadas respuestas', { answers: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`a${i}`, i])) }],
    ['campo desconocido', { script: 'x' }],
    ['ejecución demasiado larga', { run: 'r'.repeat(65) }],
    ['nombre que no es texto', { name: 5 }],
    ['id inválido', { id: 'SinPunto' }],
  ])('rechaza una procedencia con %s', async (_name, patch) => {
    const box = await addBox(10);
    const recipe = { id: 'kura.caja-tapa', version: '1.0.0', hash: 'a'.repeat(64), answers: {}, output: 'box', ...patch };
    expect(() => roundTrip([{ ...box, metadata: { recipe } as never }])).toThrow();
  });
});
