/**
 * @file src/store/__tests__/assistantsEdit.test.ts
 * @description Reabrir una pieza creada por un asistente (motor real): la procedencia guarda la ejecución, el nombre y la
 * huella; «Actualizar» reemplaza todo el juego (caja y tapa) en un solo paso de deshacer conservando posición, nombre
 * cambiado, color y grupo; se detecta si el juego se modificó después; y una receta desconocida, de otra versión o con
 * respuestas guardadas hostiles se explica o se sanea antes de usarse.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { planAssistantEdit } from '../../components/assistants/editPlan';
import { builtinRecipe } from '../../core/recipes/builtin';
import type { SceneObject } from '../../types/kura';
import { closeAssistants, runAssistant } from '../assistantsPanel';
import { isRecipeRunModified, recipeRunMembers } from '../recipeRuns';
import { useKuraStore } from '../useKuraStore';
import { addBox, resetStore, store } from './storeTestUtils';

const CAJA = 'kura.caja-tapa';
const create = (answers: Record<string, unknown>) => runAssistant({ recipe: builtinRecipe(CAJA), answers: answers as never });
const pieces = () => store().objects.filter((o) => o.metadata?.recipe);
const named = (name: string) => store().objects.find((o) => o.name === name) as SceneObject;
const okSession = (id: string) => {
  const plan = planAssistantEdit(store().objects, id);
  if (plan?.status !== 'ok') throw new Error(`plan ${plan?.status}`);
  return plan.session;
};

beforeEach(async () => {
  await resetStore('es');
  closeAssistants();
});

describe('procedencia del juego', () => {
  it('las dos piezas comparten ejecución y guardan nombre y huella de la malla', async () => {
    await create({ w: 70 });
    const [box, lid] = pieces();
    expect(box.metadata?.recipe?.run).toBeTruthy();
    expect(box.metadata?.recipe?.run).toBe(lid.metadata?.recipe?.run);
    expect(box.metadata?.recipe).toMatchObject({ name: 'Caja', output: 'box', answers: { w: 70 } });
    expect(box.metadata?.recipe?.meshFingerprint).toMatch(/^\d+:[0-9a-f]{8}$/);
    expect(recipeRunMembers(store().objects, box).map((o) => o.id)).toEqual([box.id, lid.id]);
    expect(isRecipeRunModified(recipeRunMembers(store().objects, box))).toBe(false);
  });

  it('dos ejecuciones iguales no se mezclan', async () => {
    await create({ w: 70 });
    await create({ w: 70 });
    const [a, , b] = pieces();
    expect(a.metadata?.recipe?.run).not.toBe(b.metadata?.recipe?.run);
    expect(recipeRunMembers(store().objects, a)).toHaveLength(2);
  });

  it('una pieza cortada o pintada después cuenta como modificada', async () => {
    await create({ w: 70 });
    const box = named('Caja');
    const cut = { ...box.mesh, positions: Float32Array.from(box.mesh.positions, (v, i) => (i === 0 ? v + 1 : v)) };
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === box.id ? { ...o, mesh: cut } : o)) });
    expect(isRecipeRunModified(recipeRunMembers(store().objects, box))).toBe(true);
    await resetStore('es');
    await create({ w: 70 });
    const fresh = named('Caja');
    const painted = { ...fresh.mesh, faceColors: ['#ff0000'] };
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === fresh.id ? { ...o, mesh: painted as never } : o)) });
    expect(isRecipeRunModified(recipeRunMembers(store().objects, fresh))).toBe(true);
  });
});

describe('Actualizar reemplaza el juego en un paso', () => {
  it('conserva posición, nombre cambiado, color y grupo; deshacer lo devuelve todo', async () => {
    await addBox(10);
    await create({ w: 70, h: 30 });
    const oldIds = pieces().map((o) => o.id);
    const box = named('Caja');
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === box.id ? { ...o, name: 'Mi caja', color: '#ff8800', position: [41, o.position[1], -33] } : o)) });
    const group = store().groupObjects(oldIds, 'Juego');
    expect(group).not.toBeNull();
    const pastBefore = store().past.length;
    const session = okSession(box.id);
    expect(session.answers).toMatchObject({ w: 70, h: 30 });
    expect(session.objectIds).toEqual(oldIds);

    const outcome = await runAssistant({ recipe: builtinRecipe(CAJA), answers: { ...session.answers, w: 90 }, replaceIds: session.objectIds });
    expect(outcome).toMatchObject({ status: 'created', updated: true });
    expect(store().past.length).toBe(pastBefore + 1);

    const now = pieces();
    expect(now).toHaveLength(2);
    expect(now.some((o) => oldIds.includes(o.id))).toBe(false);
    const newBox = now.find((o) => o.metadata?.recipe?.output === 'box') as SceneObject;
    const newLid = now.find((o) => o.metadata?.recipe?.output !== 'box') as SceneObject;
    expect(newBox.name).toBe('Mi caja');
    expect(newBox.color).toBe('#ff8800');
    expect(newBox.position[0]).toBeCloseTo(41);
    expect(newBox.position[2]).toBeCloseTo(-33);
    expect(newLid.name).toBe('Tapa');
    expect(newBox.groupRef).toBe(group?.id);
    expect(newLid.groupRef).toBe(group?.id);
    expect(newBox.metadata?.recipe?.answers.w).toBe(90);
    expect(newBox.metadata?.recipe?.run).toBe(newLid.metadata?.recipe?.run);
    expect(store().selectedIds.sort()).toEqual(now.map((o) => o.id).sort());
    expect(store().objects).toHaveLength(3);

    store().undo();
    expect(pieces().map((o) => o.id)).toEqual(oldIds);
    expect(store().objects).toHaveLength(3);
  });

  it('una pieza sin ejecución guardada (proyecto anterior) reemplaza solo esa pieza', async () => {
    await create({ w: 70 });
    const [box] = pieces();
    useKuraStore.setState({
      objects: store().objects.map((o) => {
        const { run: _run, ...rest } = o.metadata!.recipe!;
        return { ...o, metadata: { recipe: rest } };
      }),
    });
    expect(okSession(box.id).objectIds).toEqual([box.id]);
  });

  it('si el juego ya no está en la escena no inserta nada raro', async () => {
    await create({ w: 70 });
    const session = okSession(named('Caja').id);
    useKuraStore.setState({ objects: [] });
    const outcome = await runAssistant({ recipe: builtinRecipe(CAJA), answers: session.answers as never, replaceIds: session.objectIds });
    // Sin piezas que reemplazar la receta las crea como nuevas (el formulario avisa antes y no llega aquí).
    expect(outcome.status).toBe('created');
  });
});

describe('robustez de lo guardado en el .kura', () => {
  const withProvenance = async (patch: Record<string, unknown>) => {
    await create({ w: 70 });
    const [box] = pieces();
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === box.id ? { ...o, metadata: { recipe: { ...o.metadata!.recipe!, ...patch } } } : o)) });
    return box.id;
  };

  it('una receta que ya no existe se explica (no se abre)', async () => {
    const id = await withProvenance({ id: 'otro.receta-perdida' });
    expect(planAssistantEdit(store().objects, id)).toEqual({ status: 'missing', recipeId: 'otro.receta-perdida', version: expect.any(String) });
  });

  it('una versión mayor distinta es incompatible', async () => {
    const id = await withProvenance({ version: '9.0.0' });
    expect(planAssistantEdit(store().objects, id)).toMatchObject({ status: 'incompatible', recipeId: CAJA, saved: '9.0.0' });
  });

  it('una versión menor distinta sí se abre', async () => {
    const id = await withProvenance({ version: '1.7.2' });
    expect(planAssistantEdit(store().objects, id)?.status).toBe('ok');
  });

  it('respuestas hostiles o de otro tipo se descartan antes de usarse', async () => {
    const id = await withProvenance({ answers: { w: 'ancho', zzz: 5, fix: 'no-existe', h: 40, wall: Number.NaN }, variant: 'fantasma' });
    const plan = planAssistantEdit(store().objects, id);
    if (plan?.status !== 'ok') throw new Error('debía abrirse');
    expect(plan.session.answers).toEqual({ h: 40 });
    expect([...plan.session.dropped].sort()).toEqual(['fix', 'variant', 'w', 'wall', 'zzz']);
    expect(plan.session.variant).toBeUndefined();
  });

  it('una pieza que no viene de un asistente no tiene plan', async () => {
    const cube = await addBox(10);
    expect(planAssistantEdit(store().objects, cube.id)).toBeNull();
  });
});
