/**
 * @file src/store/__tests__/assistantsRun.test.ts
 * @description Crear desde un asistente con el motor real: las salidas de la receta entran seleccionadas, con la
 * cámara pedida y un aviso, como UN paso de deshacer (Ctrl+Z las quita todas); un error de la receta devuelve los
 * errores tipados sin tocar la escena ni el historial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { builtinRecipe } from '../../core/recipes/builtin';
import { t } from '../../i18n';
import { closeAssistants, openAssistants, runAssistant, showAssistantRecipe, useAssistantsPanel } from '../assistantsPanel';
import { addBox, resetStore, store } from './storeTestUtils';

describe('runAssistant (motor real)', () => {
  beforeEach(async () => {
    await resetStore('es');
    closeAssistants();
  });

  it('agrega las salidas seleccionadas en un solo paso de deshacer y avisa qué se creó', async () => {
    const cube = await addBox(10);
    const pastBefore = store().past.length;
    const outcome = await runAssistant({ recipe: builtinRecipe('kura.caja-tapa'), answers: {} });
    expect(outcome).toEqual({ status: 'created', names: ['Caja', 'Tapa'] });
    const added = store().objects.filter((o) => o.id !== cube.id);
    expect(added.map((o) => o.name)).toEqual(['Caja', 'Tapa']);
    expect([...store().selectedIds].sort()).toEqual(added.map((o) => o.id).sort());
    expect(store().past.length).toBe(pastBefore + 1);
    expect(store().cameraRequest).toMatchObject({ preset: 'fit', ids: added.map((o) => o.id) });
    expect(store().toasts.some((x) => x.kind === 'success' && x.text === t('es', 'asis.created', { names: 'Caja, Tapa' }))).toBe(true);
    // Deshacer (Ctrl+Z) quita todo lo creado de una vez.
    store().undo();
    expect(store().objects.map((o) => o.id)).toEqual([cube.id]);
  });

  it('con una variante crea la pieza y la deja marcada con su procedencia', async () => {
    const outcome = await runAssistant({ recipe: builtinRecipe('kura.placa-enchufe'), answers: {}, variant: 'us' });
    expect(outcome.status).toBe('created');
    expect(store().objects).toHaveLength(1);
    expect(store().objects[0].metadata?.recipe?.variant).toBe('us');
  });

  it('un error de la receta devuelve los errores tipados y no toca la escena', async () => {
    const cube = await addBox(10);
    const objects = store().objects;
    const pastBefore = store().past.length;
    const outcome = await runAssistant({ recipe: builtinRecipe('kura.caja-tapa'), answers: { w: 5000 } });
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') expect(outcome.errors.some((e) => e.path.startsWith('params['))).toBe(true);
    expect(store().objects).toBe(objects);
    expect(store().objects[0].id).toBe(cube.id);
    expect(store().past.length).toBe(pastBefore);
  });
});

describe('estado del panel de Asistentes', () => {
  it('abre en la lista o directo en una receta y cierra limpiando la elección', () => {
    openAssistants();
    expect(useAssistantsPanel.getState()).toMatchObject({ open: true, recipeId: null });
    showAssistantRecipe('kura.llavero');
    expect(useAssistantsPanel.getState().recipeId).toBe('kura.llavero');
    closeAssistants();
    expect(useAssistantsPanel.getState()).toMatchObject({ open: false, recipeId: null });
    openAssistants('kura.caja-tapa');
    expect(useAssistantsPanel.getState()).toMatchObject({ open: true, recipeId: 'kura.caja-tapa' });
  });
});
