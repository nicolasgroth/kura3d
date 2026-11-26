/**
 * @file src/store/__tests__/assistantsRun.test.ts
 * @description Crear desde un asistente con el motor real: las salidas de la receta entran seleccionadas, con la
 * cámara pedida y un aviso, como UN paso de deshacer (Ctrl+Z las quita todas); un error de la receta devuelve los
 * errores tipados sin tocar la escena ni el historial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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

  it('crear dos veces no apila: el segundo juego cae en otro hueco, cada tapa conserva la distancia a su caja y todo queda en la cama', async () => {
    const footprint = (o: { mesh: { positions: ArrayLike<number> }; position: readonly number[] }) => {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < o.mesh.positions.length; i += 3) {
        minX = Math.min(minX, o.mesh.positions[i] + o.position[0]); maxX = Math.max(maxX, o.mesh.positions[i] + o.position[0]);
        minZ = Math.min(minZ, o.mesh.positions[i + 2] + o.position[2]); maxZ = Math.max(maxZ, o.mesh.positions[i + 2] + o.position[2]);
      }
      return { minX, maxX, minZ, maxZ };
    };
    await runAssistant({ recipe: builtinRecipe('kura.caja-tapa'), answers: {} });
    await runAssistant({ recipe: builtinRecipe('kura.caja-tapa'), answers: {} });
    const objs = store().objects;
    expect(objs.map((o) => o.name)).toEqual(['Caja', 'Tapa', 'Caja', 'Tapa']);
    const fps = objs.map(footprint);
    for (let a = 0; a < fps.length; a++) {
      for (let b = a + 1; b < fps.length; b++) {
        const overlap = fps[a].minX < fps[b].maxX - 1e-6 && fps[a].maxX > fps[b].minX + 1e-6 && fps[a].minZ < fps[b].maxZ - 1e-6 && fps[a].maxZ > fps[b].minZ + 1e-6;
        expect(overlap, `${a} y ${b} se solapan`).toBe(false);
      }
    }
    // El bloque se mueve entero: la tapa queda a la misma distancia de su caja en los dos juegos.
    const gap = (i: number) => [objs[i + 1].position[0] - objs[i].position[0], objs[i + 1].position[2] - objs[i].position[2]];
    expect(gap(2)[0]).toBeCloseTo(gap(0)[0], 6);
    expect(gap(2)[1]).toBeCloseTo(gap(0)[1], 6);
    // El primer juego, con la cama por defecto, queda dentro de la cama y sin el aviso de «fuera de la cama».
    const bed = store().printerProfile;
    for (const f of fps.slice(0, 2)) {
      expect(f.minX).toBeGreaterThanOrEqual(-bed.bedWidthMm / 2 - 1e-6);
      expect(f.maxX).toBeLessThanOrEqual(bed.bedWidthMm / 2 + 1e-6);
    }
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
