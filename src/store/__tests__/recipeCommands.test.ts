/**
 * @file src/store/__tests__/recipeCommands.test.ts
 * @description Comandos de recetas del Command Bus sobre el motor real: listar y describir las incorporadas,
 * validar una receta en línea con errores por ruta, analizar con `dryRun` sin tocar la escena, aplicar como UN
 * paso de deshacer, y una receta que falla (o una política de solo lectura) que no deja nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { isReadCommand } from '../../core/commands/commandPolicy';
import { addBox, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 'r', command: command as 'run_recipe', params });

describe('bus: recetas', () => {
  beforeEach(() => resetStore('es'));

  it('política: listar, describir y validar son lectura; ejecutar es escritura', () => {
    expect(['list_recipes', 'describe_recipe', 'validate_recipe'].every(isReadCommand)).toBe(true);
    expect(isReadCommand('run_recipe')).toBe(false);
  });

  it('lista las tres incorporadas y describe una en el idioma pedido', async () => {
    const list = await run('list_recipes', { language: 'en' });
    expect(list.ok).toBe(true);
    expect((list.result as { recipes: { id: string; title: string }[] }).recipes.map((r) => r.id))
      .toEqual(['kura.caja-tapa', 'kura.llavero', 'kura.placa-enchufe']);
    const described = await run('describe_recipe', { recipeId: 'kura.caja-tapa', language: 'en' });
    const recipe = described.result as { title: string; params: { id: string; label: string; min?: number; max?: number }[] };
    expect(recipe.title).toBe('Box with lid');
    expect(recipe.params.find((p) => p.id === 'r')).toMatchObject({ label: 'Corner radius', min: 0, max: 15 });
  });

  it('valida una receta en línea y devuelve los errores con ruta y mensaje', async () => {
    const res = await run('validate_recipe', { recipe: { format: 'kura.recipe/1', id: 'x.y', version: '1.0.0', title: 'T', author: 'A', license: 'GPL-3.0', steps: [], outputs: [] } });
    expect(res.ok).toBe(true);
    const out = res.result as { ok: boolean; errors: { code: string; path: string; message: string }[] };
    expect(out.ok).toBe(false);
    expect(out.errors.some((e) => e.path === 'license' && e.message.length > 0)).toBe(true);
  });

  it('dryRun analiza sin tocar la escena', async () => {
    await addBox(10);
    const before = store().objects;
    const pastBefore = store().past.length;
    const res = await run('run_recipe', { recipeId: 'kura.caja-tapa', dryRun: true, answers: { w: 50 } });
    expect(res.ok).toBe(true);
    expect(res.result).toMatchObject({ dryRun: true, ok: true, derived: { ow: 54 }, estimate: { outputs: 2 } });
    expect(store().objects).toBe(before);
    expect(store().past.length).toBe(pastBefore);
  });

  it('aplicar agrega las salidas en UN paso de deshacer y deshacer las quita todas', async () => {
    const box = await addBox(10);
    const pastBefore = store().past.length;
    const res = await run('run_recipe', { recipeId: 'kura.caja-tapa' });
    expect(res.ok, res.error).toBe(true);
    const out = res.result as { objects: { id: string; name: string; role: string }[] };
    expect(out.objects.map((o) => o.name)).toEqual(['Caja', 'Tapa']);
    expect(store().objects.map((o) => o.id)).toEqual([box.id, ...out.objects.map((o) => o.id)]);
    expect(store().past.length).toBe(pastBefore + 1);
    expect(store().objects[1].metadata?.recipe?.id).toBe('kura.caja-tapa');
    store().undo();
    expect(store().objects.map((o) => o.id)).toEqual([box.id]);
  });

  it('una receta que falla no deja nada y responde con el error tipado', async () => {
    const box = await addBox(10);
    const pastBefore = store().past.length;
    const res = await run('run_recipe', { recipeId: 'kura.caja-tapa', answers: { w: 5000 } });
    expect(res.ok).toBe(false);
    expect((res as { errorCode?: string }).errorCode).toBe('invalid-params');
    expect(store().objects.map((o) => o.id)).toEqual([box.id]);
    expect(store().past.length).toBe(pastBefore);
    const both = await run('run_recipe', { recipeId: 'kura.caja-tapa', recipe: {} });
    expect(both.ok).toBe(false);
  });
});
